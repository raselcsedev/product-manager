using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;

namespace ProductApi.Controllers;

[Authorize]                   // every endpoint below now requires a valid JWT (401 otherwise)
[ApiController]
[Route("api/[controller]")]   // -> /api/products
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProductsController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/products
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Product>>> GetAll()
    {
        var products = await _db.Products.AsNoTracking().OrderBy(p => p.Id).ToListAsync();
        return Ok(products);
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
