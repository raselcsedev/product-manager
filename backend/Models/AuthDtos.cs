using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

public class RegisterRequest
{
    [Required(ErrorMessage = "Name is required.")]
    [StringLength(100, ErrorMessage = "Name must be 100 characters or fewer.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(255)]
    public string Email { get; set; } = string.Empty;

    // BCrypt only uses the first 72 bytes, so we cap the length at 72.
    [Required(ErrorMessage = "Password is required.")]
    [StringLength(72, MinimumLength = 8, ErrorMessage = "Password must be between 8 and 72 characters.")]
    public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required(ErrorMessage = "Email is required.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    public string Password { get; set; } = string.Empty;
}

public class UpdateProfileRequest
{
    [Required(ErrorMessage = "Name is required.")]
    [StringLength(100, ErrorMessage = "Name must be 100 characters or fewer.")]
    public string Name { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    [Required(ErrorMessage = "Current password is required.")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "New password is required.")]
    [StringLength(72, MinimumLength = 8, ErrorMessage = "New password must be between 8 and 72 characters.")]
    public string NewPassword { get; set; } = string.Empty;
}

public class UserDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = Roles.User;
    public DateTime CreatedAt { get; set; }
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserDto User { get; set; } = new();
}

// ---- Admin ----
public class AdminUserDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = Roles.User;
    public DateTime CreatedAt { get; set; }
    public int ProductCount { get; set; }
    public int CategoryCount { get; set; }
}

public class UpdateRoleRequest
{
    [Required(ErrorMessage = "Role is required.")]
    [RegularExpression("^(Admin|User)$", ErrorMessage = "Role must be Admin or User.")]
    public string Role { get; set; } = string.Empty;
}
