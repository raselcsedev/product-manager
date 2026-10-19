using System.Text.RegularExpressions;

namespace ProductApi.Services;

// Refuses to start in Production with settings that are fine on your own computer but unsafe on the internet.
// It is better for the server to stop with a clear message than to run quietly with a publicly known secret.
public static class StartupChecks
{
    // The placeholder key in appsettings.json contains this text
    public const string DevelopmentKeyMarker = "DEV-ONLY";

    private static readonly Regex EmptyPassword = new(@"Password\s*=\s*(;|$)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static void ValidateProductionSettings(
        string environmentName, string? jwtKey, string? allowedOrigin, string? connectionString)
    {
        if (!string.Equals(environmentName, "Production", StringComparison.OrdinalIgnoreCase))
            return;

        var problems = new List<string>();

        if (string.IsNullOrWhiteSpace(jwtKey) ||
            jwtKey.Contains(DevelopmentKeyMarker, StringComparison.OrdinalIgnoreCase))
        {
            problems.Add("Jwt:Key is still the development placeholder. Set your own long random secret " +
                         "(environment variable Jwt__Key). Anyone who knows the placeholder can forge login tokens.");
        }

        if (string.IsNullOrWhiteSpace(allowedOrigin) ||
            allowedOrigin.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
            allowedOrigin.Contains("127.0.0.1", StringComparison.Ordinal))
        {
            problems.Add("Cors:AllowedOrigin must be your real website address (for example https://shop.example.com), " +
                         "not localhost.");
        }

        if (string.IsNullOrWhiteSpace(connectionString) || EmptyPassword.IsMatch(connectionString))
        {
            problems.Add("The database connection string has an empty password. Create a database user with a strong password.");
        }

        if (problems.Count > 0)
            throw new InvalidOperationException("Unsafe production configuration:\n- " + string.Join("\n- ", problems));
    }
}
