using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Controllers;

// The logged-in seller manages THEIR OWN shop page. The user always comes from the token.
[Authorize]
[ApiController]
[Route("api/my-shop")]
public class MyShopController : ControllerBase
{
    private readonly AppDbContext _db;

    public MyShopController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/my-shop
    [HttpGet]
    public async Task<ActionResult<MyShopDto>> Get()
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == User.GetUserId());
        if (user is null)
            return Unauthorized(new { message = "User no longer exists." });

        return Ok(await BuildAsync(user));
    }

    // PUT /api/my-shop   (creates the shop page, or changes it)
    [HttpPut]
    public async Task<ActionResult<MyShopDto>> Save(MyShopRequest request)
    {
        var me = User.GetUserId();
        var slug = request.ShopSlug;

        // The address must be unique. (Your own current address does not count as taken.)
        if (await _db.Users.AnyAsync(u => u.ShopSlug == slug && u.Id != me))
            return Conflict(new { message = "This shop address is already taken. Please choose another." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == me);
        if (user is null)
            return Unauthorized(new { message = "User no longer exists." });

        user.ShopName = request.ShopName.Trim();
        user.ShopSlug = slug;
        user.ShopDescription = string.IsNullOrWhiteSpace(request.ShopDescription) ? null : request.ShopDescription.Trim();

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Two people choosing the same address at the same moment: the unique index stops the second one.
            if (await _db.Users.AnyAsync(u => u.ShopSlug == slug && u.Id != me))
                return Conflict(new { message = "This shop address is already taken. Please choose another." });
            throw;
        }

        return Ok(await BuildAsync(user));
    }

    // DELETE /api/my-shop   (turns the shop page off. Your products and their published state are untouched.)
    [HttpDelete]
    public async Task<IActionResult> Remove()
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == User.GetUserId());
        if (user is null)
            return Unauthorized(new { message = "User no longer exists." });

        user.ShopName = null;
        user.ShopSlug = null;
        user.ShopDescription = null;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    private async Task<MyShopDto> BuildAsync(AppUser user) => new()
    {
        ShopName = user.ShopName,
        ShopSlug = user.ShopSlug,
        ShopDescription = user.ShopDescription,
        PublishedProductCount = await _db.Products.CountAsync(p => p.OwnerId == user.Id && p.IsPublished),
    };
}
