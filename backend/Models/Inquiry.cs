using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

// A message a visitor sent to a seller about one of their products.
public class Inquiry
{
    public int Id { get; set; }

    // The seller who receives the message
    public int OwnerId { get; set; }

    // The product the visitor asked about. Null once that product has been deleted.
    public int? ProductId { get; set; }

    // A copy of the product name, so the message still makes sense after the product is gone
    [StringLength(100)]
    public string ProductName { get; set; } = string.Empty;

    [StringLength(100)]
    public string SenderName { get; set; } = string.Empty;

    [StringLength(255)]
    public string SenderEmail { get; set; } = string.Empty;

    [StringLength(2000)]
    public string Message { get; set; } = string.Empty;

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; }
}

// What a visitor sends: POST /api/public/products/5/inquiries
public class InquiryRequest
{
    // Letters, digits and . _ % + - only. This deliberately rejects characters such as ? & = and spaces,
    // so a stored address can never smuggle extra "mailto:" settings (cc, bcc, subject ...) into the
    // "Reply" link the seller clicks.
    public const string EmailPattern = @"^[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$";

    [Required(ErrorMessage = "Your name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Your name must be between 2 and 100 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Your email is required.")]
    [StringLength(255, ErrorMessage = "Your email must be 255 characters or fewer.")]
    [RegularExpression(EmailPattern, ErrorMessage = "Enter a valid email address.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Your message is required.")]
    [StringLength(2000, MinimumLength = 10, ErrorMessage = "Your message must be between 10 and 2000 characters.")]
    public string Message { get; set; } = string.Empty;

    // A "honeypot": the website hides this field from people. Only a bot that fills in every field fills this one.
    [StringLength(200)]
    public string? CompanyWebsite { get; set; }
}

// What the seller sees in the inbox
public class InquiryDto
{
    public int Id { get; set; }
    public int? ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

// GET /api/inquiries?unread=true&page=1&pageSize=20
public class InquiryListQuery
{
    public bool? Unread { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Page must be 1 or more.")]
    public int Page { get; set; } = 1;

    [Range(1, 50, ErrorMessage = "PageSize must be between 1 and 50.")]
    public int PageSize { get; set; } = 20;
}

public class SetReadRequest
{
    public bool IsRead { get; set; }
}

public class UnreadCountDto
{
    public int Count { get; set; }
}
