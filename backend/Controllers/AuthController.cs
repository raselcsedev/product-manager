using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Controllers;

[ApiController]
[Route("api/[controller]")]   // -> /api/auth
public class AuthController : ControllerBase
{
    // A real BCrypt hash of a throw-away password. When the email does not exist we still check a password
    // against it, so "unknown email" takes as long as "wrong password" and timing reveals nothing.
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("not-a-real-password-just-for-timing");

    private readonly AppDbContext _db;
    private readonly TokenService _tokens;
    private readonly LoginThrottle _throttle;

    public AuthController(AppDbContext db, TokenService tokens, LoginThrottle throttle)
    {
        _db = db;
        _tokens = tokens;
        _throttle = throttle;
    }

    // POST /api/auth/register
    [EnableRateLimiting("auth")]
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with this email already exists." });

        // The very first account on a fresh system becomes the Admin; everyone else is a normal User.
        var isFirstUser = !await _db.Users.AnyAsync();

        var user = new AppUser
        {
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = isFirstUser ? Roles.Admin : Roles.User,
            CreatedAt = DateTime.UtcNow,
        };

        _db.Users.Add(user);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            if (await _db.Users.AnyAsync(u => u.Email == email))
                return Conflict(new { message = "An account with this email already exists." });
            throw;
        }

        return StatusCode(StatusCodes.Status201Created, BuildResponse(user));
    }

    // POST /api/auth/login
    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        // Too many wrong attempts: refuse, even if this attempt would have used the right password.
        // (Done for unknown emails too, so this answer never reveals whether an account exists.)
        if (_throttle.IsLockedOut(email, out var retryAfter))
            return TooManyAttempts("Too many failed login attempts.", retryAfter);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Always run exactly one password check, whether or not the account exists
        var passwordOk = BCrypt.Net.BCrypt.Verify(request.Password, user?.PasswordHash ?? DummyHash);

        // Same message for "no such user" and "wrong password" so attackers can't discover which emails exist.
        if (user is null || !passwordOk)
        {
            _throttle.RecordFailure(email);
            return Unauthorized(new { message = "Invalid email or password." });
        }

        _throttle.Reset(email);
        return Ok(BuildResponse(user));
    }

    // GET /api/auth/me  (requires a valid token; returns the CURRENT data from the database)
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me()
    {
        var id = User.GetUserId();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return Unauthorized(new { message = "User no longer exists." });

        return Ok(ToDto(user));
    }

    // PUT /api/auth/profile   body: { "name": "New Name" }
    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<UserDto>> UpdateProfile(UpdateProfileRequest request)
    {
        // The user comes from the token, so you can only ever change your own profile.
        var id = User.GetUserId();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return Unauthorized(new { message = "User no longer exists." });

        user.Name = request.Name.Trim();
        await _db.SaveChangesAsync();

        return Ok(ToDto(user));
    }

    // PUT /api/auth/password   body: { "currentPassword": "...", "newPassword": "..." }
    [EnableRateLimiting("auth")]
    [Authorize]
    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var id = User.GetUserId();

        // Somebody holding a stolen login token must not be able to guess the current password at leisure.
        var throttleKey = $"password-change:{id}";
        if (_throttle.IsLockedOut(throttleKey, out var retryAfter))
            return TooManyAttempts("Too many wrong passwords.", retryAfter);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return Unauthorized(new { message = "User no longer exists." });

        // A wrong current password is 400, NOT 401: the person IS logged in, so the
        // frontend must not treat this as an expired session and log them out.
        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            _throttle.RecordFailure(throttleKey);
            return BadRequest(new { message = "Your current password is incorrect." });
        }

        if (request.CurrentPassword == request.NewPassword)
            return BadRequest(new { message = "The new password must be different from the current one." });

        _throttle.Reset(throttleKey);
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    private ObjectResult TooManyAttempts(string reason, TimeSpan retryAfter)
    {
        var minutes = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalMinutes));
        Response.Headers["Retry-After"] = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();

        return StatusCode(StatusCodes.Status429TooManyRequests,
            new { message = $"{reason} Please try again in {minutes} minute{(minutes == 1 ? "" : "s")}." });
    }

    private static UserDto ToDto(AppUser user) =>
        new()
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role,
            CreatedAt = user.CreatedAt,
        };

    private AuthResponse BuildResponse(AppUser user)
    {
        var (token, expiresAt) = _tokens.CreateToken(user);
        return new AuthResponse { Token = token, ExpiresAt = expiresAt, User = ToDto(user) };
    }
}
