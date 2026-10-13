using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ProductApi.Models;

// The database table
public class Category
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Category name is required.")]
    [StringLength(50, ErrorMessage = "Category name must be 50 characters or fewer.")]
    public string Name { get; set; } = string.Empty;

    // The user who owns this category (set by the server, hidden from JSON)
    [JsonIgnore]
    public int OwnerId { get; set; }
}

// What the client sends when creating or renaming a category
public class CategoryInput
{
    [Required(ErrorMessage = "Category name is required.")]
    [StringLength(50, ErrorMessage = "Category name must be 50 characters or fewer.")]
    public string Name { get; set; } = string.Empty;
}

// What the API returns
public class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int ProductCount { get; set; }
}
