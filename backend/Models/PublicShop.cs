using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

// What the public (not logged in) shop is allowed to see.
// It is a separate class ON PURPOSE: a field that is not in here can never leak by accident.
// There is no owner id, no seller name or email, and no exact stock quantity.
public class PublicProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? Category { get; set; }
    public string? ImageFileName { get; set; }

    // "In stock", "Low stock" or "Out of stock" instead of the exact number
    public string Availability { get; set; } = string.Empty;
}

public class PublicCategoryDto
{
    public string Name { get; set; } = string.Empty;
    public int ProductCount { get; set; }
}

// GET /api/public/products?search=lamp&category=Home&sort=price_asc&page=1&pageSize=12
public class PublicProductQuery
{
    [StringLength(100, ErrorMessage = "Search text must be 100 characters or fewer.")]
    public string? Search { get; set; }

    [StringLength(50, ErrorMessage = "Category must be 50 characters or fewer.")]
    public string? Category { get; set; }

    [RegularExpression("^(newest|price_asc|price_desc|name_asc)$", ErrorMessage = "Sort must be newest, price_asc, price_desc or name_asc.")]
    public string Sort { get; set; } = "newest";

    [Range(1, int.MaxValue, ErrorMessage = "Page must be 1 or more.")]
    public int Page { get; set; } = 1;

    [Range(1, 48, ErrorMessage = "PageSize must be between 1 and 48.")]
    public int PageSize { get; set; } = 12;
}
