using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ProductApi.Models;
using Xunit.Sdk;

namespace ProductApi.Tests;

public static class Json
{
    // The same settings ASP.NET uses: camelCase names, case-insensitive reading
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}

// A registered user plus an HttpClient that is already logged in as that user.
public sealed record TestUser(int Id, string Name, string Email, string Password, string Token, HttpClient Client);

public static class TestHelpers
{
    public const string DefaultPassword = "Password123!";

    public static async Task<TestUser> RegisterUserAsync(this ApiFactory factory, string name = "Test User", bool admin = false)
    {
        var email = $"user-{Guid.NewGuid():N}@example.test";
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register", new { name, email, password = DefaultPassword });
        await response.EnsureSuccessWithBodyAsync();
        var auth = await response.ReadAsync<AuthResponse>();

        // Always set the role explicitly, so the very first account of the test run is not an accidental admin.
        await factory.SetRoleAsync(auth.User.Id, admin ? Roles.Admin : Roles.User);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);
        return new TestUser(auth.User.Id, name, email, DefaultPassword, auth.Token, client);
    }

    // Like EnsureSuccessStatusCode, but the failure message includes the response body, which makes failures easy to understand.
    public static async Task<HttpResponseMessage> EnsureSuccessWithBodyAsync(this HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode)
        {
            throw new XunitException(
                $"Expected a success status but got {(int)response.StatusCode} {response.StatusCode}: " +
                await response.Content.ReadAsStringAsync());
        }
        return response;
    }

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response)
    {
        var value = await response.Content.ReadFromJsonAsync<T>(Json.Options);
        return value ?? throw new XunitException("The response body was empty.");
    }

    public static async Task<Product> CreateProductAsync(
        this HttpClient client,
        string name = "Widget",
        decimal price = 10m,
        int quantity = 5,
        int? categoryId = null,
        string? description = null)
    {
        var response = await client.PostAsJsonAsync("/api/products", new { name, description, price, quantity, categoryId });
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<Product>();
    }

    public static async Task<CategoryDto> CreateCategoryAsync(this HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/categories", new { name });
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<CategoryDto>();
    }

    public static async Task<PagedResult<Product>> ListProductsAsync(this HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/products?{query}");
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<PagedResult<Product>>();
    }

    public static async Task<PagedResult<AuditLogDto>> GetActivityAsync(this HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/activity?{query}");
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<PagedResult<AuditLogDto>>();
    }
}
