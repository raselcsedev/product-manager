using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;

namespace ProductApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]   // -> /api/categories
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public CategoriesController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/categories
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CategoryDto>>> GetAll()
    {
        var categories = await _db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                ProductCount = _db.Products.Count(p => p.CategoryId == c.Id),
            })
            .ToListAsync();

        return Ok(categories);
    }

    // POST /api/categories
    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create(CategoryInput input)
    {
        var name = input.Name.Trim();

        if (await _db.Categories.AnyAsync(c => c.Name == name))
            return Conflict(new { message = "A category with this name already exists." });

        var category = new Category { Name = name };
        _db.Categories.Add(category);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            if (await _db.Categories.AnyAsync(c => c.Name == name))
                return Conflict(new { message = "A category with this name already exists." });
            throw;
        }

        return StatusCode(StatusCodes.Status201Created,
            new CategoryDto { Id = category.Id, Name = category.Name, ProductCount = 0 });
    }

    // PUT /api/categories/3
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, CategoryInput input)
    {
        var existing = await _db.Categories.FindAsync(id);
        if (existing is null)
            return NotFound(new { message = $"Category with id {id} was not found." });

        var name = input.Name.Trim();
        if (await _db.Categories.AnyAsync(c => c.Name == name && c.Id != id))
            return Conflict(new { message = "A category with this name already exists." });

        existing.Name = name;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/categories/3  (its products are kept, with no category)
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await _db.Categories.FindAsync(id);
        if (existing is null)
            return NotFound(new { message = $"Category with id {id} was not found." });

        _db.Categories.Remove(existing);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
