using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

// What the public (not logged in) shop is allowed to see.
// It is a separate class ON PURPOSE: a field that is not in here can never leak by accident.
// There is no owner id, no account name or email, and no exact stock quantity.
// ShopName / ShopSlug are only filled in when the seller has chosen to have a shop page.
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

    public string? ShopName { get; set; }
    public string? ShopSlug { get; set; }
}

public class PublicCategoryDto
{
    public string Name { get; set; } = string.Empty;
    public int ProductCount { get; set; }
}

// A seller's public shop page
public class PublicShopDto
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int ProductCount { get; set; }   // published products only
}

// GET /api/public/products?search=lamp&category=Home&shop=my-shop&sort=price_asc&page=1&pageSize=12
public class PublicProductQuery
{
    [StringLength(100, ErrorMessage = "Search text must be 100 characters or fewer.")]
    public string? Search { get; set; }

    [StringLength(50, ErrorMessage = "Category must be 50 characters or fewer.")]
    public string? Category { get; set; }

    // Only show the products of one seller's shop
    [StringLength(40, ErrorMessage = "Shop must be 40 characters or fewer.")]
    [RegularExpression("^[a-z0-9]+(-[a-z0-9]+)*$", ErrorMessage = "Shop can only contain lowercase letters, numbers and hyphens.")]
    public string? Shop { get; set; }

    [RegularExpression("^(newest|price_asc|price_desc|name_asc)$", ErrorMessage = "Sort must be newest, price_asc, price_desc or name_asc.")]
    public string Sort { get; set; } = "newest";

    [Range(1, int.MaxValue, ErrorMessage = "Page must be 1 or more.")]
    public int Page { get; set; } = 1;

    [Range(1, 48, ErrorMessage = "PageSize must be between 1 and 48.")]
    public int PageSize { get; set; } = 12;
}
