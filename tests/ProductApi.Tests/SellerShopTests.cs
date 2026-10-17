using System.Net;
using System.Net.Http.Json;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class SellerShopTests
{
    private readonly ApiFactory _factory;

    public SellerShopTests(ApiFactory factory) => _factory = factory;

    private static string Tag() => Guid.NewGuid().ToString("N")[..8];

    private static Task<HttpResponseMessage> SaveShopAsync(
        HttpClient client, string slug, string name = "Test Shop", string? description = "We sell things.") =>
        client.PutAsJsonAsync("/api/my-shop", new { shopName = name, shopSlug = slug, shopDescription = description });

    private static async Task<Product> CreateProductAsync(HttpClient client, string name, bool published, int? categoryId = null)
    {
        var response = await client.PostAsJsonAsync("/api/products",
            new { name, price = 10m, quantity = 5, categoryId, isPublished = published });
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<Product>();
    }

    [Fact]
    public async Task MyShop_RequiresALogin_AndStartsEmpty()
    {
        var user = await _factory.RegisterUserAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync("/api/my-shop")).StatusCode);

        var shop = await (await user.Client.GetAsync("/api/my-shop")).ReadAsync<MyShopDto>();
        Assert.Null(shop.ShopSlug);
        Assert.Null(shop.ShopName);
        Assert.Equal(0, shop.PublishedProductCount);
    }

    [Fact]
    public async Task CreatingAShop_PublishesAPage_ThatCountsOnlyPublishedProducts_AndRevealsNoAccountData()
    {
        var tag = Tag();
        var slug = $"shop-{tag}";
        var seller = await _factory.RegisterUserAsync("Private Account Name");
        await CreateProductAsync(seller.Client, $"{tag} one", published: true);
        await CreateProductAsync(seller.Client, $"{tag} two", published: true);
        await CreateProductAsync(seller.Client, $"{tag} hidden", published: false);

        var save = await SaveShopAsync(seller.Client, slug, "Nice Shop", "Great things.");
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        Assert.Equal(2, (await save.ReadAsync<MyShopDto>()).PublishedProductCount);

        var response = await _factory.CreateClient().GetAsync($"/api/public/shops/{slug}");
        var raw = await response.Content.ReadAsStringAsync();
        var shop = await response.ReadAsync<PublicShopDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Nice Shop", shop.Name);
        Assert.Equal(slug, shop.Slug);
        Assert.Equal("Great things.", shop.Description);
        Assert.Equal(2, shop.ProductCount);
        Assert.DoesNotContain(seller.Email, raw);
        Assert.DoesNotContain("Private Account Name", raw);
        Assert.DoesNotContain("ownerId", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("ab")]               // too short
    [InlineData("Has Space")]
    [InlineData("UPPERCASE")]
    [InlineData("-leading")]
    [InlineData("trailing-")]
    [InlineData("double--hyphen")]
    [InlineData("under_score")]
    public async Task TheShopAddress_MustBeLowercaseLettersNumbersAndSingleHyphens(string slug)
    {
        var seller = await _factory.RegisterUserAsync();

        var response = await SaveShopAsync(seller.Client, slug);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task TheShopNameMustBeAtLeastThreeCharacters()
    {
        var seller = await _factory.RegisterUserAsync();

        var response = await SaveShopAsync(seller.Client, $"shop-{Tag()}", name: "ab");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ADuplicateAddressIsRejected_ButYouMayKeepYourOwn()
    {
        var slug = $"shop-{Tag()}";
        var first = await _factory.RegisterUserAsync();
        var second = await _factory.RegisterUserAsync();

        Assert.Equal(HttpStatusCode.OK, (await SaveShopAsync(first.Client, slug)).StatusCode);

        var taken = await SaveShopAsync(second.Client, slug);
        var again = await SaveShopAsync(first.Client, slug, "Renamed Shop"); // same owner, same address

        Assert.Equal(HttpStatusCode.Conflict, taken.StatusCode);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
    }

    [Fact]
    public async Task ChangingTheAddress_MakesTheOldOneStopWorking()
    {
        var tag = Tag();
        var oldSlug = $"old-{tag}";
        var newSlug = $"new-{tag}";
        var seller = await _factory.RegisterUserAsync();
        await SaveShopAsync(seller.Client, oldSlug);
        var anonymous = _factory.CreateClient();

        await SaveShopAsync(seller.Client, newSlug);

        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/shops/{oldSlug}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"/api/public/shops/{newSlug}")).StatusCode);
    }

    [Fact]
    public async Task TheShopFilter_OnlyReturnsThatSellersPublishedProducts_AndCategories()
    {
        var tag = Tag();
        var slug1 = $"one-{tag}";
        var slug2 = $"two-{tag}";
        var seller1 = await _factory.RegisterUserAsync();
        var seller2 = await _factory.RegisterUserAsync();
        await SaveShopAsync(seller1.Client, slug1, "Shop One");
        await SaveShopAsync(seller2.Client, slug2, "Shop Two");

        var cat1 = await seller1.Client.CreateCategoryAsync($"C1-{tag}");
        var cat2 = await seller2.Client.CreateCategoryAsync($"C2-{tag}");
        await CreateProductAsync(seller1.Client, $"{tag} s1a", published: true, categoryId: cat1.Id);
        await CreateProductAsync(seller1.Client, $"{tag} s1b", published: true);
        await CreateProductAsync(seller1.Client, $"{tag} s1 private", published: false);
        await CreateProductAsync(seller2.Client, $"{tag} s2a", published: true, categoryId: cat2.Id);
        var anonymous = _factory.CreateClient();

        var shop1 = await (await anonymous.GetAsync($"/api/public/products?shop={slug1}&search={tag}")).ReadAsync<PagedResult<PublicProductDto>>();
        Assert.Equal(new[] { $"{tag} s1b", $"{tag} s1a" }, shop1.Items.Select(p => p.Name).ToArray()); // newest first, no private one

        var categories1 = await (await anonymous.GetAsync($"/api/public/categories?shop={slug1}")).ReadAsync<List<PublicCategoryDto>>();
        Assert.Contains(categories1, c => c.Name == $"C1-{tag}");
        Assert.DoesNotContain(categories1, c => c.Name == $"C2-{tag}");

        var categories2 = await (await anonymous.GetAsync($"/api/public/categories?shop={slug2}")).ReadAsync<List<PublicCategoryDto>>();
        Assert.Contains(categories2, c => c.Name == $"C2-{tag}");
        Assert.DoesNotContain(categories2, c => c.Name == $"C1-{tag}");
    }

    [Fact]
    public async Task ProductsShowTheirShop_OnlyWhenTheSellerHasOne()
    {
        var tag = Tag();
        var slug = $"shop-{tag}";
        var withShop = await _factory.RegisterUserAsync();
        var withoutShop = await _factory.RegisterUserAsync();
        await SaveShopAsync(withShop.Client, slug, "Named Shop");
        var branded = await CreateProductAsync(withShop.Client, $"{tag} branded", published: true);
        var anonymousSeller = await CreateProductAsync(withoutShop.Client, $"{tag} unbranded", published: true);
        var anonymous = _factory.CreateClient();

        var a = await (await anonymous.GetAsync($"/api/public/products/{branded.Id}")).ReadAsync<PublicProductDto>();
        var b = await (await anonymous.GetAsync($"/api/public/products/{anonymousSeller.Id}")).ReadAsync<PublicProductDto>();

        Assert.Equal("Named Shop", a.ShopName);
        Assert.Equal(slug, a.ShopSlug);
        Assert.Null(b.ShopName);
        Assert.Null(b.ShopSlug);
    }

    [Fact]
    public async Task TurningTheShopOff_RemovesThePage_ButKeepsTheProductsPublic()
    {
        var tag = Tag();
        var slug = $"shop-{tag}";
        var seller = await _factory.RegisterUserAsync();
        await SaveShopAsync(seller.Client, slug);
        var product = await CreateProductAsync(seller.Client, $"{tag} stays", published: true);
        var anonymous = _factory.CreateClient();

        var delete = await seller.Client.DeleteAsync("/api/my-shop");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/shops/{slug}")).StatusCode);
        var stillPublic = await (await anonymous.GetAsync($"/api/public/products/{product.Id}")).ReadAsync<PublicProductDto>();
        Assert.Null(stillPublic.ShopName); // but no longer linked to a shop
    }

    [Fact]
    public async Task TheDirectoryListsOnlyShopsWithPublishedProducts()
    {
        var tag = Tag();
        var busySlug = $"busy-{tag}";
        var emptySlug = $"empty-{tag}";
        var busy = await _factory.RegisterUserAsync();
        var empty = await _factory.RegisterUserAsync();
        await SaveShopAsync(busy.Client, busySlug, "Busy Shop");
        await SaveShopAsync(empty.Client, emptySlug, "Empty Shop");
        await CreateProductAsync(busy.Client, $"{tag} one", published: true);
        await CreateProductAsync(busy.Client, $"{tag} two", published: true);
        await CreateProductAsync(empty.Client, $"{tag} private", published: false);

        var shops = await (await _factory.CreateClient().GetAsync("/api/public/shops")).ReadAsync<List<PublicShopDto>>();

        Assert.Equal(2, Assert.Single(shops, s => s.Slug == busySlug).ProductCount);
        Assert.DoesNotContain(shops, s => s.Slug == emptySlug);
    }

    [Fact]
    public async Task UnknownAndMalformedShopAddresses_GiveA404()
    {
        var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync("/api/public/shops/does-not-exist-123")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync("/api/public/shops/UPPER")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync("/api/public/shops/has_underscore")).StatusCode);
    }

    [Theory]
    [InlineData("/api/public/products?shop=Bad Slug")]
    [InlineData("/api/public/products?shop=UPPER")]
    [InlineData("/api/public/categories?shop=Bad_Slug")]
    public async Task AMalformedShopFilterIsRejected(string url)
    {
        var response = await _factory.CreateClient().GetAsync(url);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ShopPageChanges_AreRecordedInTheActivityHistory()
    {
        var slug = $"shop-{Tag()}";
        var seller = await _factory.RegisterUserAsync();

        await SaveShopAsync(seller.Client, slug);
        await seller.Client.DeleteAsync("/api/my-shop");

        var activity = await seller.Client.GetActivityAsync("entityType=User");

        Assert.Equal("Shop page removed", activity.Items[0].Details);
        Assert.Equal($"Shop page created: /shops/{slug}", activity.Items[1].Details);
    }
}
