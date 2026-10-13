using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ProductApi.Data;
using ProductApi.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Database (MySQL via XAMPP)
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
              .AllowAnyMethod());
});

// 3. Authentication (JWT)
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

// 4. Controllers + Swagger (with an Authorize button for the token)
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

// Order matters: CORS -> who are you? -> are you allowed? -> controllers
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
