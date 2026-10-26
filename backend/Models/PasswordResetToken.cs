using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

// One "forgot password" link. The link's secret is NEVER stored, only a fingerprint (hash) of it.
// So even somebody who reads the whole database cannot use it to take over an account.
public class PasswordResetToken
{
    public int Id { get; set; }

    public int UserId { get; set; }

    // SHA-256 of the secret in the emailed link, as 64 hexadecimal characters
    [StringLength(64)]
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    // Set the moment the link is used. A link works only once.
    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
