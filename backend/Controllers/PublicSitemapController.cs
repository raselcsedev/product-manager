using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;

namespace ProductApi.Controllers;

// Public, like the rest of /api/public. Search engines want a list of every public page
// (a "sitemap"), and the website builds it from this endpoint.
[EnableRateLimiting("public")]
[ApiController]
[Route("api/public/sitemap")]
public class PublicSitemapController : ControllerBase
{
    // A sitemap file may list at most 50,000 addresses. We stay well below that.
    private const int MaxProducts = 5000;
    private const int MaxShops = 1000;

    private readonly AppDbContext _db;

    public PublicSitemapController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/public/sitemap
    [HttpGet]
    public async Task<ActionResult<PublicSitemapDto>> Get()
    {
        // Only PUBLISHED products, and only shops that have at least one of them.
        var productIds = await _db.Products
            .AsNoTracking()
            .Where(p => p.IsPublished)
            .OrderByDescending(p => p.Id)
            .Select(p => p.Id)
            .Take(MaxProducts)
            .ToListAsync();

        var shopSlugs = await _db.Users
            .AsNoTracking()
            .Where(u => u.ShopSlug != null)
            .Where(u => _db.Products.Any(p => p.OwnerId == u.Id && p.IsPublished))
            .OrderBy(u => u.ShopSlug)
            .Select(u => u.ShopSlug!)
            .Take(MaxShops)
            .ToListAsync();

        return Ok(new PublicSitemapDto { ProductIds = productIds, ShopSlugs = shopSlugs });
    }
}
