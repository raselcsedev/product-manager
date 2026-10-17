using System.Globalization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Data;

public class AppDbContext : DbContext
{
    private readonly IHttpContextAccessor? _httpContextAccessor;

    public AppDbContext(DbContextOptions<AppDbContext> options, IHttpContextAccessor? httpContextAccessor = null)
        : base(options)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // MySQL does not store "this DateTime is UTC". Without this, dates come back with an unknown kind,
    // and the browser would read them as local time (wrong by hours). Now they are always marked UTC.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    private sealed class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcDateTimeConverter()
            : base(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
        {
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Two accounts cannot share the same email.
        modelBuilder.Entity<AppUser>().HasIndex(u => u.Email).IsUnique();

        // Two shops cannot share the same address (/shops/<slug>). Many users may have NO shop (null).
        modelBuilder.Entity<AppUser>().HasIndex(u => u.ShopSlug).IsUnique();

        // A user cannot have two categories with the same name (different users can).
        modelBuilder.Entity<Category>().HasIndex(c => new { c.OwnerId, c.Name }).IsUnique();

        // Product -> Category (optional). Deleting a category keeps its products.
        modelBuilder.Entity<Product>()
            .HasOne(p => p.Category)
            .WithMany()
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        // Ownership: every product and category belongs to one user.
        // Deleting a user deletes everything they own.
        modelBuilder.Entity<Product>()
            .HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(p => p.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Category>()
            .HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(c => c.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);

        // The public shop only reads published products
        modelBuilder.Entity<Product>().HasIndex(p => new { p.IsPublished, p.Id });

        // Fast "newest first" lookups for the activity page
        modelBuilder.Entity<AuditLog>().HasIndex(a => new { a.UserId, a.CreatedAt });
        modelBuilder.Entity<AuditLog>().HasIndex(a => a.CreatedAt);
    }

    // =====================================================================
    //  Audit trail
    //  Every time code calls SaveChangesAsync(), we look at what EF is about to write,
    //  and store a matching AuditLog row. Controllers cannot forget to log, because they
    //  never do it themselves.
    //  (Only SaveChangesAsync is covered. This app never uses the non-async SaveChanges.)
    // =====================================================================

    private sealed record PendingAudit(string Action, string EntityType, object Entity, string EntityName, string? Details);

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        var pending = CollectAuditEntries();
        if (pending.Count == 0)
            return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);

        var principal = _httpContextAccessor?.HttpContext?.User;
        var actorId = principal.TryGetUserId(out var id) ? id : 0;
        var actorName = actorId == 0 ? "System" : principal.GetUserName();

        // The change and its log rows are saved in ONE transaction: both are stored, or neither is.
        // (If a transaction is already open, for example in the admin "delete user" code, we join it.)
        var ownsTransaction = Database.CurrentTransaction is null;
        await using var transaction = ownsTransaction
            ? await Database.BeginTransactionAsync(cancellationToken)
            : null;

        var rows = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);

