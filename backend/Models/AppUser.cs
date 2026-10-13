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

    public DateTime CreatedAt { get; set; }
}
