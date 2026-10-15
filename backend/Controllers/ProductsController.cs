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
    // An export never returns more than this many rows.
    private const int MaxExportRows = 10_000;

    private readonly AppDbContext _db;
    private readonly ImageStorage _images;

    public ProductsController(AppDbContext db, ImageStorage images)
    {
        _db = db;
        _images = images;
    }

    // The ONLY way this controller reads products: always limited to the logged-in user.
    private IQueryable<Product> OwnProducts()
    {
        var ownerId = User.GetUserId();
        return _db.Products.Where(p => p.OwnerId == ownerId);
    }

    // ---- Shared by the list and the CSV export, so both always agree on what "filtered" means ----

    private static bool PriceRangeInvalid(ProductQuery q) =>
        q.MinPrice.HasValue && q.MaxPrice.HasValue && q.MinPrice > q.MaxPrice;

    private static IQueryable<Product> ApplyFilters(IQueryable<Product> query, ProductQuery q)
    {
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            query = query.Where(p => p.Name.Contains(term) ||
                                     (p.Description != null && p.Description.Contains(term)));
        }

        if (q.CategoryId.HasValue) query = query.Where(p => p.CategoryId == q.CategoryId.Value);
        if (q.MinPrice.HasValue) query = query.Where(p => p.Price >= q.MinPrice.Value);
        if (q.MaxPrice.HasValue) query = query.Where(p => p.Price <= q.MaxPrice.Value);

        return q.Stock switch
        {
            "in" => query.Where(p => p.Quantity >= StockLevels.LowStockLimit),
            "low" => query.Where(p => p.Quantity > 0 && p.Quantity < StockLevels.LowStockLimit),
            "out" => query.Where(p => p.Quantity == 0),
            _ => query,
        };
    }

    // ThenBy(Id) keeps the order stable, so a row never jumps between pages.
    private static IQueryable<Product> ApplySort(IQueryable<Product> query, ProductQuery q)
    {
        var desc = q.SortDir == "desc";
        return (q.SortBy, desc) switch
        {
            ("name", false) => query.OrderBy(p => p.Name).ThenBy(p => p.Id),
            ("name", true) => query.OrderByDescending(p => p.Name).ThenBy(p => p.Id),
            ("price", false) => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
            ("price", true) => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            ("quantity", false) => query.OrderBy(p => p.Quantity).ThenBy(p => p.Id),
            ("quantity", true) => query.OrderByDescending(p => p.Quantity).ThenBy(p => p.Id),
            (_, true) => query.OrderByDescending(p => p.Id),
            _ => query.OrderBy(p => p.Id),
        };
    }

    // GET /api/products?search=&categoryId=&minPrice=&maxPrice=&stock=&sortBy=&sortDir=&page=&pageSize=
    [HttpGet]
    public async Task<ActionResult<PagedResult<Product>>> GetAll([FromQuery] ProductQuery q)
    {
        if (PriceRangeInvalid(q))
            return BadRequest(new { message = "Minimum price cannot be greater than maximum price." });

        IQueryable<Product> query = OwnProducts().AsNoTracking().Include(p => p.Category);
        query = ApplySort(ApplyFilters(query, q), q);

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

    // GET /api/products/export?search=&categoryId=&...   -> downloads a .csv file
    // Same filters and sorting as the list, but ALL matching rows (up to MaxExportRows), not one page.
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] ProductQuery q)
    {
        if (PriceRangeInvalid(q))
            return BadRequest(new { message = "Minimum price cannot be greater than maximum price." });

        IQueryable<Product> query = OwnProducts().AsNoTracking().Include(p => p.Category);
        query = ApplySort(ApplyFilters(query, q), q);

        // Ask for one extra row, so we know whether we had to cut the export short.
        var rows = await query.Take(MaxExportRows + 1).ToListAsync();
        var truncated = rows.Count > MaxExportRows;
        if (truncated) rows.RemoveAt(rows.Count - 1);

        var bytes = CsvFormatter.ToUtf8WithBom(CsvFormatter.BuildProductsCsv(rows));

        if (truncated) Response.Headers["X-Export-Truncated"] = "true";

        // File(...) adds "Content-Disposition: attachment; filename=..." so browsers treat it as a download.
        return File(bytes, "text/csv; charset=utf-8", $"products-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv");
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

        product.Id = 0;               // the database generates the id
        product.OwnerId = ownerId;    // taken from the token, never from the client
        product.Category = null;      // clients set CategoryId only, never a whole category object
        product.ImageFileName = null; // images are added only through the /image endpoint
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
        // OwnerId and ImageFileName are never changed here.

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

        var imageFile = existing.ImageFileName;

        _db.Products.Remove(existing);
        await _db.SaveChangesAsync();

        _images.Delete(imageFile); // remove the file only after the database row is gone
        return NoContent();
    }

    // POST /api/products/5/image   (multipart/form-data with a field named "file")
    [HttpPost("{id:int}/image")]
    [RequestSizeLimit(3 * 1024 * 1024)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadImage(int id, [FromForm] IFormFile file)
    {
        var product = await OwnProducts().FirstOrDefaultAsync(p => p.Id == id);
        if (product is null)
            return NotFound(new { message = $"Product with id {id} was not found." });

        var (fileName, error) = await _images.SaveAsync(file);
        if (fileName is null)
            return BadRequest(new { message = error });

        var oldFile = product.ImageFileName;
        product.ImageFileName = fileName;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch
        {
            _images.Delete(fileName); // don't leave an orphan file behind
            throw;
        }

        _images.Delete(oldFile); // the replaced image is no longer needed
        return Ok(new { imageFileName = fileName });
    }

    // DELETE /api/products/5/image
    [HttpDelete("{id:int}/image")]
    public async Task<IActionResult> DeleteImage(int id)
    {
        var product = await OwnProducts().FirstOrDefaultAsync(p => p.Id == id);
        if (product is null)
            return NotFound(new { message = $"Product with id {id} was not found." });

        var oldFile = product.ImageFileName;
        product.ImageFileName = null;
        await _db.SaveChangesAsync();

        _images.Delete(oldFile);
        return NoContent();
    }

    // null means "no category" (allowed). Otherwise the category must belong to the same user.
    private async Task<bool> CategoryBelongsToUser(int? categoryId, int ownerId)
    {
        if (!categoryId.HasValue) return true;
        return await _db.Categories.AnyAsync(c => c.Id == categoryId.Value && c.OwnerId == ownerId);
    }
}
