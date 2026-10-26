using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ProductApi.Data;
using ProductApi.Services;

var builder = WebApplication.CreateBuilder(args);

// ---- Server limits ----
builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;                     // do not announce which web server this is
    options.Limits.MaxRequestBodySize = 5 * 1024 * 1024; // nobody needs to send more than 5 MB (image uploads are capped at 3 MB)
});

// ---- Settings that must be safe in production ----
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
var allowedOrigin = builder.Configuration["Cors:AllowedOrigin"] ?? "http://localhost:3000";
var jwtKey = builder.Configuration["Jwt:Key"];

// In Production the server refuses to start with the placeholder secret, a localhost origin or an empty database password.
StartupChecks.ValidateProductionSettings(builder.Environment.EnvironmentName, jwtKey, allowedOrigin, connectionString);

if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 characters. Set it in appsettings.json, with dotnet user-secrets, or as the environment variable Jwt__Key.");

// 1. Database (MySQL)
// AppDbContext needs to know who is logged in, so it can write the "who did it" part of the activity history.
builder.Services.AddHttpContextAccessor();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

// 2. CORS: allow the Next.js app to call this API
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(allowedOrigin)
              .AllowAnyHeader()
              .AllowAnyMethod()
              // Browsers hide most response headers from JavaScript unless the server exposes them.
              .WithExposedHeaders("Content-Disposition", "X-Export-Truncated"));
});

// 3. Rate limiting. Each IP address may make this many requests; more gets "429 Too Many Requests".
var publicPerMinute = builder.Configuration.GetValue<int?>("RateLimit:PublicPerMinute") ?? 120;
var inquiriesPer10Minutes = builder.Configuration.GetValue<int?>("RateLimit:InquiriesPer10Minutes") ?? 5;
var authPer5Minutes = builder.Configuration.GetValue<int?>("RateLimit:AuthPer5Minutes") ?? 20;

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // A friendly JSON answer (the website shows "message") plus a Retry-After hint
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers["Retry-After"] = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();

        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Too many requests. Please wait a moment and try again." }, cancellationToken);
    };

    // Browsing the public shop
    options.AddPolicy("public", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = publicPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    // Sending a message to a seller: strict, because strangers WRITE to the database here
    options.AddPolicy("inquiry", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = inquiriesPer10Minutes, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));

    // Login, register and password change: slows down password guessing and mass sign-ups from one address
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = authPer5Minutes, Window = TimeSpan.FromMinutes(5), QueueLimit = 0 }));
});

// Lock an account (or email address) for a while after too many wrong passwords
var maxFailedLogins = builder.Configuration.GetValue<int?>("Auth:MaxFailedAttempts") ?? 5;
var lockoutMinutes = builder.Configuration.GetValue<int?>("Auth:LockoutMinutes") ?? 15;
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton(sp =>
    new LoginThrottle(maxFailedLogins, TimeSpan.FromMinutes(lockoutMinutes), sp.GetRequiredService<TimeProvider>()));

// 4. Authentication (JWT)
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<ImageStorage>(); // saves and deletes uploaded product images

// Email (used for password reset). With Email:Smtp:Host set, real emails are sent.
// Without it they are only written to the log (see LoggingEmailSender).
builder.Services.AddSingleton<EmailQueue>();
if (!string.IsNullOrWhiteSpace(builder.Configuration["Email:Smtp:Host"]))
    builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
else
    builder.Services.AddSingleton<IEmailSender>(sp => new LoggingEmailSender(
        sp.GetRequiredService<ILogger<LoggingEmailSender>>(), logContents: builder.Environment.IsDevelopment()));
builder.Services.AddHostedService<EmailBackgroundService>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // keep claim names like "sub" and "role" as they are in the token
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = "name",
            RoleClaimType = "role",   // [Authorize(Roles = "Admin")] looks at the "role" claim
        };

        options.Events = new JwtBearerEvents
        {
            // Runs after the token signature is verified, on every request.
            // We re-check the database so that deleted users and role changes take effect immediately,
            // instead of waiting for the token to expire.
            OnTokenValidated = async context =>
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var identity = context.Principal?.Identity as ClaimsIdentity;
                var idClaim = context.Principal?.FindFirst("sub")?.Value;

                if (identity is null || !int.TryParse(idClaim, out var userId))
                {
                    context.Fail("Invalid token.");
                    return;
                }

                var current = await db.Users
                    .AsNoTracking()
                    .Where(u => u.Id == userId)
                    .Select(u => new { u.Role, u.TokenVersion })
                    .FirstOrDefaultAsync();

                if (current is null)
                {
                    context.Fail("User no longer exists.");
                    return;
                }

                // A password change or reset adds 1 to the user's version. Tokens made before that carry
                // the old number and are refused. (Tokens from before this feature have no number: they count as 0.)
                var tokenVersion = int.TryParse(context.Principal?.FindFirst("tv")?.Value, out var tv) ? tv : 0;
                if (tokenVersion != current.TokenVersion)
                {
                    context.Fail("This session has ended. Please log in again.");
                    return;
                }

                // Replace whatever role the token carried with the real one from the database.
                foreach (var claim in identity.FindAll("role").ToList())
                    identity.RemoveClaim(claim);
                identity.AddClaim(new Claim("role", current.Role));
            },
        };
    });
builder.Services.AddAuthorization();

// 5. Errors: when something unexpected goes wrong, answer with a short JSON message and NEVER with
// stack traces or internal details. (The full details are written to the server log instead.)
builder.Services.AddProblemDetails();

// 6. Controllers + Swagger (with an Authorize button for the token)
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the token only, without the word Bearer.",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
            },
            Array.Empty<string>()
        },
    });
});

var app = builder.Build();

// ---- Database migrations (used by the Docker setup) ----
// With Database:AutoMigrate=true, every migration that has not been applied yet is applied when the API starts.
// That creates all tables on an empty database, and later adds new columns and tables when the app changes.
// (On your own computer, leave it off and run "dotnet ef database update" yourself. See backend/MIGRATIONS.md.)
if (app.Configuration.GetValue<bool>("Database:AutoMigrate"))
{
    for (var attempt = 1; ; attempt++)
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync();
            app.Logger.LogInformation("The database is up to date.");
            break;
        }
        catch (Exception ex) when (attempt < 10)
        {
            app.Logger.LogWarning(ex, "The database is not ready yet (attempt {Attempt} of 10). Trying again in 3 seconds.", attempt);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

// ---- The request pipeline. Order matters. ----

// The website (Next.js) and a reverse proxy pass the visitor's real address in "X-Forwarded-For".
// We only believe that header when it comes from a trusted proxy: by default only this same machine.
// In Docker, the environment variable ASPNETCORE_FORWARDEDHEADERS_ENABLED=true trusts the private network instead.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor,
});

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler(); // short JSON error, details only in the log
    app.UseHsts();             // "always use https" (only sent on https requests)
}

// Security headers on every response. (This API returns JSON and images, never web pages, so it
// can use the strictest content policy. It is skipped in Development, because Swagger's page needs scripts.)
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    if (!app.Environment.IsDevelopment())
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";

    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Serve uploaded images at /uploads/products/<file> (backend/uploads is created automatically)
var uploadsRoot = Path.Combine(builder.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads",
});

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ---- Health checks (for Docker and monitoring). They say "ok" or "not ok", nothing more. ----
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/health/ready", async (AppDbContext db) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { status = "ready" })
        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable));

app.Run();
