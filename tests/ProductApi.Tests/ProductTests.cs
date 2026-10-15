using System.Net;
using System.Net.Http.Json;
using System.Text;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class ProductTests
{
    private readonly ApiFactory _factory;

    public ProductTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task EveryProductEndpointRequiresALogin()
    {
        var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/products")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/products/summary")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/products/export")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.PostAsJsonAsync("/api/products", new { name = "X", price = 1, quantity = 1 })).StatusCode);
    }

    [Fact]
    public async Task Create_ReturnsTheProduct_AndNeverExposesTheOwnerId()
    {
        var user = await _factory.RegisterUserAsync();

        var response = await user.Client.PostAsJsonAsync("/api/products", new { name = "Mouse", price = 19.99m, quantity = 25 });
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        Assert.DoesNotContain("ownerId", body, StringComparison.OrdinalIgnoreCase);

        var product = await response.ReadAsync<Product>();
        Assert.True(product.Id > 0);
        Assert.Equal("Mouse", product.Name);
        Assert.Equal(19.99m, product.Price);
        Assert.Equal(25, product.Quantity);
        Assert.Null(product.ImageFileName);
    }

    [Theory]
    [InlineData("", 10.0, 1, "Product name is required.")]
    [InlineData("Mouse", 0.0, 1, "Price must be greater than zero.")]
    [InlineData("Mouse", -5.0, 1, "Price must be greater than zero.")]
    [InlineData("Mouse", 10.0, -1, "Quantity cannot be negative.")]
    public async Task Create_RejectsInvalidData(string name, double price, int quantity, string expectedMessage)
    {
        var user = await _factory.RegisterUserAsync();

        var response = await user.Client.PostAsJsonAsync("/api/products", new { name, price, quantity });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(expectedMessage, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Create_IgnoresAnOwnerOrImageSuppliedByTheClient()
    {
        var thief = await _factory.RegisterUserAsync();
        var victim = await _factory.RegisterUserAsync();

        var response = await thief.Client.PostAsJsonAsync("/api/products",
            new { name = "Mine", price = 5, quantity = 1, ownerId = victim.Id, imageFileName = "hacked.jpg" });
        var created = await response.ReadAsync<Product>();

        Assert.Null(created.ImageFileName);
        Assert.Single((await thief.Client.ListProductsAsync()).Items, p => p.Id == created.Id);
        Assert.DoesNotContain((await victim.Client.ListProductsAsync()).Items, p => p.Id == created.Id);
    }

    [Fact]
    public async Task List_SupportsSearchSortingFiltersAndPaging()
    {
        var user = await _factory.RegisterUserAsync();
        await user.Client.CreateProductAsync("Alpha Mouse", 30m, 5);      // low stock
        await user.Client.CreateProductAsync("Beta Keyboard", 10m, 0);    // out of stock
        await user.Client.CreateProductAsync("Gamma Mouse", 20m, 50);     // in stock

        // search
        Assert.Equal(2, (await user.Client.ListProductsAsync("search=mouse")).TotalCount);

        // sorting
        var byPrice = await user.Client.ListProductsAsync("sortBy=price&sortDir=desc");
        Assert.Equal(new[] { "Alpha Mouse", "Gamma Mouse", "Beta Keyboard" }, byPrice.Items.Select(p => p.Name).ToArray());

        // stock filters
        Assert.Equal("Alpha Mouse", Assert.Single((await user.Client.ListProductsAsync("stock=low")).Items).Name);
        Assert.Equal("Beta Keyboard", Assert.Single((await user.Client.ListProductsAsync("stock=out")).Items).Name);
        Assert.Equal("Gamma Mouse", Assert.Single((await user.Client.ListProductsAsync("stock=in")).Items).Name);

        // price range
        Assert.Equal("Gamma Mouse", Assert.Single((await user.Client.ListProductsAsync("minPrice=15&maxPrice=25")).Items).Name);

        // paging: 3 products, 2 per page -> 2 pages, the second has one item
        var page2 = await user.Client.ListProductsAsync("sortBy=name&pageSize=2&page=2");
        Assert.Equal(3, page2.TotalCount);
        Assert.Equal(2, page2.TotalPages);
        Assert.Equal("Gamma Mouse", Assert.Single(page2.Items).Name);
    }

    [Theory]
    [InlineData("minPrice=50&maxPrice=1")]
    [InlineData("pageSize=500")]
    [InlineData("page=0")]
    [InlineData("sortBy=password")]
    [InlineData("stock=maybe")]
    public async Task List_RejectsBadQueryValues(string query)
    {
        var user = await _factory.RegisterUserAsync();

        var response = await user.Client.GetAsync($"/api/products?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_RejectsAMismatchedId_AndSavesValidChanges()
    {
        var user = await _factory.RegisterUserAsync();
        var product = await user.Client.CreateProductAsync("Old name", 10m, 5);

        var mismatched = await user.Client.PutAsJsonAsync($"/api/products/{product.Id}",
            new { id = product.Id + 1, name = "X", price = 1, quantity = 1 });
        var valid = await user.Client.PutAsJsonAsync($"/api/products/{product.Id}",
            new { id = product.Id, name = "New name", price = 12.5m, quantity = 9 });
        var loaded = await (await user.Client.GetAsync($"/api/products/{product.Id}")).ReadAsync<Product>();

        Assert.Equal(HttpStatusCode.BadRequest, mismatched.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, valid.StatusCode);
        Assert.Equal("New name", loaded.Name);
        Assert.Equal(12.5m, loaded.Price);
        Assert.Equal(9, loaded.Quantity);
    }

    [Fact]
    public async Task Delete_RemovesTheProduct()
    {
        var user = await _factory.RegisterUserAsync();
        var product = await user.Client.CreateProductAsync();

        var delete = await user.Client.DeleteAsync($"/api/products/{product.Id}");
        var after = await user.Client.GetAsync($"/api/products/{product.Id}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
    }

    [Fact]
    public async Task Users_CannotSeeOrChangeEachOthersProducts()
    {
        var owner = await _factory.RegisterUserAsync();
        var intruder = await _factory.RegisterUserAsync();
        var product = await owner.Client.CreateProductAsync("Owner's product");

        // Not in the intruder's list
        Assert.Empty((await intruder.Client.ListProductsAsync()).Items);

        // 404 (not 403), so the intruder cannot even tell the product exists
        Assert.Equal(HttpStatusCode.NotFound, (await intruder.Client.GetAsync($"/api/products/{product.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await intruder.Client.PutAsJsonAsync($"/api/products/{product.Id}",
                new { id = product.Id, name = "Hacked", price = 1, quantity = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await intruder.Client.DeleteAsync($"/api/products/{product.Id}")).StatusCode);

        // ...and the owner's product is untouched
        var stillThere = await (await owner.Client.GetAsync($"/api/products/{product.Id}")).ReadAsync<Product>();
        Assert.Equal("Owner's product", stillThere.Name);
    }

    [Fact]
    public async Task Export_ReturnsAUtf8CsvFile_ThatNeutralizesFormulas_AndOnlyContainsYourData()
    {
        var user = await _factory.RegisterUserAsync();
        var other = await _factory.RegisterUserAsync();
        await user.Client.CreateProductAsync("=HYPERLINK(\"http://evil.test\")", 5m, 3, description: "Comma, inside");
        await user.Client.CreateProductAsync("Normal", 7m, 50);
        await other.Client.CreateProductAsync("OtherUsersSecret", 1m, 1);

        var response = await user.Client.GetAsync("/api/products/export");
        var bytes = await response.Content.ReadAsByteArrayAsync();
        var text = Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, bytes[..3]); // BOM, so Excel reads it as UTF-8
        Assert.StartsWith("Id,Name,Category,Description,Price,Quantity,Status", text);
        Assert.Contains("\"'=HYPERLINK(\"\"http://evil.test\"\")\"", text); // formula neutralized
        Assert.Contains("\"Comma, inside\"", text);
        Assert.Contains(",7.00,50,In stock", text);
        Assert.DoesNotContain("OtherUsersSecret", text);
    }

    [Fact]
    public async Task Export_UsesTheSameFiltersAsTheList()
    {
        var user = await _factory.RegisterUserAsync();
        await user.Client.CreateProductAsync("Keep Me", 5m, 3);
        await user.Client.CreateProductAsync("Skip This", 5m, 3);

        var text = await (await user.Client.GetAsync("/api/products/export?search=keep")).Content.ReadAsStringAsync();

        Assert.Contains("Keep Me", text);
        Assert.DoesNotContain("Skip This", text);
    }

    [Fact]
    public async Task Summary_AddsUpTheUsersProducts()
    {
        var user = await _factory.RegisterUserAsync();
        await user.Client.CreateProductAsync("A", 10m, 0);
        await user.Client.CreateProductAsync("B", 2m, 5);
        await user.Client.CreateProductAsync("C", 4m, 50);

        var summary = await (await user.Client.GetAsync("/api/products/summary")).ReadAsync<ProductSummary>();

        Assert.Equal(3, summary.TotalProducts);
        Assert.Equal(55, summary.TotalUnits);
        Assert.Equal(210m, summary.InventoryValue); // 10*0 + 2*5 + 4*50
        Assert.Equal(2, summary.LowStockCount);     // quantity 0 and 5 are both under the limit
        Assert.Equal("A", summary.LowStock[0].Name); // the emptiest first
    }
}
