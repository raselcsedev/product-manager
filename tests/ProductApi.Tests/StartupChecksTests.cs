using ProductApi.Services;

namespace ProductApi.Tests;

public class StartupChecksTests
{
    private const string GoodKey = "a-long-random-secret-that-nobody-else-knows-1234567890";
    private const string GoodOrigin = "https://shop.example.com";
    private const string GoodConnection = "Server=db;Database=product_crud;User=app;Password=s3cretValue;";

    [Fact]
    public void AProperlyConfiguredProductionServerStarts()
    {
        StartupChecks.ValidateProductionSettings("Production", GoodKey, GoodOrigin, GoodConnection);
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Testing")]
    [InlineData("Staging")]
    public void OutsideProduction_NothingIsChecked(string environment)
    {
        // The unsafe placeholders are fine on your own computer
        StartupChecks.ValidateProductionSettings(environment, "DEV-ONLY-placeholder-key-that-is-long-enough", "http://localhost:3000", "Server=localhost;User=root;Password=;");
    }

    [Fact]
    public void ThePlaceholderSecretIsRefusedInProduction()
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            StartupChecks.ValidateProductionSettings(
                "Production", "DEV-ONLY-change-this-secret-to-a-long-random-value-before-deploying", GoodOrigin, GoodConnection));

        Assert.Contains("Jwt:Key", error.Message);
    }

    [Theory]
    [InlineData("http://localhost:3000")]
    [InlineData("http://127.0.0.1:3000")]
    [InlineData("")]
    public void ALocalhostOriginIsRefusedInProduction(string origin)
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            StartupChecks.ValidateProductionSettings("Production", GoodKey, origin, GoodConnection));

        Assert.Contains("Cors:AllowedOrigin", error.Message);
    }

    [Theory]
    [InlineData("Server=db;Database=x;User=root;Password=;")]
    [InlineData("Server=db;Database=x;User=root;Password=")]
    [InlineData("Server=db;Database=x;User=root;password = ;SslMode=None")]
    public void AnEmptyDatabasePasswordIsRefusedInProduction(string connection)
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            StartupChecks.ValidateProductionSettings("Production", GoodKey, GoodOrigin, connection));

        Assert.Contains("empty password", error.Message);
    }

    [Fact]
    public void EveryProblemIsListedAtOnce()
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            StartupChecks.ValidateProductionSettings("Production", "DEV-ONLY-x", "http://localhost", "Server=db;Password=;"));

        Assert.Contains("Jwt:Key", error.Message);
        Assert.Contains("Cors:AllowedOrigin", error.Message);
        Assert.Contains("empty password", error.Message);
    }
}
