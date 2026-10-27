using System.Security.Cryptography;
using System.Text;
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

    // The answer to "forgot password" is ALWAYS this, whether or not the email has an account.
    private const string ForgotPasswordAnswer =
        "If an account with that email exists, we have sent it instructions to reset the password.";

    private const string InvalidResetLink = "This reset link is not valid any more. Please request a new one.";

    private readonly AppDbContext _db;
    private readonly TokenService _tokens;
    private readonly LoginThrottle _throttle;
    private readonly EmailQueue _emails;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext db, TokenService tokens, LoginThrottle throttle, EmailQueue emails, IConfiguration config)
    {
        _db = db;
        _tokens = tokens;
        _throttle = throttle;
        _emails = emails;
        _config = config;
    }

    // The address of the website, for the links in emails
    private string SiteUrl =>
        (_config["Site:Url"] ?? _config["Cors:AllowedOrigin"] ?? "http://localhost:3000").TrimEnd('/');

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
    // Answers with a NEW login token: the password change ends every other session, including this one's old token.
    [EnableRateLimiting("auth")]
    [Authorize]
    [HttpPut("password")]
    public async Task<ActionResult<AuthResponse>> ChangePassword(ChangePasswordRequest request)
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
        user.TokenVersion++; // every older login token (other devices) stops working
        await _db.SaveChangesAsync();

        EnqueuePasswordChangedEmail(user);
        return Ok(BuildResponse(user));
    }

    // POST /api/auth/forgot-password   body: { "email": "..." }
    [EnableRateLimiting("auth")]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        // The answer never depends on whether the email has an account. Otherwise this form would be
        // a free tool to find out who is registered.
        IActionResult answer = Ok(new { message = ForgotPasswordAnswer });

        // Many requests for the same address: quietly stop sending (nobody should be able to flood a mailbox)
        var throttleKey = $"reset-request:{email}";
        if (_throttle.IsLockedOut(throttleKey, out _))
            return answer;
        _throttle.RecordFailure(throttleKey);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null)
            return answer;

        var now = DateTime.UtcNow;
        var minutes = _config.GetValue<int?>("Auth:ResetLinkMinutes") ?? 60;

        // 32 random bytes = 256 bits: impossible to guess
        var secret = Base64Url(RandomNumberGenerator.GetBytes(32));

        // A new request cancels the older links, and old finished ones are tidied away
        await _db.PasswordResetTokens
            .Where(t => t.UserId == user.Id || t.ExpiresAt < now.AddDays(-1))
            .ExecuteDeleteAsync();

        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = Hash(secret), // only the fingerprint is stored
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(minutes),
        });
        await _db.SaveChangesAsync();

        // The secret goes in the part of the address after "#": browsers never send that part to any server,
        // so it cannot end up in server logs or in a "Referer" header.
        var link = $"{SiteUrl}/reset-password#token={secret}";

        _emails.TryEnqueue(new EmailMessage(
            user.Email,
            "Reset your Product Manager password",
            $"Hello {user.Name},\n\n" +
            "Someone asked to reset the password of your Product Manager account.\n\n" +
            $"If it was you, open this link within {minutes} minutes to choose a new password:\n{link}\n\n" +
            "If it was not you, ignore this email. Your password stays exactly as it is.\n"));

        return answer;
    }

    // POST /api/auth/reset-password   body: { "token": "...", "newPassword": "..." }
    [EnableRateLimiting("auth")]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var hash = Hash(request.Token.Trim());
        var now = DateTime.UtcNow;

        var record = await _db.PasswordResetTokens
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TokenHash == hash && t.UsedAt == null && t.ExpiresAt > now);

        if (record is null)
            return BadRequest(new { message = InvalidResetLink });

        // Use the link up in ONE database step. If two requests arrive at once with the same link,
        // only one of them gets "1 row changed", and the other is refused.
        var claimed = await _db.PasswordResetTokens
            .Where(t => t.Id == record.Id && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now));

        if (claimed == 0)
            return BadRequest(new { message = InvalidResetLink });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == record.UserId);
        if (user is null)
            return BadRequest(new { message = InvalidResetLink });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.TokenVersion++; // whoever was logged in (maybe the attacker) is logged out everywhere
        await _db.SaveChangesAsync();

        // The person got their account back, so any lockout from wrong guesses ends too
        _throttle.Reset(user.Email);
        _throttle.Reset($"password-change:{user.Id}");

        await _db.PasswordResetTokens.Where(t => t.UserId == user.Id).ExecuteDeleteAsync();

        EnqueuePasswordChangedEmail(user);
        return NoContent();
    }

    // PUT /api/auth/notification-settings   body: { "notifyOnInquiry": false }
    [Authorize]
    [HttpPut("notification-settings")]
    public async Task<ActionResult<UserDto>> UpdateNotificationSettings(NotificationSettingsRequest request)
    {
        // The user comes from the token: you can only change your own settings.
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == User.GetUserId());
        if (user is null)
            return Unauthorized(new { message = "User no longer exists." });

        user.MuteInquiryEmails = !request.NotifyOnInquiry;
        await _db.SaveChangesAsync();

        return Ok(ToDto(user));
    }

    // "Your password was changed": if it was NOT you, you find out right away
    private void EnqueuePasswordChangedEmail(AppUser user)
    {
        _emails.TryEnqueue(new EmailMessage(
            user.Email,
            "Your Product Manager password was changed",
            $"Hello {user.Name},\n\n" +
            "The password of your Product Manager account was just changed.\n\n" +
            "If you did this, there is nothing more to do.\n" +
            $"If you did NOT, reset your password right away: {SiteUrl}/forgot-password\n"));
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    // SHA-256, as 64 lowercase hexadecimal characters
    private static string Hash(string secret) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret))).ToLowerInvariant();

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
            NotifyOnInquiry = !user.MuteInquiryEmails,
        };

    private AuthResponse BuildResponse(AppUser user)
    {
        var (token, expiresAt) = _tokens.CreateToken(user);
        return new AuthResponse { Token = token, ExpiresAt = expiresAt, User = ToDto(user) };
    }
}
