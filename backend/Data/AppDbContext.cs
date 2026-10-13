using Microsoft.EntityFrameworkCore;
using ProductApi.Models;

namespace ProductApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Category> Categories => Set<Category>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Two accounts cannot share the same email.
        modelBuilder.Entity<AppUser>().HasIndex(u => u.Email).IsUnique();

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
    }
}
