using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

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

    // Always limited to the logged-in user's categories.
    private IQueryable<Category> OwnCategories()
    {
        var ownerId = User.GetUserId();
        return _db.Categories.Where(c => c.OwnerId == ownerId);
    }

    // GET /api/categories
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CategoryDto>>> GetAll()
    {
        var ownerId = User.GetUserId();

        var categories = await OwnCategories()
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                ProductCount = _db.Products.Count(p => p.CategoryId == c.Id && p.OwnerId == ownerId),
            })
            .ToListAsync();

        return Ok(categories);
    }

    // POST /api/categories
    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create(CategoryInput input)
    {
        var ownerId = User.GetUserId();
        var name = input.Name.Trim();

        if (await OwnCategories().AnyAsync(c => c.Name == name))
            return Conflict(new { message = "You already have a category with this name." });

        var category = new Category { Name = name, OwnerId = ownerId };
        _db.Categories.Add(category);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            if (await OwnCategories().AnyAsync(c => c.Name == name))
                return Conflict(new { message = "You already have a category with this name." });
            throw;
        }

        return StatusCode(StatusCodes.Status201Created,
            new CategoryDto { Id = category.Id, Name = category.Name, ProductCount = 0 });
    }

    // PUT /api/categories/3
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, CategoryInput input)
    {
        var existing = await OwnCategories().FirstOrDefaultAsync(c => c.Id == id);
        if (existing is null)
            return NotFound(new { message = $"Category with id {id} was not found." });

        var name = input.Name.Trim();
        if (await OwnCategories().AnyAsync(c => c.Name == name && c.Id != id))
            return Conflict(new { message = "You already have a category with this name." });

        existing.Name = name;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/categories/3  (its products are kept, with no category)
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await OwnCategories().FirstOrDefaultAsync(c => c.Id == id);
        if (existing is null)
            return NotFound(new { message = $"Category with id {id} was not found." });

        _db.Categories.Remove(existing);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
