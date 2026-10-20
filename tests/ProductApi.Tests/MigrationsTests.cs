using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;

namespace ProductApi.Tests;

// These two tests keep the database migrations honest.
// They use their OWN throw-away database, so they never touch your real data.
public class MigrationsTests
{
    private const string MigrationsDatabase = "product_crud_migrations_test"; // must end with _test (we delete it)

    private static string ConnectionString()
    {
        var baseConnection = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
            ?? "Server=localhost;Port=3306;Database=product_crud_test;User=root;Password=;";

        var csb = new DbConnectionStringBuilder { ConnectionString = baseConnection };
        csb["Database"] = MigrationsDatabase;
        return csb.ConnectionString;
    }

    private static AppDbContext CreateContext()
    {
        var connection = ConnectionString();

        var serverOnly = new DbConnectionStringBuilder { ConnectionString = connection };
        serverOnly.Remove("Database"); // the database may not exist yet
        var serverVersion = ServerVersion.AutoDetect(serverOnly.ConnectionString);

        var options = new DbContextOptionsBuilder<AppDbContext>().UseMySql(connection, serverVersion).Options;
        return new AppDbContext(options);
    }

    [Fact]
    public void EveryModelChange_HasAMigration()
    {
        using var db = CreateContext();

        Assert.True(db.Database.GetMigrations().Any(),
            "There are no migrations yet. Create the first one (see backend/MIGRATIONS.md): " +
            "cd backend, then: dotnet ef migrations add InitialCreate");

        // Compares your C# classes with the last migration. Fails when you changed a model and forgot the migration.
        Assert.False(db.Database.HasPendingModelChanges(),
            "The model has changes that no migration contains. " +
            "cd backend, then: dotnet ef migrations add <DescribeTheChange>");
    }

    [Fact]
    public async Task TheMigrationsBuildAWorkingDatabaseFromNothing()
    {
        await using var db = CreateContext();

        Assert.True(db.Database.GetMigrations().Any(),
            "There are no migrations yet. See backend/MIGRATIONS.md.");

        await db.Database.EnsureDeletedAsync();
        try
        {
            await db.Database.MigrateAsync();

            Assert.Empty(await db.Database.GetPendingMigrationsAsync());

            // Every table the app uses really exists and can be queried
            Assert.Equal(0, await db.Users.CountAsync());
            Assert.Equal(0, await db.Products.CountAsync());
            Assert.Equal(0, await db.Categories.CountAsync());
            Assert.Equal(0, await db.AuditLogs.CountAsync());
            Assert.Equal(0, await db.Inquiries.CountAsync());
        }
        finally
        {
            await db.Database.EnsureDeletedAsync();
        }
    }
}
