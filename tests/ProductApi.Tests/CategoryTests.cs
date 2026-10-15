using System.Net;
using System.Net.Http.Json;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class CategoryTests
{
    private readonly ApiFactory _factory;

    public CategoryTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Categories_RequireALogin()
    {
        var response = await _factory.CreateClient().GetAsync("/api/categories");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ADuplicateNameIsRejected_ButTwoUsersMayUseTheSameName()
    {
        var first = await _factory.RegisterUserAsync();
        var second = await _factory.RegisterUserAsync();

        await first.Client.CreateCategoryAsync("Electronics");
        var duplicate = await first.Client.PostAsJsonAsync("/api/categories", new { name = "electronics" }); // different case
        var otherUser = await second.Client.PostAsJsonAsync("/api/categories", new { name = "Electronics" });

        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal(HttpStatusCode.Created, otherUser.StatusCode);
    }

    [Fact]
    public async Task TheListShowsOnlyYourCategories_WithProductCounts()
    {
        var user = await _factory.RegisterUserAsync();
        var other = await _factory.RegisterUserAsync();
        var mine = await user.Client.CreateCategoryAsync("Mine");
        await other.Client.CreateCategoryAsync("Theirs");
        await user.Client.CreateProductAsync("P1", categoryId: mine.Id);
        await user.Client.CreateProductAsync("P2", categoryId: mine.Id);

        var list = await (await user.Client.GetAsync("/api/categories")).ReadAsync<List<CategoryDto>>();

        var only = Assert.Single(list);
        Assert.Equal("Mine", only.Name);
        Assert.Equal(2, only.ProductCount);
    }

    [Fact]
    public async Task DeletingACategoryKeepsItsProducts()
    {
        var user = await _factory.RegisterUserAsync();
        var category = await user.Client.CreateCategoryAsync("Temporary");
        var product = await user.Client.CreateProductAsync("Survivor", categoryId: category.Id);

        var delete = await user.Client.DeleteAsync($"/api/categories/{category.Id}");
        var loaded = await (await user.Client.GetAsync($"/api/products/{product.Id}")).ReadAsync<Product>();

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal("Survivor", loaded.Name);
        Assert.Null(loaded.CategoryId);
        Assert.Null(loaded.Category);
    }

    [Fact]
    public async Task AProductCannotUseAnotherUsersCategory()
    {
        var owner = await _factory.RegisterUserAsync();
        var intruder = await _factory.RegisterUserAsync();
        var category = await owner.Client.CreateCategoryAsync("Private");

        var response = await intruder.Client.PostAsJsonAsync("/api/products",
            new { name = "Sneaky", price = 1, quantity = 1, categoryId = category.Id });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("does not exist", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task YouCannotRenameOrDeleteSomeoneElsesCategory()
    {
        var owner = await _factory.RegisterUserAsync();
        var intruder = await _factory.RegisterUserAsync();
        var category = await owner.Client.CreateCategoryAsync("Protected");

        var rename = await intruder.Client.PutAsJsonAsync($"/api/categories/{category.Id}", new { name = "Hacked" });
        var delete = await intruder.Client.DeleteAsync($"/api/categories/{category.Id}");

        Assert.Equal(HttpStatusCode.NotFound, rename.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
    }
}
