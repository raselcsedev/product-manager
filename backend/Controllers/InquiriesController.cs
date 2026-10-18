using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Controllers;

// The seller's inbox. Every query starts from "my inquiries", so you can never read, change or
// delete another seller's messages (they simply do not exist as far as you can tell: 404).
[Authorize]
[ApiController]
[Route("api/inquiries")]
public class InquiriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public InquiriesController(AppDbContext db)
    {
        _db = db;
    }

    private IQueryable<Inquiry> OwnInquiries()
    {
        var ownerId = User.GetUserId();
        return _db.Inquiries.Where(i => i.OwnerId == ownerId);
    }

    // GET /api/inquiries?unread=true&page=1&pageSize=20
    [HttpGet]
    public async Task<ActionResult<PagedResult<InquiryDto>>> GetAll([FromQuery] InquiryListQuery q)
    {
        IQueryable<Inquiry> query = OwnInquiries().AsNoTracking();

        if (q.Unread == true)
            query = query.Where(i => !i.IsRead);

        query = query.OrderByDescending(i => i.CreatedAt).ThenByDescending(i => i.Id);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(i => new InquiryDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                ProductName = i.ProductName,
                SenderName = i.SenderName,
                SenderEmail = i.SenderEmail,
                Message = i.Message,
                IsRead = i.IsRead,
                CreatedAt = i.CreatedAt,
            })
            .ToListAsync();

        return Ok(new PagedResult<InquiryDto>
        {
            Items = items,
            Page = q.Page,
            PageSize = q.PageSize,
            TotalCount = totalCount,
        });
    }

    // GET /api/inquiries/unread-count  (for the number next to "Inbox" in the sidebar)
    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountDto>> GetUnreadCount()
    {
        var count = await OwnInquiries().CountAsync(i => !i.IsRead);
        return Ok(new UnreadCountDto { Count = count });
    }

    // PUT /api/inquiries/5/read   body: { "isRead": true }
    [HttpPut("{id:int}/read")]
    public async Task<IActionResult> SetRead(int id, SetReadRequest request)
    {
        var inquiry = await OwnInquiries().FirstOrDefaultAsync(i => i.Id == id);
        if (inquiry is null)
            return NotFound(new { message = $"Message with id {id} was not found." });

        inquiry.IsRead = request.IsRead;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // PUT /api/inquiries/read-all
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        await OwnInquiries()
            .Where(i => !i.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.IsRead, true));

        return NoContent();
    }

    // DELETE /api/inquiries/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var inquiry = await OwnInquiries().FirstOrDefaultAsync(i => i.Id == id);
        if (inquiry is null)
            return NotFound(new { message = $"Message with id {id} was not found." });

        _db.Inquiries.Remove(inquiry);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
