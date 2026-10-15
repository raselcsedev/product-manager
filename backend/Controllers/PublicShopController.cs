using System.Linq.Expressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;

namespace ProductApi.Controllers;

// No [Authorize] here: anyone can call these endpoints, so they are written defensively.
//  - they only ever read products the owner has published
//  - they return PublicProductDto (no private fields)
//  - an unpublished product and a product that does not exist give the SAME answer (404)
//  - every query value is validated and capped
//  - requests are rate limited per IP address
[EnableRateLimiting("public")]
[ApiController]
[Route("api/public")]
public class PublicShopController : ControllerBase
{
    private const int MaxRelated = 12;

    private readonly AppDbContext _db;

    public PublicShopController(AppDbContext db)
    {
        _db = db;
    }

    // The ONLY way this controller reads products.
    private IQueryable<Product> Published() => _db.Products.AsNoTracking().Where(p => p.IsPublished);

    // Product -> PublicProductDto, translated to SQL (so only these columns are read).
    private static readonly Expression<Func<Product, PublicProductDto>> ToDto = p => new PublicProductDto
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        Price = p.Price,
        Category = p.Category != null ? p.Category.Name : null,
        ImageFileName = p.ImageFileName,
        Availability = p.Quantity <= 0 ? "Out of stock"
                     : p.Quantity < StockLevels.LowStockLimit ? "Low stock"
                     : "In stock",
    };

    // GET /api/public/products
    [HttpGet("products")]
    public async Task<ActionResult<PagedResult<PublicProductDto>>> GetProducts([FromQuery] PublicProductQuery q)
    {
        IQueryable<Product> query = Published();

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            query = query.Where(p => p.Name.Contains(term) ||
                                     (p.Description != null && p.Description.Contains(term)));
        }

        // Categories belong to individual users, so the public shop filters by category NAME.
        if (!string.IsNullOrWhiteSpace(q.Category))
        {
            var categoryName = q.Category.Trim();
            query = query.Where(p => p.Category != null && p.Category.Name == categoryName);
        }

        query = q.Sort switch
        {
            "price_asc"  => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
            "price_desc" => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            "name_asc"   => query.OrderBy(p => p.Name).ThenBy(p => p.Id),
            _            => query.OrderByDescending(p => p.Id), // newest first
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(ToDto)
            .ToListAsync();

        return Ok(new PagedResult<PublicProductDto>
        {
            Items = items,
            Page = q.Page,
            PageSize = q.PageSize,
            TotalCount = totalCount,
        });
    }

    // GET /api/public/categories  (only categories that have at least one published product)
    [HttpGet("categories")]
    public async Task<ActionResult<IEnumerable<PublicCategoryDto>>> GetCategories()
    {
        var groups = await Published()
            .Where(p => p.Category != null)
            .GroupBy(p => p.Category!.Name)
            .Select(g => new PublicCategoryDto { Name = g.Key, ProductCount = g.Count() })
            .ToListAsync();

        return Ok(groups.OrderBy(c => c.Name).Take(100).ToList());
    }

    // GET /api/public/products/5
    [HttpGet("products/{id:int}")]
    public async Task<ActionResult<PublicProductDto>> GetProduct(int id)
    {
        var product = await Published().Where(p => p.Id == id).Select(ToDto).FirstOrDefaultAsync();

        return product is null ? NotFound(new { message = "This product is not available." }) : Ok(product);
    }

    // GET /api/public/products/5/related?limit=4
    // "Related" = published products in the same category first, then other products from the same seller.
    // (The seller is used for ranking only. It is never revealed.)
    [HttpGet("products/{id:int}/related")]
    public async Task<ActionResult<IEnumerable<PublicProductDto>>> GetRelated(int id, [FromQuery] int limit = 4)
    {
        limit = Math.Clamp(limit, 1, MaxRelated);

        var source = await Published()
            .Where(p => p.Id == id)
            .Select(p => new { p.OwnerId, CategoryName = p.Category != null ? p.Category.Name : null })
            .FirstOrDefaultAsync();

        if (source is null)
            return NotFound(new { message = "This product is not available." });

        var sellerId = source.OwnerId;
        var categoryName = source.CategoryName;

        IQueryable<Product> candidates = Published().Where(p => p.Id != id);

        List<PublicProductDto> related;
        if (categoryName is null)
        {
            // No category: the only thing we can relate by is the seller.
            related = await candidates
                .Where(p => p.OwnerId == sellerId)
                .OrderByDescending(p => p.Id)
                .Take(limit)
                .Select(ToDto)
                .ToListAsync();
        }
        else
        {
            related = await candidates
                .Where(p => p.OwnerId == sellerId || (p.Category != null && p.Category.Name == categoryName))
                .OrderByDescending(p => p.Category != null && p.Category.Name == categoryName) // same category first
                .ThenByDescending(p => p.OwnerId == sellerId)                                  // then same seller
                .ThenByDescending(p => p.Id)                                                   // then newest
                .Take(limit)
                .Select(ToDto)
                .ToListAsync();
        }

        return Ok(related);
    }
}
