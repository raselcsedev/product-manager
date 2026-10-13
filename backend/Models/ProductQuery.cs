using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

public static class StockLevels
{
    // A product with fewer units than this (but more than zero) counts as "low stock".
    public const int LowStockLimit = 10;
}

// Everything the frontend can send in the query string:
// GET /api/products?search=mouse&stock=low&sortBy=price&sortDir=desc&page=2&pageSize=10
public class ProductQuery
{
    public string? Search { get; set; }

    [Range(0, 999999999, ErrorMessage = "Minimum price cannot be negative.")]
    public decimal? MinPrice { get; set; }

    [Range(0, 999999999, ErrorMessage = "Maximum price cannot be negative.")]
    public decimal? MaxPrice { get; set; }

    [RegularExpression("^(all|in|low|out)$", ErrorMessage = "Stock must be all, in, low or out.")]
    public string Stock { get; set; } = "all";

    [RegularExpression("^(id|name|price|quantity)$", ErrorMessage = "SortBy must be id, name, price or quantity.")]
    public string SortBy { get; set; } = "id";

    [RegularExpression("^(asc|desc)$", ErrorMessage = "SortDir must be asc or desc.")]
    public string SortDir { get; set; } = "asc";

    [Range(1, int.MaxValue, ErrorMessage = "Page must be 1 or more.")]
    public int Page { get; set; } = 1;

    [Range(1, 50, ErrorMessage = "PageSize must be between 1 and 50.")]
    public int PageSize { get; set; } = 10;
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public class ProductSummary
{
    public int TotalProducts { get; set; }
    public long TotalUnits { get; set; }
    public decimal InventoryValue { get; set; }
    public int LowStockLimit { get; set; }
    public int LowStockCount { get; set; }
    public List<Product> LowStock { get; set; } = new();
}
