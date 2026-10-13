using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

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

    // The ONLY way this controller reads products: always limited to the logged-in user.
    private IQueryable<Product> OwnProducts()
    {
        var ownerId = User.GetUserId();
        return _db.Products.Where(p => p.OwnerId == ownerId);
    }

    // GET /api/products?search=&categoryId=&minPrice=&maxPrice=&stock=&sortBy=&sortDir=&page=&pageSize=
    [HttpGet]
    public async Task<ActionResult<PagedResult<Product>>> GetAll([FromQuery] ProductQuery q)
    {
        if (q.MinPrice.HasValue && q.MaxPrice.HasValue && q.MinPrice > q.MaxPrice)
            return BadRequest(new { message = "Minimum price cannot be greater than maximum price." });

        IQueryable<Product> query = OwnProducts().AsNoTracking().Include(p => p.Category);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            query = query.Where(p => p.Name.Contains(term) ||
                                     (p.Description != null && p.Description.Contains(term)));
        }

        if (q.CategoryId.HasValue) query = query.Where(p => p.CategoryId == q.CategoryId.Value);
        if (q.MinPrice.HasValue) query = query.Where(p => p.Price >= q.MinPrice.Value);
        if (q.MaxPrice.HasValue) query = query.Where(p => p.Price <= q.MaxPrice.Value);

        query = q.Stock switch
        {
            "in"  => query.Where(p => p.Quantity > 0),
            "low" => query.Where(p => p.Quantity > 0 && p.Quantity < StockLevels.LowStockLimit),
            "out" => query.Where(p => p.Quantity == 0),
            _     => query,
        };

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

    // GET /api/products/summary  (the logged-in user's dashboard numbers)
    [HttpGet("summary")]
    public async Task<ActionResult<ProductSummary>> GetSummary()
    {
        var totalProducts = await OwnProducts().CountAsync();
        var totalUnits = await OwnProducts().SumAsync(p => (long?)p.Quantity) ?? 0;
        var inventoryValue = await OwnProducts().SumAsync(p => (decimal?)(p.Price * p.Quantity)) ?? 0m;

        var lowStockCount = await OwnProducts().CountAsync(p => p.Quantity < StockLevels.LowStockLimit);
        var lowStock = await OwnProducts().AsNoTracking()
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
        // Someone else's product gives 404 (not 403), so nobody can tell it exists.
        var product = await OwnProducts()
            .AsNoTracking()
            .Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return NotFound(new { message = $"Product with id {id} was not found." });

        return Ok(product);
    }

    // POST /api/products
    [HttpPost]
    public async Task<ActionResult<Product>> Create(Product product)
    {
        var ownerId = User.GetUserId();

        if (!await CategoryBelongsToUser(product.CategoryId, ownerId))
            return BadRequest(new { message = "The selected category does not exist." });

        product.Id = 0;              // the database generates the id
        product.OwnerId = ownerId;   // taken from the token, never from the client
        product.Category = null;     // clients set CategoryId only, never a whole category object
        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        if (product.CategoryId.HasValue)
            await _db.Entry(product).Reference(p => p.Category).LoadAsync();

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    // PUT /api/products/5
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, Product input)
    {
        var ownerId = User.GetUserId();

        if (id != input.Id)
            return BadRequest(new { message = "The id in the URL does not match the id in the request body." });

        if (!await CategoryBelongsToUser(input.CategoryId, ownerId))
            return BadRequest(new { message = "The selected category does not exist." });

        var existing = await OwnProducts().FirstOrDefaultAsync(p => p.Id == id);
        if (existing is null)
            return NotFound(new { message = $"Product with id {id} was not found." });

        existing.Name = input.Name;
        existing.Description = input.Description;
        existing.Price = input.Price;
        existing.Quantity = input.Quantity;
        existing.CategoryId = input.CategoryId;
        // OwnerId is never changed here.

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/products/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await OwnProducts().FirstOrDefaultAsync(p => p.Id == id);
        if (existing is null)
            return NotFound(new { message = $"Product with id {id} was not found." });

        _db.Products.Remove(existing);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // null means "no category" (allowed). Otherwise the category must belong to the same user.
    private async Task<bool> CategoryBelongsToUser(int? categoryId, int ownerId)
    {
        if (!categoryId.HasValue) return true;
        return await _db.Categories.AnyAsync(c => c.Id == categoryId.Value && c.OwnerId == ownerId);
    }
}
