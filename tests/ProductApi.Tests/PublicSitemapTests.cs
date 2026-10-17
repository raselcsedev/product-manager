using System.Net;
using System.Net.Http.Json;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class PublicSitemapTests
{
    private readonly ApiFactory _factory;

    public PublicSitemapTests(ApiFactory factory) => _factory = factory;

    private static string Tag() => Guid.NewGuid().ToString("N")[..8];

    private static async Task<Product> CreateProductAsync(HttpClient client, string name, bool published)
    {
        var response = await client.PostAsJsonAsync("/api/products", new { name, price = 10m, quantity = 5, isPublished = published });
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<Product>();
    }

    [Fact]
    public async Task TheSitemapNeedsNoLogin()
    {
        var response = await _factory.CreateClient().GetAsync("/api/public/sitemap");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task TheSitemapListsOnlyPublishedProducts_AndShopsThatHaveSome()
    {
        var tag = Tag();
        var busySlug = $"busy-{tag}";
        var emptySlug = $"empty-{tag}";
        var busy = await _factory.RegisterUserAsync();
        var empty = await _factory.RegisterUserAsync();
        await busy.Client.PutAsJsonAsync("/api/my-shop", new { shopName = "Busy Shop", shopSlug = busySlug });
        await empty.Client.PutAsJsonAsync("/api/my-shop", new { shopName = "Empty Shop", shopSlug = emptySlug });
        await CreateProductAsync(empty.Client, $"{tag} private only", published: false);
        var hidden = await CreateProductAsync(busy.Client, $"{tag} hidden", published: false);
        var visible = await CreateProductAsync(busy.Client, $"{tag} visible", published: true); // newest published product

        var sitemap = await (await _factory.CreateClient().GetAsync("/api/public/sitemap")).ReadAsync<PublicSitemapDto>();

        Assert.Equal(visible.Id, sitemap.ProductIds[0]); // newest first
        Assert.DoesNotContain(hidden.Id, sitemap.ProductIds);
        Assert.Contains(busySlug, sitemap.ShopSlugs);
        Assert.DoesNotContain(emptySlug, sitemap.ShopSlugs);
    }

    [Fact]
    public async Task TheSitemapContainsOnlyIdsAndAddresses_NeverNamesOrEmails()
    {
        var secretName = $"Secret-{Guid.NewGuid():N}";
        var seller = await _factory.RegisterUserAsync("Sitemap Seller");
        await CreateProductAsync(seller.Client, secretName, published: true);

        var raw = await (await _factory.CreateClient().GetAsync("/api/public/sitemap")).Content.ReadAsStringAsync();

        Assert.Contains("productIds", raw);
        Assert.DoesNotContain(secretName, raw);
        Assert.DoesNotContain(seller.Email, raw);
        Assert.DoesNotContain("Sitemap Seller", raw);
    }
}
