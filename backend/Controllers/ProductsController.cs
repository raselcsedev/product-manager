using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;

namespace ProductApi.Controllers;

[Authorize]                   // every endpoint below requires a valid JWT (401 otherwise)
[ApiController]
[Route("api/[controller]")]   // -> /api/products
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProductsController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/products?search=&minPrice=&maxPrice=&stock=&sortBy=&sortDir=&page=&pageSize=
    [HttpGet]
    public async Task<ActionResult<PagedResult<Product>>> GetAll([FromQuery] ProductQuery q)
    {
        if (q.MinPrice.HasValue && q.MaxPrice.HasValue && q.MinPrice > q.MaxPrice)
            return BadRequest(new { message = "Minimum price cannot be greater than maximum price." });

        // 1. Start with "all products" (nothing has hit the database yet)
        IQueryable<Product> query = _db.Products.AsNoTracking();

        // 2. Add filters one by one. Each Where() just adds to the SQL that will be built.
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            query = query.Where(p => p.Name.Contains(term) ||
                                     (p.Description != null && p.Description.Contains(term)));
        }

        if (q.MinPrice.HasValue) query = query.Where(p => p.Price >= q.MinPrice.Value);
        if (q.MaxPrice.HasValue) query = query.Where(p => p.Price <= q.MaxPrice.Value);

        query = q.Stock switch
        {
            "in"  => query.Where(p => p.Quantity > 0),
            "low" => query.Where(p => p.Quantity > 0 && p.Quantity < StockLevels.LowStockLimit),
            "out" => query.Where(p => p.Quantity == 0),
            _     => query,
        };

        // 3. Sorting. ThenBy(Id) keeps the order stable so a row never jumps between pages.
        var desc = q.SortDir == "desc";
        query = (q.SortBy, desc) switch
        {
            ("name", false)     => query.OrderBy(p => p.Name).ThenBy(p => p.Id),
            ("name", true)      => query.OrderByDescending(p => p.Name).ThenBy(p => p.Id),
            ("price", false)    => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
            ("price", true)     => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            ("quantity", false) => query.OrderBy(p => p.Quantity).ThenBy(p => p.Id),
            ("quantity", true)  => query.OrderByDescending(p => p.Quantity).ThenBy(p => p.Id),
            (_, true)           => query.OrderByDescending(p => p.Id),
            _                   => query.OrderBy(p => p.Id),
        };

        // 4. Count ALL matches first (for "Page 2 of 5"), then fetch only one page of rows.
        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .ToListAsync();

        return Ok(new PagedResult<Product>
        {
            Items = items,
            Page = q.Page,
            PageSize = q.PageSize,
            TotalCount = totalCount,
        });
    }

    // GET /api/products/summary  (numbers for the dashboard, calculated by the database)
    [HttpGet("summary")]
    public async Task<ActionResult<ProductSummary>> GetSummary()
    {
        var totalProducts = await _db.Products.CountAsync();
        var totalUnits = await _db.Products.SumAsync(p => (long?)p.Quantity) ?? 0;
        var inventoryValue = await _db.Products.SumAsync(p => (decimal?)(p.Price * p.Quantity)) ?? 0m;

        var lowStockCount = await _db.Products.CountAsync(p => p.Quantity < StockLevels.LowStockLimit);
        var lowStock = await _db.Products.AsNoTracking()
            .Where(p => p.Quantity < StockLevels.LowStockLimit)
            .OrderBy(p => p.Quantity).ThenBy(p => p.Id)
            .Take(5)
            .ToListAsync();

        return Ok(new ProductSummary
        {
            TotalProducts = totalProducts,
            TotalUnits = totalUnits,
            InventoryValue = inventoryValue,
            LowStockLimit = StockLevels.LowStockLimit,
            LowStockCount = lowStockCount,
            LowStock = lowStock,
        });
    }

    // GET /api/products/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Product>> GetById(int id)
    {
        var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        if (product is null)
            return NotFound(new { message = $"Product with id {id} was not found." });

        return Ok(product);
    }

    // POST /api/products
    [HttpPost]
    public async Task<ActionResult<Product>> Create(Product product)
    {
        product.Id = 0; // the database generates the id
        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    // PUT /api/products/5
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, Product input)
    {
        if (id != input.Id)
            return BadRequest(new { message = "The id in the URL does not match the id in the request body." });

        var existing = await _db.Products.FindAsync(id);
        if (existing is null)
            return NotFound(new { message = $"Product with id {id} was not found." });

        existing.Name = input.Name;
        existing.Description = input.Description;
        existing.Price = input.Price;
        existing.Quantity = input.Quantity;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/products/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await _db.Products.FindAsync(id);
        if (existing is null)
            return NotFound(new { message = $"Product with id {id} was not found." });

        _db.Products.Remove(existing);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
