using System.Collections.Concurrent;
using System.Data.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ProductApi.Data;
using ProductApi.Services;

namespace ProductApi.Tests;

// Starts the real API in memory, connected to a separate TEST database.
// One instance is shared by all integration tests (see ApiCollection).
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string JwtKey = "test-only-jwt-key-that-is-at-least-32-characters-long!";

    private readonly string _connectionString;

    public ApiFactory()
    {
        // Set TEST_DB_CONNECTION if your MySQL user or password is different from XAMPP's default.
        _connectionString = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
            ?? "Server=localhost;Port=3306;Database=product_crud_test;User=root;Password=;";

        // SAFETY: these tests delete and recreate their database, so refuse to run against anything
        // that is not clearly a test database. Your real data in "product_crud" can never be touched.
        var csb = new DbConnectionStringBuilder { ConnectionString = _connectionString };
        var database = csb.TryGetValue("Database", out var value) ? value?.ToString() : null;
        if (string.IsNullOrWhiteSpace(database) || !database.EndsWith("_test", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Refusing to run: the test database name must end with \"_test\" (found \"{database}\"). " +
                "The tests delete and recreate this database.");
        }

        // Environment variables override appsettings.json, and they are read before Program.cs runs.
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _connectionString);
        Environment.SetEnvironmentVariable("Jwt__Key", JwtKey);

        // The public shop limits requests per IP address. All test requests come from the same
        // "address", so the limit is raised high enough that it never gets in the way of the tests.
        Environment.SetEnvironmentVariable("RateLimit__PublicPerMinute", "100000");

        // Sending messages to sellers has a much stricter limit (5 per 10 minutes per address).
        // It is raised for the same reason.
        Environment.SetEnvironmentVariable("RateLimit__InquiriesPer10Minutes", "100000");

        // Login, register and password change are limited per address too (20 per 5 minutes). Raised for the tests.
        Environment.SetEnvironmentVariable("RateLimit__AuthPer5Minutes", "100000");
    }

    // Every email the app "sends" during the tests ends up here, so a test can read the reset link.
    public CapturingEmailSender Emails { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // "Testing" (not "Development"), so user-secrets and Swagger are not involved.
        builder.UseEnvironment("Testing");

        // Replace the real email sender
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Emails);
        });
    }

    // Runs once, before the first test: builds a fresh, empty test database from the EF model.
    async Task IAsyncLifetime.InitializeAsync()
    {
        try
        {
            var serverOnly = new DbConnectionStringBuilder { ConnectionString = _connectionString };
            serverOnly.Remove("Database"); // the database may not exist yet
            var serverVersion = ServerVersion.AutoDetect(serverOnly.ConnectionString);

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseMySql(_connectionString, serverVersion)
                .Options;

            await using var db = new AppDbContext(options);
            await db.Database.EnsureDeletedAsync();
            await db.Database.EnsureCreatedAsync();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                "Could not prepare the test database. Is MySQL running (XAMPP Control Panel) " +
                "and does the connection string allow creating databases? " +
                "Set TEST_DB_CONNECTION to change it. Original error: " + ex.Message, ex);
        }
    }

    Task IAsyncLifetime.DisposeAsync() => Task.CompletedTask;

    // ---- helpers that talk to the database directly ----

    // Sets a user's role without going through the API (so the "first user is Admin" rule never gets in the way).
    public async Task SetRoleAsync(int userId, string role)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.Role, role));
    }

    public async Task<T> QueryDbAsync<T>(Func<AppDbContext, Task<T>> query)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await query(db);
    }
}

// Keeps every "sent" email in memory
public sealed class CapturingEmailSender : IEmailSender
{
    private readonly ConcurrentQueue<EmailMessage> _sent = new();

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        _sent.Enqueue(message);
        return Task.CompletedTask;
    }

    // Emails are sent by a background worker a moment after the request, so tests wait for them.
    // Returns what was found when `count` matching emails arrived, or when the timeout ran out.
    public async Task<List<EmailMessage>> WaitForAsync(Func<EmailMessage, bool> match, int count = 1, TimeSpan? timeout = null)
    {
        var deadline = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(5));
        while (true)
        {
            var found = _sent.Where(match).ToList();
            if (found.Count >= count || DateTime.UtcNow > deadline) return found;
            await Task.Delay(25);
        }
    }
}

// All integration tests join this collection. They share one ApiFactory (one test database)
// and run one after another, so they never interfere with each other.
[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "Api";
}
