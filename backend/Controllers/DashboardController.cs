using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]   // -> /api/dashboard
public class DashboardController : ControllerBase
{
    // The chart shows the biggest categories only, so it stays readable.
    private const int MaxCategories = 8;

    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/dashboard/charts  (numbers for the dashboard charts, only for the logged-in user)
    [HttpGet("charts")]
    public async Task<ActionResult<DashboardCharts>> GetCharts()
    {
        var ownerId = User.GetUserId();
        var products = _db.Products.AsNoTracking().Where(p => p.OwnerId == ownerId);

        // 1. How many products are in each stock state?
        var inStock = await products.CountAsync(p => p.Quantity >= StockLevels.LowStockLimit);
        var lowStock = await products.CountAsync(p => p.Quantity > 0 && p.Quantity < StockLevels.LowStockLimit);
        var outOfStock = await products.CountAsync(p => p.Quantity == 0);

        // 2. Totals per category. The database does the grouping and adding (GROUP BY),
        //    so we never download every product just to add numbers up.
        var groups = await products
            .GroupBy(p => p.CategoryId)
            .Select(g => new
            {
                CategoryId = g.Key,
                ProductCount = g.Count(),
                Units = g.Sum(p => (long)p.Quantity),
                Value = g.Sum(p => p.Price * p.Quantity),
            })
            .ToListAsync();

        // 3. Category names (only this user's categories)
        var names = await _db.Categories
            .AsNoTracking()
            .Where(c => c.OwnerId == ownerId)
            .ToDictionaryAsync(c => c.Id, c => c.Name);

        var categories = groups
            .Select(g => new CategoryStat
            {
                Name = g.CategoryId is int id ? names.GetValueOrDefault(id, "Unknown") : "Uncategorized",
                ProductCount = g.ProductCount,
                Units = g.Units,
                Value = g.Value,
            })
            .OrderByDescending(c => c.Value)
            .ThenBy(c => c.Name)
            .Take(MaxCategories)
            .ToList();

        return Ok(new DashboardCharts
        {
            StockStatus = new StockStatusCounts
            {
                InStock = inStock,
                LowStock = lowStock,
                OutOfStock = outOfStock,
                LowStockLimit = StockLevels.LowStockLimit,
            },
            Categories = categories,
        });
    }
}
