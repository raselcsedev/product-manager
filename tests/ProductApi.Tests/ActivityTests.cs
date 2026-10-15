using System.Net;
using System.Net.Http.Json;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class ActivityTests
{
    private readonly ApiFactory _factory;

    public ActivityTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Activity_RequiresALogin()
    {
        var response = await _factory.CreateClient().GetAsync("/api/activity");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AProductsWholeLife_IsRecorded_NewestFirst_WithWhatChanged()
    {
        var user = await _factory.RegisterUserAsync("Rasel");
        var product = await user.Client.CreateProductAsync("Mouse", 10m, 5);

        await user.Client.PutAsJsonAsync($"/api/products/{product.Id}",
            new { id = product.Id, name = "Mouse", description = (string?)null, price = 12.5m, quantity = 5 });
        await user.Client.DeleteAsync($"/api/products/{product.Id}");

        var activity = await user.Client.GetActivityAsync("entityType=Product");

        Assert.Equal(new[] { "Deleted", "Updated", "Created" }, activity.Items.Select(a => a.Action).ToArray());
        Assert.All(activity.Items, a =>
        {
            Assert.Equal(user.Id, a.UserId);
            Assert.Equal("Rasel", a.ActorName);
            Assert.Equal("Mouse", a.EntityName);
            Assert.Equal(product.Id, a.EntityId);
        });
        Assert.Contains("Price 10.00, quantity 5", activity.Items[2].Details);
        Assert.Equal("Price: 10.00 -> 12.50", activity.Items[1].Details);
    }

    [Fact]
    public async Task SavingWithoutChangingAnything_IsNotLogged()
    {
        var user = await _factory.RegisterUserAsync();
        var product = await user.Client.CreateProductAsync("Same", 10m, 5);

        await user.Client.PutAsJsonAsync($"/api/products/{product.Id}",
            new { id = product.Id, name = "Same", description = (string?)null, price = 10m, quantity = 5 });

        var activity = await user.Client.GetActivityAsync("entityType=Product");
        Assert.Equal("Created", Assert.Single(activity.Items).Action);
    }

    [Fact]
    public async Task CategoryChanges_AreRecorded()
    {
        var user = await _factory.RegisterUserAsync();
        var category = await user.Client.CreateCategoryAsync("Old");

        await user.Client.PutAsJsonAsync($"/api/categories/{category.Id}", new { name = "New" });
        await user.Client.DeleteAsync($"/api/categories/{category.Id}");

        var activity = await user.Client.GetActivityAsync("entityType=Category");
        Assert.Equal(new[] { "Deleted", "Updated", "Created" }, activity.Items.Select(a => a.Action).ToArray());
        Assert.Equal("Name: \"Old\" -> \"New\"", activity.Items[1].Details);
    }

    [Fact]
    public async Task APasswordChange_IsLogged_WithoutLeakingAnySecret()
    {
        var user = await _factory.RegisterUserAsync();
        const string newPassword = "VerySecretNewPass789!";

        var change = await user.Client.PutAsJsonAsync("/api/auth/password",
            new { currentPassword = user.Password, newPassword });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        var response = await user.Client.GetAsync("/api/activity?entityType=User");
        var raw = await response.Content.ReadAsStringAsync();
        var activity = await response.ReadAsync<PagedResult<AuditLogDto>>();

        Assert.Equal("Password changed", Assert.Single(activity.Items).Details);
        Assert.DoesNotContain(newPassword, raw);
        Assert.DoesNotContain(user.Password, raw);
        Assert.DoesNotContain("$2", raw); // the start of every BCrypt hash
    }

    [Fact]
    public async Task YouOnlySeeYourOwnActivity_AndOnlyAdminsMayAskForEveryones()
    {
        var alice = await _factory.RegisterUserAsync("Alice");
        var bob = await _factory.RegisterUserAsync("Bob");
        await alice.Client.CreateProductAsync("Alice's secret product");

        var bobsView = await bob.Client.GetActivityAsync();
        var everyone = await bob.Client.GetAsync("/api/activity?scope=all");

        Assert.DoesNotContain(bobsView.Items, a => a.EntityName == "Alice's secret product");
        Assert.Equal(HttpStatusCode.Forbidden, everyone.StatusCode);
    }

    [Fact]
    public async Task AnAdminCanSeeEveryonesActivity()
    {
        var admin = await _factory.RegisterUserAsync("Boss", admin: true);
        var user = await _factory.RegisterUserAsync("Worker");
        await user.Client.CreateProductAsync("Worker's product");

        var activity = await admin.Client.GetActivityAsync("scope=all");

        Assert.Contains(activity.Items, a => a.UserId == user.Id && a.EntityName == "Worker's product" && a.ActorName == "Worker");
    }

    [Fact]
    public async Task AdminActions_AreRecorded_ARoleChangeAndAUserDeletion()
    {
        var admin = await _factory.RegisterUserAsync("Boss", admin: true);
        var promoted = await _factory.RegisterUserAsync("Promoted " + Guid.NewGuid().ToString("N")[..6]);
        var doomed = await _factory.RegisterUserAsync("Doomed " + Guid.NewGuid().ToString("N")[..6]);
        await doomed.Client.CreateProductAsync("Goes away with the user");

        await admin.Client.PutAsJsonAsync($"/api/admin/users/{promoted.Id}/role", new { role = "Admin" });
        await admin.Client.DeleteAsync($"/api/admin/users/{doomed.Id}");

        var activity = await admin.Client.GetActivityAsync("entityType=User");

        var deletion = activity.Items[0];
        Assert.Equal("Deleted", deletion.Action);
        Assert.Equal(doomed.Name, deletion.EntityName);
        Assert.Contains("removed 1 product(s)", deletion.Details);

        var roleChange = activity.Items[1];
        Assert.Equal("Updated", roleChange.Action);
        Assert.Equal(promoted.Name, roleChange.EntityName);
        Assert.Equal("Role: User -> Admin", roleChange.Details);
        Assert.Equal(admin.Id, roleChange.UserId);
    }

    [Theory]
    [InlineData("scope=everything")]
    [InlineData("action=Exploded")]
    [InlineData("entityType=Spaceship")]
    [InlineData("pageSize=1000")]
    public async Task Activity_RejectsBadQueryValues(string query)
    {
        var user = await _factory.RegisterUserAsync();

        var response = await user.Client.GetAsync($"/api/activity?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
