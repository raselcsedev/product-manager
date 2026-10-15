using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class AdminTests
{
    private readonly ApiFactory _factory;

    public AdminTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task UserManagement_IsForbiddenForNormalUsers_AndRequiresALogin()
    {
        var user = await _factory.RegisterUserAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync("/api/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.Client.GetAsync("/api/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.Client.DeleteAsync("/api/admin/users/1")).StatusCode);
    }

    [Fact]
    public async Task AnAdminCanListUsers_WithTheirCounts()
    {
        var admin = await _factory.RegisterUserAsync(admin: true);
        var user = await _factory.RegisterUserAsync();
        await user.Client.CreateProductAsync("Counted");

        var users = await (await admin.Client.GetAsync("/api/admin/users")).ReadAsync<List<AdminUserDto>>();

        var row = Assert.Single(users, u => u.Id == user.Id);
        Assert.Equal(user.Email, row.Email);
        Assert.Equal(1, row.ProductCount);
        Assert.Equal(Roles.User, row.Role);
    }

    [Fact]
    public async Task AnAdminCannotChangeOrDeleteTheirOwnAccount()
    {
        var admin = await _factory.RegisterUserAsync(admin: true);

        var role = await admin.Client.PutAsJsonAsync($"/api/admin/users/{admin.Id}/role", new { role = "User" });
        var delete = await admin.Client.DeleteAsync($"/api/admin/users/{admin.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, role.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, delete.StatusCode);
    }

    [Fact]
    public async Task RoleChangesTakeEffectImmediately_WithoutLoggingInAgain()
    {
        var admin = await _factory.RegisterUserAsync(admin: true);
        var user = await _factory.RegisterUserAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await user.Client.GetAsync("/api/admin/users")).StatusCode);

        await admin.Client.PutAsJsonAsync($"/api/admin/users/{user.Id}/role", new { role = "Admin" });
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync("/api/admin/users")).StatusCode); // same token as before

        await admin.Client.PutAsJsonAsync($"/api/admin/users/{user.Id}/role", new { role = "User" });
        Assert.Equal(HttpStatusCode.Forbidden, (await user.Client.GetAsync("/api/admin/users")).StatusCode);
    }

    [Fact]
    public async Task AnUnknownRoleIsRejected()
    {
        var admin = await _factory.RegisterUserAsync(admin: true);
        var user = await _factory.RegisterUserAsync();

        var response = await admin.Client.PutAsJsonAsync($"/api/admin/users/{user.Id}/role", new { role = "Root" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeletingAUserAlsoDeletesTheirProductsAndCategories()
    {
        var admin = await _factory.RegisterUserAsync(admin: true);
        var user = await _factory.RegisterUserAsync();
        var category = await user.Client.CreateCategoryAsync("Doomed");
        var product = await user.Client.CreateProductAsync("Doomed product", categoryId: category.Id);

        var delete = await admin.Client.DeleteAsync($"/api/admin/users/{user.Id}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.False(await _factory.QueryDbAsync(db => db.Products.AnyAsync(p => p.Id == product.Id)));
        Assert.False(await _factory.QueryDbAsync(db => db.Categories.AnyAsync(c => c.Id == category.Id)));
        Assert.False(await _factory.QueryDbAsync(db => db.Users.AnyAsync(u => u.Id == user.Id)));
    }

    [Fact]
    public async Task DeletingAUnknownUserIs404()
    {
        var admin = await _factory.RegisterUserAsync(admin: true);

        var response = await admin.Client.DeleteAsync("/api/admin/users/99999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
