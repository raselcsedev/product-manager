using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class PublicShopTests
{
    private readonly ApiFactory _factory;

    public PublicShopTests(ApiFactory factory) => _factory = factory;

    // A short random text, so every test finds only ITS OWN products among everything published by other tests.
    private static string Tag() => Guid.NewGuid().ToString("N")[..8];

    private static async Task<Product> CreatePublishedAsync(
        HttpClient client, string name, decimal price = 10m, int quantity = 5, int? categoryId = null)
    {
        var response = await client.PostAsJsonAsync("/api/products",
            new { name, price, quantity, categoryId, isPublished = true });
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<Product>();
    }

    private static async Task SetPublishedAsync(HttpClient client, Product product, bool published)
    {
        var response = await client.PutAsJsonAsync($"/api/products/{product.Id}",
            new { id = product.Id, name = product.Name, price = product.Price, quantity = product.Quantity, isPublished = published });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private static async Task<PagedResult<PublicProductDto>> ListPublicAsync(HttpClient client, string query)
    {
        var response = await client.GetAsync($"/api/public/products?{query}");
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<PagedResult<PublicProductDto>>();
    }

    [Fact]
    public async Task NewProductsAreFlaggedPrivateByDefault()
    {
        var tag = Tag();
        var owner = await _factory.RegisterUserAsync();
        var product = await owner.Client.CreateProductAsync($"{tag} Private lamp");
        var anonymous = _factory.CreateClient();

        Assert.False(product.IsPublished);
        Assert.Empty((await ListPublicAsync(anonymous, $"search={tag}")).Items);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/products/{product.Id}")).StatusCode);
    }

    [Fact]
    public async Task PublishingMakesAProductVisible_AndUnpublishingHidesItAgain()
    {
        var tag = Tag();
        var owner = await _factory.RegisterUserAsync();
        var product = await owner.Client.CreateProductAsync($"{tag} Lamp", 15m, 5);
        var anonymous = _factory.CreateClient();

        await SetPublishedAsync(owner.Client, product, published: true);

        var listed = Assert.Single((await ListPublicAsync(anonymous, $"search={tag}")).Items);
        Assert.Equal(product.Id, listed.Id);
        Assert.Equal(15m, listed.Price);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"/api/public/products/{product.Id}")).StatusCode);

        await SetPublishedAsync(owner.Client, product, published: false);

        Assert.Empty((await ListPublicAsync(anonymous, $"search={tag}")).Items);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/products/{product.Id}")).StatusCode);
    }

    [Fact]
    public async Task AProductCreatedAsPublishedIsVisibleImmediately()
    {
        var tag = Tag();
        var owner = await _factory.RegisterUserAsync();
        await CreatePublishedAsync(owner.Client, $"{tag} Instant");

        var listed = await ListPublicAsync(_factory.CreateClient(), $"search={tag}");

        Assert.Single(listed.Items);
    }

    [Fact]
    public async Task PublicResponsesNeverExposePrivateFields()
    {
        var tag = Tag();
        var owner = await _factory.RegisterUserAsync("Secret Seller");
        var product = await CreatePublishedAsync(owner.Client, $"{tag} Gadget", 9m, 7);
        var anonymous = _factory.CreateClient();

        foreach (var url in new[] { $"/api/public/products/{product.Id}", $"/api/public/products?search={tag}" })
        {
            var raw = await (await anonymous.GetAsync(url)).Content.ReadAsStringAsync();

            Assert.Contains("availability", raw, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("ownerId", raw, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("quantity", raw, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("isPublished", raw, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(owner.Email, raw);
            Assert.DoesNotContain("Secret Seller", raw);
        }
    }

    [Fact]
    public async Task AvailabilityIsShownInsteadOfTheExactStock()
    {
        var tag = Tag();
        var owner = await _factory.RegisterUserAsync();
        await CreatePublishedAsync(owner.Client, $"{tag} Empty", quantity: 0);
        await CreatePublishedAsync(owner.Client, $"{tag} Few", quantity: 5);
        await CreatePublishedAsync(owner.Client, $"{tag} Plenty", quantity: 50);

        var items = (await ListPublicAsync(_factory.CreateClient(), $"search={tag}")).Items;

        Assert.Equal("Out of stock", items.Single(p => p.Name.EndsWith("Empty")).Availability);
        Assert.Equal("Low stock", items.Single(p => p.Name.EndsWith("Few")).Availability);
        Assert.Equal("In stock", items.Single(p => p.Name.EndsWith("Plenty")).Availability);
    }

    [Fact]
    public async Task OnlyTheOwnerCanPublishAProduct()
    {
        var tag = Tag();
        var owner = await _factory.RegisterUserAsync();
        var intruder = await _factory.RegisterUserAsync();
        var product = await owner.Client.CreateProductAsync($"{tag} Protected");

        var response = await intruder.Client.PutAsJsonAsync($"/api/products/{product.Id}",
            new { id = product.Id, name = product.Name, price = product.Price, quantity = product.Quantity, isPublished = true });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty((await ListPublicAsync(_factory.CreateClient(), $"search={tag}")).Items);
    }

    [Fact]
    public async Task DeletingAProductRemovesItFromTheShop()
    {
        var tag = Tag();
        var owner = await _factory.RegisterUserAsync();
        var product = await CreatePublishedAsync(owner.Client, $"{tag} Short-lived");

        await owner.Client.DeleteAsync($"/api/products/{product.Id}");

        Assert.Equal(HttpStatusCode.NotFound, (await _factory.CreateClient().GetAsync($"/api/public/products/{product.Id}")).StatusCode);
    }

    [Fact]
    public async Task TheShopSupportsSearchCategorySortingAndPaging()
    {
        var tag = Tag();
        var seller = await _factory.RegisterUserAsync();
        var category = await seller.Client.CreateCategoryAsync($"Cat-{tag}");
        await CreatePublishedAsync(seller.Client, $"{tag} Cheap", 5m, categoryId: category.Id);
        await CreatePublishedAsync(seller.Client, $"{tag} Pricey", 50m, categoryId: category.Id);
        await CreatePublishedAsync(seller.Client, $"{tag} Plain", 20m);
        var anonymous = _factory.CreateClient();

        Assert.Equal(3, (await ListPublicAsync(anonymous, $"search={tag}")).TotalCount);
        Assert.Equal(2, (await ListPublicAsync(anonymous, $"search={tag}&category=Cat-{tag}")).TotalCount);

        string[] Names(PagedResult<PublicProductDto> page) => page.Items.Select(p => p.Name[(tag.Length + 1)..]).ToArray();

        Assert.Equal(new[] { "Plain", "Pricey", "Cheap" }, Names(await ListPublicAsync(anonymous, $"search={tag}")));                       // newest first
        Assert.Equal(new[] { "Pricey", "Plain", "Cheap" }, Names(await ListPublicAsync(anonymous, $"search={tag}&sort=price_desc")));
        Assert.Equal(new[] { "Cheap", "Plain", "Pricey" }, Names(await ListPublicAsync(anonymous, $"search={tag}&sort=price_asc")));
        Assert.Equal(new[] { "Cheap", "Plain", "Pricey" }, Names(await ListPublicAsync(anonymous, $"search={tag}&sort=name_asc")));

        var page2 = await ListPublicAsync(anonymous, $"search={tag}&sort=price_asc&pageSize=2&page=2");
        Assert.Equal(2, page2.TotalPages);
        Assert.Equal("Pricey", Assert.Single(Names(page2)));
    }

    [Fact]
    public async Task PublicCategoriesCountOnlyPublishedProducts()
    {
        var tag = Tag();
        var seller = await _factory.RegisterUserAsync();
        var category = await seller.Client.CreateCategoryAsync($"Shelf-{tag}");
        await CreatePublishedAsync(seller.Client, $"{tag} One", categoryId: category.Id);
        await CreatePublishedAsync(seller.Client, $"{tag} Two", categoryId: category.Id);
        await seller.Client.CreateProductAsync($"{tag} Hidden", categoryId: category.Id); // private

        var categories = await (await _factory.CreateClient().GetAsync("/api/public/categories")).ReadAsync<List<PublicCategoryDto>>();

        Assert.Equal(2, Assert.Single(categories, c => c.Name == $"Shelf-{tag}").ProductCount);
    }

    [Fact]
    public async Task RelatedProductsPreferTheSameCategory_ThenTheSameSeller_AndSkipPrivateOnes()
    {
        var tag = Tag();
        var sellerA = await _factory.RegisterUserAsync();
        var sellerB = await _factory.RegisterUserAsync();
        var categoryA = await sellerA.Client.CreateCategoryAsync($"Rel-{tag}");
        var categoryB = await sellerB.Client.CreateCategoryAsync($"Rel-{tag}"); // same NAME, different seller

        var a1 = await CreatePublishedAsync(sellerA.Client, $"{tag} a1", categoryId: categoryA.Id);
        var a2 = await CreatePublishedAsync(sellerA.Client, $"{tag} a2", categoryId: categoryA.Id);
        var a3 = await CreatePublishedAsync(sellerA.Client, $"{tag} a3");                              // same seller, no category
        await sellerA.Client.CreateProductAsync($"{tag} a4 private", categoryId: categoryA.Id);        // private
        var b1 = await CreatePublishedAsync(sellerB.Client, $"{tag} b1", categoryId: categoryB.Id);   // same category name
        await CreatePublishedAsync(sellerB.Client, $"{tag} b2 unrelated");                             // other seller, no category

        var anonymous = _factory.CreateClient();

        var related = await (await anonymous.GetAsync($"/api/public/products/{a1.Id}/related?limit=10")).ReadAsync<List<PublicProductDto>>();
        // same category + same seller, then same category, then same seller. Never itself, never private.
        Assert.Equal(new[] { a2.Id, b1.Id, a3.Id }, related.Select(p => p.Id).ToArray());

        var limited = await (await anonymous.GetAsync($"/api/public/products/{a1.Id}/related?limit=1")).ReadAsync<List<PublicProductDto>>();
        Assert.Equal(a2.Id, Assert.Single(limited).Id);

        // a product without a category is related to its seller's other published products only
        var forUncategorized = await (await anonymous.GetAsync($"/api/public/products/{a3.Id}/related")).ReadAsync<List<PublicProductDto>>();
        Assert.Equal(new[] { a2.Id, a1.Id }, forUncategorized.Select(p => p.Id).ToArray());
    }

    [Fact]
    public async Task UnknownAndUnpublishedProductsGiveTheSame404()
    {
        var owner = await _factory.RegisterUserAsync();
        var hidden = await owner.Client.CreateProductAsync($"{Tag()} Hidden");
        var anonymous = _factory.CreateClient();

        var missing = await anonymous.GetAsync("/api/public/products/99999999");
        var unpublished = await anonymous.GetAsync($"/api/public/products/{hidden.Id}");
        var relatedMissing = await anonymous.GetAsync("/api/public/products/99999999/related");
        var relatedUnpublished = await anonymous.GetAsync($"/api/public/products/{hidden.Id}/related");

        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unpublished.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, relatedMissing.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, relatedUnpublished.StatusCode);
        // identical answers: nobody can tell "private" from "does not exist"
        Assert.Equal(await missing.Content.ReadAsStringAsync(), await unpublished.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task PublicEndpointsWorkWithoutLogin_EvenWithABrokenToken()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "this.is.garbage");

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/public/products")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/public/categories")).StatusCode);
    }

    [Theory]
    [InlineData("pageSize=1000")]
    [InlineData("page=0")]
    [InlineData("sort=hack")]
    public async Task PublicListRejectsBadQueryValues(string query)
    {
        var response = await _factory.CreateClient().GetAsync($"/api/public/products?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PublicSearchTextIsLengthLimited()
    {
        var response = await _factory.CreateClient().GetAsync($"/api/public/products?search={new string('a', 101)}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PublishingAndUnpublishingAreRecordedInTheActivityHistory()
    {
        var owner = await _factory.RegisterUserAsync();
        var product = await owner.Client.CreateProductAsync($"{Tag()} Tracked");

        await SetPublishedAsync(owner.Client, product, published: true);
        await SetPublishedAsync(owner.Client, product, published: false);

        var activity = await owner.Client.GetActivityAsync("entityType=Product");

        Assert.Equal("Removed from the public shop", activity.Items[0].Details);
        Assert.Equal("Published on the public shop", activity.Items[1].Details);
    }
}