        // Now the database has generated the ids of newly created rows, so we can log them too.
        foreach (var item in pending)
        {
            AuditLogs.Add(new AuditLog
            {
                UserId = actorId,
                ActorName = Truncate(actorName, 100),
                Action = item.Action,
                EntityType = item.EntityType,
                EntityId = IdOf(item.Entity),
                EntityName = Truncate(item.EntityName, 150),
                Details = item.Details is null ? null : Truncate(item.Details, 1000),
                CreatedAt = DateTime.UtcNow,
            });
        }
        await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        return rows;
    }

    private List<PendingAudit> CollectAuditEntries()
    {
        ChangeTracker.DetectChanges();
        var list = new List<PendingAudit>();

        foreach (var entry in ChangeTracker.Entries().ToList())
        {
            if (entry.Entity is Product product)
            {
                if (entry.State == EntityState.Added)
                    list.Add(new("Created", "Product", product, product.Name,
                        $"Price {Money(product.Price)}, quantity {product.Quantity}" +
                        (product.IsPublished ? ", published on the public shop" : "")));
                else if (entry.State == EntityState.Deleted)
                    list.Add(new("Deleted", "Product", product, product.Name,
                        $"Price {Money(product.Price)}, quantity {product.Quantity}"));
                else if (entry.State == EntityState.Modified && DescribeProductChanges(entry) is { } details)
                    list.Add(new("Updated", "Product", product, product.Name, details));
            }
            else if (entry.Entity is Category category)
            {
                if (entry.State == EntityState.Added)
                    list.Add(new("Created", "Category", category, category.Name, null));
                else if (entry.State == EntityState.Deleted)
                    list.Add(new("Deleted", "Category", category, category.Name, null));
                else if (entry.State == EntityState.Modified && DescribeCategoryChanges(entry) is { } details)
                    list.Add(new("Updated", "Category", category, category.Name, details));
            }
            else if (entry.Entity is AppUser user && entry.State == EntityState.Modified)
            {
                // Role changes by an admin, name changes, password changes and shop page changes.
                // Registration (Added) is not logged, because nobody is logged in yet.
                if (DescribeUserChanges(entry) is { } details)
                    list.Add(new("Updated", "User", user, user.Name, details));
            }
        }

        return list;
    }

    private static string? DescribeProductChanges(EntityEntry entry)
    {
        var parts = new List<string>();

        foreach (var property in entry.Properties.Where(p => p.IsModified))
        {
            var before = property.OriginalValue;
            var after = property.CurrentValue;
            if (Equals(before, after)) continue;

            switch (property.Metadata.Name)
            {
                case nameof(Product.Name):
                    parts.Add($"Name: \"{before}\" -> \"{after}\"");
                    break;
                case nameof(Product.Description):
                    parts.Add("Description changed"); // can be long, so we do not copy it
                    break;
                case nameof(Product.Price):
                    parts.Add($"Price: {Money(before)} -> {Money(after)}");
                    break;
                case nameof(Product.Quantity):
                    parts.Add($"Quantity: {before} -> {after}");
                    break;
                case nameof(Product.CategoryId):
                    parts.Add("Category changed");
                    break;
                case nameof(Product.ImageFileName):
                    parts.Add(before is null ? "Image added" : after is null ? "Image removed" : "Image replaced");
                    break;
                case nameof(Product.IsPublished):
                    // Making something public is worth a clear line in the history.
                    parts.Add(Convert.ToBoolean(after, CultureInfo.InvariantCulture)
                        ? "Published on the public shop"
                        : "Removed from the public shop");
                    break;
            }
        }

        return parts.Count == 0 ? null : string.Join("; ", parts);
    }

    private static string? DescribeCategoryChanges(EntityEntry entry)
    {
        var name = entry.Property(nameof(Category.Name));
        return name.IsModified && !Equals(name.OriginalValue, name.CurrentValue)
            ? $"Name: \"{name.OriginalValue}\" -> \"{name.CurrentValue}\""
            : null;
    }

    private static string? DescribeUserChanges(EntityEntry entry)
    {
        var parts = new List<string>();

        var role = entry.Property(nameof(AppUser.Role));
        if (role.IsModified && !Equals(role.OriginalValue, role.CurrentValue))
            parts.Add($"Role: {role.OriginalValue} -> {role.CurrentValue}");

        var name = entry.Property(nameof(AppUser.Name));
        if (name.IsModified && !Equals(name.OriginalValue, name.CurrentValue))
            parts.Add($"Name: \"{name.OriginalValue}\" -> \"{name.CurrentValue}\"");

        // Never log the password or its hash, only the fact that it changed.
        var hash = entry.Property(nameof(AppUser.PasswordHash));
        if (hash.IsModified && !Equals(hash.OriginalValue, hash.CurrentValue))
            parts.Add("Password changed");

        // The shop page makes a seller visible to the public, so changes to it are recorded too.
        var slug = entry.Property(nameof(AppUser.ShopSlug));
        if (slug.IsModified && !Equals(slug.OriginalValue, slug.CurrentValue))
        {
            parts.Add(slug.OriginalValue is null ? $"Shop page created: /shops/{slug.CurrentValue}"
                    : slug.CurrentValue is null ? "Shop page removed"
                    : $"Shop address: {slug.OriginalValue} -> {slug.CurrentValue}");
        }

        var shopName = entry.Property(nameof(AppUser.ShopName));
        if (shopName.IsModified && !Equals(shopName.OriginalValue, shopName.CurrentValue)
            && shopName.OriginalValue is not null && shopName.CurrentValue is not null)
        {
            parts.Add($"Shop name: \"{shopName.OriginalValue}\" -> \"{shopName.CurrentValue}\"");
        }

        var shopDescription = entry.Property(nameof(AppUser.ShopDescription));
        if (shopDescription.IsModified && !Equals(shopDescription.OriginalValue, shopDescription.CurrentValue)
            && slug.CurrentValue is not null && slug.OriginalValue is not null)
        {
            parts.Add("Shop description changed");
        }

        return parts.Count == 0 ? null : string.Join("; ", parts);
    }

    private static int? IdOf(object entity) => entity switch
    {
        Product p => p.Id,
        Category c => c.Id,
        AppUser u => u.Id,
        _ => null,
    };

    // Always "12.50", whatever the server's language settings are.
    private static string Money(object? value) =>
        Convert.ToDecimal(value, CultureInfo.InvariantCulture).ToString("0.00", CultureInfo.InvariantCulture);

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
