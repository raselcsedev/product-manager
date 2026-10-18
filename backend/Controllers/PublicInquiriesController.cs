using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;

namespace ProductApi.Controllers;

// The one public endpoint where a stranger WRITES to the database, so it has several layers of protection:
//  1. a strict per-IP rate limit ("inquiry" policy, set in Program.cs)
//  2. strict validation of every field
//  3. a hidden "honeypot" field that only bots fill in
//  4. a limit on links in the message (spam is mostly links)
//  5. a cap on how many messages one email address can send to one seller per day
//  6. a repeated identical message (a double click) is ignored instead of stored twice
//  7. only PUBLISHED products accept messages, and the answer never reveals who the seller is
[EnableRateLimiting("inquiry")]
[ApiController]
[Route("api/public/products/{productId:int}/inquiries")]
public class PublicInquiriesController : ControllerBase
{
    private const int MaxPerSenderPerDay = 3;
    private const int MaxLinks = 2;

    private static readonly Regex LinkPattern = new(@"https?://|www\.", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly AppDbContext _db;

    public PublicInquiriesController(AppDbContext db)
    {
        _db = db;
    }

    // POST /api/public/products/5/inquiries
    [HttpPost]
    public async Task<IActionResult> Send(int productId, InquiryRequest request)
    {
        // Layer 3: a bot filled in the hidden field. Pretend it worked, so the bot learns nothing.
        if (!string.IsNullOrWhiteSpace(request.CompanyWebsite))
            return Sent();

        var name = request.Name.Trim();
        var email = request.Email.Trim().ToLowerInvariant();
        var message = request.Message.Replace("\r\n", "\n").Trim();

        // The attributes count spaces, so check the real lengths again after trimming.
        if (name.Length < 2)
            return BadRequest(new { message = "Your name must be at least 2 characters." });
        if (message.Length < 10)
            return BadRequest(new { message = "Your message must be at least 10 characters." });

        // Layer 4
        if (LinkPattern.Matches(message).Count > MaxLinks)
            return BadRequest(new { message = "Please remove the links from your message." });

        // Layer 7: unpublished and unknown products give the same answer
        var product = await _db.Products
            .AsNoTracking()
            .Where(p => p.Id == productId && p.IsPublished)
            .Select(p => new { p.Id, p.Name, p.OwnerId })
            .FirstOrDefaultAsync();

        if (product is null)
            return NotFound(new { message = "This product is not available." });

        var since = DateTime.UtcNow.AddHours(-24);

        // Layer 6: the exact same message again (a double click): accept it, but do not store it twice
        var duplicate = await _db.Inquiries.AnyAsync(i =>
            i.OwnerId == product.OwnerId && i.SenderEmail == email && i.Message == message && i.CreatedAt > since);
        if (duplicate)
            return Sent();

        // Layer 5: stop one address from flooding one seller's inbox
        var sentToday = await _db.Inquiries.CountAsync(i =>
            i.OwnerId == product.OwnerId && i.SenderEmail == email && i.CreatedAt > since);
        if (sentToday >= MaxPerSenderPerDay)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new { message = "You have already sent this seller several messages today. Please wait for their reply." });
        }

        _db.Inquiries.Add(new Inquiry
        {
            OwnerId = product.OwnerId,
            ProductId = product.Id,
            ProductName = product.Name,
            SenderName = name,
            SenderEmail = email,
            Message = message,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        return Sent();
    }

    // Always the same small answer: it says nothing about the seller.
    private ObjectResult Sent() =>
        StatusCode(StatusCodes.Status201Created, new { message = "Your message was sent. The seller can reply to your email address." });
}
