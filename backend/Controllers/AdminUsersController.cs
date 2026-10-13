using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Controllers;

// Only users whose role is Admin can reach ANY endpoint in this controller.
// Everyone else gets 403 Forbidden (and 401 if not logged in).
[Authorize(Roles = Roles.Admin)]
[ApiController]
[Route("api/admin/users")]
public class AdminUsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ImageStorage _images;

    public AdminUsersController(AppDbContext db, ImageStorage images)
    {
        _db = db;
        _images = images;
    }

    // GET /api/admin/users
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminUserDto>>> GetAll()
    {
        var users = await _db.Users
            .AsNoTracking()
            .OrderBy(u => u.Id)
            .Select(u => new AdminUserDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Role = u.Role,
                CreatedAt = u.CreatedAt,
                ProductCount = _db.Products.Count(p => p.OwnerId == u.Id),
                CategoryCount = _db.Categories.Count(c => c.OwnerId == u.Id),
            })
            .ToListAsync();

        return Ok(users);
    }

    // PUT /api/admin/users/3/role   body: { "role": "Admin" }
    [HttpPut("{id:int}/role")]
    public async Task<IActionResult> UpdateRole(int id, UpdateRoleRequest request)
    {
        // Safety rule: you cannot change your own role. This guarantees at least one admin always remains.
        if (id == User.GetUserId())
            return BadRequest(new { message = "You cannot change your own role." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return NotFound(new { message = $"User with id {id} was not found." });

        user.Role = request.Role;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/admin/users/3  (also deletes that user's products, categories and image files)
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id == User.GetUserId())
            return BadRequest(new { message = "You cannot delete your own account." });

        if (!await _db.Users.AnyAsync(u => u.Id == id))
            return NotFound(new { message = $"User with id {id} was not found." });

        // Remember the image files first, because the rows are about to disappear.
        var imageFiles = await _db.Products
            .Where(p => p.OwnerId == id && p.ImageFileName != null)
            .Select(p => p.ImageFileName!)
            .ToListAsync();

        // One transaction: either everything is deleted, or nothing is.
        await using (var transaction = await _db.Database.BeginTransactionAsync())
        {
            await _db.Products.Where(p => p.OwnerId == id).ExecuteDeleteAsync();
            await _db.Categories.Where(c => c.OwnerId == id).ExecuteDeleteAsync();
            await _db.Users.Where(u => u.Id == id).ExecuteDeleteAsync();
            await transaction.CommitAsync();
        }

        // Only after the database commit succeeded do we delete the files.
        foreach (var file in imageFiles) _images.Delete(file);

        return NoContent();
    }
}
