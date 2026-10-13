using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Controllers;

[ApiController]
[Route("api/[controller]")]   // -> /api/auth
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokens;

    public AuthController(AppDbContext db, TokenService tokens)
    {
        _db = db;
        _tokens = tokens;
    }

    // POST /api/auth/register
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
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Same message for "no such user" and "wrong password" so attackers can't discover which emails exist.
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

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

    private static UserDto ToDto(AppUser user) =>
        new() { Id = user.Id, Name = user.Name, Email = user.Email, Role = user.Role };

    private AuthResponse BuildResponse(AppUser user)
    {
        var (token, expiresAt) = _tokens.CreateToken(user);
        return new AuthResponse { Token = token, ExpiresAt = expiresAt, User = ToDto(user) };
    }
}
