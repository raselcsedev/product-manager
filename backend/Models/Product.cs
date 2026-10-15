using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ProductApi.Models;

public class Product
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Product name is required.")]
    [StringLength(100, ErrorMessage = "Product name must be 100 characters or fewer.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Description must be 500 characters or fewer.")]
    public string? Description { get; set; }

    [Range(0.01, 999999999, ErrorMessage = "Price must be greater than zero.")]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Price { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "Quantity cannot be negative.")]
    public int Quantity { get; set; }

    // Foreign key: the id of the category (null = no category)
    public int? CategoryId { get; set; }

    // Navigation property: EF fills this with the Category row when we use .Include(...)
    public Category? Category { get; set; }

    // Only the generated file name is stored (like "3f2a...c9.jpg"), never the image itself.
    // It is sent to the client for display, but ignored when the client sends a product:
    // it can only be changed through the /image endpoints.
    [StringLength(100)]
    public string? ImageFileName { get; set; }

    // true = visitors who are NOT logged in can see this product on the public shop.
    // New products are private until the owner turns this on.
    public bool IsPublished { get; set; }

    // The user who owns this product. Never sent to or accepted from the client.
    [JsonIgnore]
    public int OwnerId { get; set; }
}
