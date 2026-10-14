using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]   // -> /api/activity
public class ActivityController : ControllerBase
{
    private readonly AppDbContext _db;

    public ActivityController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/activity?scope=mine|all&entityType=&action=&page=&pageSize=
    [HttpGet]
    public async Task<ActionResult<PagedResult<AuditLogDto>>> Get([FromQuery] ActivityQuery q)
    {
        var isAdmin = User.IsInRole(Roles.Admin);

        // Regular users only ever see their own history. "all" is for admins.
        if (q.Scope == "all" && !isAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only admins can see everyone's activity." });

        IQueryable<AuditLog> query = _db.AuditLogs.AsNoTracking();

        if (q.Scope != "all")
        {
            var userId = User.GetUserId();
            query = query.Where(a => a.UserId == userId);
        }

        if (q.EntityType != "all") query = query.Where(a => a.EntityType == q.EntityType);
        if (q.Action != "all") query = query.Where(a => a.Action == q.Action);

        // Newest first. Id breaks ties between rows saved in the same instant.
        query = query.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(a => new AuditLogDto
            {
                Id = a.Id,
                UserId = a.UserId,
                ActorName = a.ActorName,
                Action = a.Action,
                EntityType = a.EntityType,
                EntityId = a.EntityId,
                EntityName = a.EntityName,
                Details = a.Details,
                CreatedAt = a.CreatedAt,
            })
            .ToListAsync();

        return Ok(new PagedResult<AuditLogDto>
        {
            Items = items,
            Page = q.Page,
            PageSize = q.PageSize,
            TotalCount = totalCount,
        });
    }
}
