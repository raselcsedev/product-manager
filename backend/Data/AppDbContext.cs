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

        // Two categories cannot share the same name.
        modelBuilder.Entity<Category>().HasIndex(c => c.Name).IsUnique();

        // Product -> Category (many products, one category, category is optional).
        // Deleting a category keeps its products and sets their CategoryId to NULL.
        modelBuilder.Entity<Product>()
            .HasOne(p => p.Category)
            .WithMany()
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
