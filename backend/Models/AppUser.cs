using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

public class AppUser
{
    public int Id { get; set; }

    [Required, StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(255)]
    public string Email { get; set; } = string.Empty;

    // Never the plain password: only the BCrypt hash is stored.
    [Required, StringLength(255)]
    public string PasswordHash { get; set; } = string.Empty;

    // "Admin" or "User"
    [Required, StringLength(20)]
    public string Role { get; set; } = Roles.User;

    public DateTime CreatedAt { get; set; }

    // Every login token carries the version it was made with. Changing or resetting the password adds 1,
    // so all older tokens (on every other device) stop working at once.
    public int TokenVersion { get; set; }

    // true = do NOT email this user when a visitor writes to them.
    // (Stored as "mute" on purpose: the default, false, then means "notifications are on",
    // which is also what every existing account gets when the column is added.)
    public bool MuteInquiryEmails { get; set; }

    // When the last "you have a new message" email was sent. Used to send at most one every few minutes.
    public DateTime? LastInquiryEmailAt { get; set; }

    // ---- Optional public shop page (the user turns it on themselves) ----

    // The name visitors see, for example "Rasel's Gadgets". It is NOT the account name.
    [StringLength(60)]
    public string? ShopName { get; set; }

    // The address of the shop page: /shops/<ShopSlug>. Unique. Null = this user has no shop page.
    [StringLength(40)]
    public string? ShopSlug { get; set; }

    [StringLength(300)]
    public string? ShopDescription { get; set; }
}
