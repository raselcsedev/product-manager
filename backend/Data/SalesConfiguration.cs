using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductApi.Models;

namespace ProductApi.Data;

// How the POS tables are shaped. EF finds these classes by itself:
// AppDbContext calls modelBuilder.ApplyConfigurationsFromAssembly(...), so AppDbContext needs no other change.

public sealed class SaleConfiguration : IEntityTypeConfiguration<Sale>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.ToTable("Sales");

        // Deleting a seller deletes their sales; deleting a sale deletes its lines.
        builder.HasOne<AppUser>().WithMany().HasForeignKey(s => s.OwnerId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(s => s.Items).WithOne().HasForeignKey(i => i.SaleId).OnDelete(DeleteBehavior.Cascade);

        // Receipt numbers are unique per seller, and the history is always "newest first"
        builder.HasIndex(s => new { s.OwnerId, s.SaleNumber }).IsUnique();
        builder.HasIndex(s => new { s.OwnerId, s.CreatedAt });
    }
}

public sealed class SaleItemConfiguration : IEntityTypeConfiguration<SaleItem>
{
    public void Configure(EntityTypeBuilder<SaleItem> builder)
    {
        builder.ToTable("SaleItems");

        // Deleting a PRODUCT keeps the sale line. Only its product link is cleared, and the name stays.
        builder.HasOne<Product>().WithMany().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.SetNull);
    }
}
