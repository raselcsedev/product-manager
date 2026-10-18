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

// 1. Database (MySQL via XAMPP)
// AppDbContext needs to know who is logged in, so it can write the "who did it" part of the activity history.
builder.Services.AddHttpContextAccessor();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

// 2. CORS: allow the Next.js app to call this API
var allowedOrigin = builder.Configuration["Cors:AllowedOrigin"] ?? "http://localhost:3000";
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(allowedOrigin)
              .AllowAnyHeader()
              .AllowAnyMethod()
              // Browsers hide most response headers from JavaScript unless the server exposes them.
              .WithExposedHeaders("Content-Disposition", "X-Export-Truncated"));
});

// 3. Rate limiting for the PUBLIC (not logged in) endpoints.
// Each IP address may make this many requests; more gets "429 Too Many Requests".
var publicPerMinute = builder.Configuration.GetValue<int?>("RateLimit:PublicPerMinute") ?? 120;
var inquiriesPer10Minutes = builder.Configuration.GetValue<int?>("RateLimit:InquiriesPer10Minutes") ?? 5;
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Browsing the public shop
    options.AddPolicy("public", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = publicPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));

    // Sending a message to a seller: much stricter, because this is where strangers WRITE to the database
    options.AddPolicy("inquiry", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = inquiriesPer10Minutes,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0,
            }));
});

// 4. Authentication (JWT)
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 characters. Set it in appsettings.json or with dotnet user-secrets.");

builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<ImageStorage>(); // saves and deletes uploaded product images
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

                var role = await db.Users
                    .AsNoTracking()
                    .Where(u => u.Id == userId)
                    .Select(u => u.Role)
                    .FirstOrDefaultAsync();

                if (role is null)
                {
                    context.Fail("User no longer exists.");
                    return;
                }

                // Replace whatever role the token carried with the real one from the database.
                foreach (var claim in identity.FindAll("role").ToList())
                    identity.RemoveClaim(claim);
                identity.AddClaim(new Claim("role", role));
            },
        };
    });
builder.Services.AddAuthorization();

// 5. Controllers + Swagger (with an Authorize button for the token)
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

// The website (Next.js) calls this API from its SERVER to build the shop pages, so every
// visitor's page view would look like it comes from ONE address and share one rate limit.
// The website therefore passes the visitor's real address in "X-Forwarded-For", and we use it here.
// We only believe that header when it comes from a trusted proxy. By default that means the
// same machine (localhost), so a visitor on the internet cannot fake it.
// When the website runs on a DIFFERENT machine in production, add its address to KnownProxies.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor,
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Serve uploaded images at http://localhost:5080/uploads/products/<file>
// (backend/uploads is created automatically)
var uploadsRoot = Path.Combine(builder.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads",
    OnPrepareResponse = ctx =>
    {
        // Stop browsers from "guessing" a different content type for these files.
        ctx.Context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    },
});

// Order matters: CORS -> rate limit -> who are you? -> are you allowed? -> controllers
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
