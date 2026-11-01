using System.Net;
using System.Net.Http.Json;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class SalesTests
{
    private readonly ApiFactory _factory;

    public SalesTests(ApiFactory factory) => _factory = factory;

    private static object Line(Product product, int quantity) => new { productId = product.Id, quantity };

    private static Task<HttpResponseMessage> PostSaleAsync(
        HttpClient client, object[] items, decimal discount = 0m, decimal tax = 0m,
        string payment = "Cash", decimal? tendered = 100000m) =>
        client.PostAsJsonAsync("/api/sales",
            new { items, discount, taxRatePercent = tax, paymentMethod = payment, amountTendered = tendered });

    private static async Task<SaleDto> SellAsync(HttpClient client, params object[] items)
    {
        var response = await PostSaleAsync(client, items);
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<SaleDto>();
    }

    private static async Task<int> StockAsync(HttpClient client, Product product) =>
        (await (await client.GetAsync($"/api/products/{product.Id}")).ReadAsync<Product>()).Quantity;

    // ---------- the sale itself ----------

    [Fact]
    public async Task EverySalesEndpointRequiresALogin()
    {
        var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/sales")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/sales/summary")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/sales/1")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/sales", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/sales/1/void", new { reason = "x" })).StatusCode);
    }

    [Fact]
    public async Task ASale_IsCalculatedByTheServer_AndTakesTheStock()
    {
        var seller = await _factory.RegisterUserAsync("Cashier Chris");
        var a = await seller.Client.CreateProductAsync("Item A", 10.00m, 5);
        var b = await seller.Client.CreateProductAsync("Item B", 2.50m, 10);

        var response = await PostSaleAsync(seller.Client, new[] { Line(a, 2), Line(b, 4) },
            discount: 5m, tax: 10m, payment: "Cash", tendered: 30m);
        var sale = await response.ReadAsync<SaleDto>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(30.00m, sale.Subtotal);          // 2 x 10.00 + 4 x 2.50
        Assert.Equal(5.00m, sale.DiscountAmount);
        Assert.Equal(2.50m, sale.TaxAmount);          // 10% of (30 - 5)
        Assert.Equal(27.50m, sale.Total);
        Assert.Equal(30.00m, sale.AmountTendered);
        Assert.Equal(2.50m, sale.ChangeGiven);
        Assert.Equal("R-000001", sale.ReceiptNumber);
        Assert.Equal("Cashier Chris", sale.CashierName);
        Assert.Equal(2, sale.Items.Count);
        Assert.Contains(sale.Items, i => i.ProductName == "Item A" && i.UnitPrice == 10.00m && i.Quantity == 2 && i.LineTotal == 20.00m);

        Assert.Equal(3, await StockAsync(seller.Client, a));
        Assert.Equal(6, await StockAsync(seller.Client, b));
    }

    [Fact]
    public async Task TaxIsRoundedToTheNearestCent_HalvesGoUp()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Rounding", 10.50m, 5);

        // (10.50 - 0.50) x 8.25% = 0.825 -> 0.83
        var sale = await (await PostSaleAsync(seller.Client, new[] { Line(product, 1) }, discount: 0.50m, tax: 8.25m, tendered: 20m))
            .ReadAsync<SaleDto>();

        Assert.Equal(0.83m, sale.TaxAmount);
        Assert.Equal(10.83m, sale.Total);
        Assert.Equal(9.17m, sale.ChangeGiven);
    }

    [Fact]
    public async Task CardAndMobileSales_AreForTheExactTotal_WithNoChange()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Gadget", 20m, 5);

        var card = await (await PostSaleAsync(seller.Client, new[] { Line(product, 1) }, payment: "Card", tendered: null)).ReadAsync<SaleDto>();
        var mobile = await (await PostSaleAsync(seller.Client, new[] { Line(product, 1) }, payment: "Mobile", tendered: 5m)).ReadAsync<SaleDto>();

        Assert.Equal(20m, card.AmountTendered);
        Assert.Equal(0m, card.ChangeGiven);
        Assert.Equal(20m, mobile.AmountTendered); // the "5" sent by mistake is ignored
        Assert.Equal(0m, mobile.ChangeGiven);
    }

    [Fact]
    public async Task ReceiptNumbers_AreCountedSeparatelyForEverySeller()
    {
        var sellerA = await _factory.RegisterUserAsync();
        var sellerB = await _factory.RegisterUserAsync();
        var productA = await sellerA.Client.CreateProductAsync("A", 1m, 10);
        var productB = await sellerB.Client.CreateProductAsync("B", 1m, 10);

        var a1 = await SellAsync(sellerA.Client, Line(productA, 1));
        var a2 = await SellAsync(sellerA.Client, Line(productA, 1));
        var b1 = await SellAsync(sellerB.Client, Line(productB, 1));

        Assert.Equal(new[] { 1, 2 }, new[] { a1.SaleNumber, a2.SaleNumber });
        Assert.Equal("R-000002", a2.ReceiptNumber);
        Assert.Equal(1, b1.SaleNumber);
    }

    [Fact]
    public async Task TheReceiptShowsTheShopName_OrTheAccountNameWhenThereIsNoShop()
    {
        var withShop = await _factory.RegisterUserAsync("Plain Person");
        await withShop.Client.PutAsJsonAsync("/api/my-shop", new { shopName = "Fancy Shop", shopSlug = $"fancy-{Guid.NewGuid():N}"[..20] });
        var withoutShop = await _factory.RegisterUserAsync("No Shop Person");
        var p1 = await withShop.Client.CreateProductAsync("X", 1m, 5);
        var p2 = await withoutShop.Client.CreateProductAsync("Y", 1m, 5);

        Assert.Equal("Fancy Shop", (await SellAsync(withShop.Client, Line(p1, 1))).ShopName);
        Assert.Equal("No Shop Person", (await SellAsync(withoutShop.Client, Line(p2, 1))).ShopName);
    }

    // ---------- stock safety ----------

    [Fact]
    public async Task NotEnoughStock_IsRefused_AndNothingChanges_EvenForTheLinesBeforeIt()
    {
        var seller = await _factory.RegisterUserAsync();
        var plenty = await seller.Client.CreateProductAsync("Plenty", 5m, 10);
        var scarce = await seller.Client.CreateProductAsync("Scarce", 5m, 1);

        var response = await PostSaleAsync(seller.Client, new[] { Line(plenty, 3), Line(scarce, 2) });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("Scarce", await response.Content.ReadAsStringAsync());
        Assert.Equal(10, await StockAsync(seller.Client, plenty)); // the stock taken for the first line was given back
        Assert.Equal(1, await StockAsync(seller.Client, scarce));
        Assert.Equal(0, (await (await seller.Client.GetAsync("/api/sales")).ReadAsync<PagedResult<SaleListItemDto>>()).TotalCount);
    }

    [Fact]
    public async Task AnOutOfStockProductCannotBeSold()
    {
        var seller = await _factory.RegisterUserAsync();
        var empty = await seller.Client.CreateProductAsync("Empty", 5m, 0);

        Assert.Equal(HttpStatusCode.Conflict, (await PostSaleAsync(seller.Client, new[] { Line(empty, 1) })).StatusCode);
    }

    [Fact]
    public async Task TwoSalesOfTheLastItemAtTheSameMoment_OnlyOneWins()
    {
        var seller = await _factory.RegisterUserAsync();
        var last = await seller.Client.CreateProductAsync("The last one", 5m, 1);

        var results = await Task.WhenAll(
            PostSaleAsync(seller.Client, new[] { Line(last, 1) }),
            PostSaleAsync(seller.Client, new[] { Line(last, 1) }));

        var statuses = results.Select(r => r.StatusCode).OrderBy(s => (int)s).ToArray();
        Assert.Equal(new[] { HttpStatusCode.Created, HttpStatusCode.Conflict }, statuses);
        Assert.Equal(0, await StockAsync(seller.Client, last)); // never negative: no overselling
        Assert.Equal(1, (await (await seller.Client.GetAsync("/api/sales")).ReadAsync<PagedResult<SaleListItemDto>>()).TotalCount);
    }

    // ---------- validation ----------

    [Fact]
    public async Task InvalidSalesAreRefused()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Valid", 10m, 50);

        async Task AssertBadRequest(Task<HttpResponseMessage> request, string because)
        {
            var response = await request;
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"{because}: got {(int)response.StatusCode}");
        }

        await AssertBadRequest(PostSaleAsync(seller.Client, Array.Empty<object>()), "no products");
        await AssertBadRequest(PostSaleAsync(seller.Client, new[] { Line(product, 0) }), "quantity 0");
        await AssertBadRequest(PostSaleAsync(seller.Client, new[] { Line(product, 10000) }), "quantity too big");
        await AssertBadRequest(PostSaleAsync(seller.Client, new[] { Line(product, 1), Line(product, 2) }), "the same product twice");
        await AssertBadRequest(PostSaleAsync(seller.Client, new[] { Line(product, 1) }, discount: 11m), "discount larger than the subtotal");
        await AssertBadRequest(PostSaleAsync(seller.Client, new[] { Line(product, 1) }, discount: -1m), "negative discount");
        await AssertBadRequest(PostSaleAsync(seller.Client, new[] { Line(product, 1) }, tax: 101m), "tax over 100%");
        await AssertBadRequest(PostSaleAsync(seller.Client, new[] { Line(product, 1) }, payment: "Bitcoin"), "unknown payment method");
        await AssertBadRequest(PostSaleAsync(seller.Client, new[] { Line(product, 1) }, tendered: 9.99m), "cash less than the total");
        await AssertBadRequest(PostSaleAsync(seller.Client, new[] { Line(product, 1) }, tendered: null), "cash without an amount");

        Assert.Equal(50, await StockAsync(seller.Client, product)); // nothing was sold
    }

    [Fact]
    public async Task AProductOfAnotherSellerOrAnUnknownOne_IsRefused()
    {
        var owner = await _factory.RegisterUserAsync();
        var intruder = await _factory.RegisterUserAsync();
        var product = await owner.Client.CreateProductAsync("Not yours", 5m, 5);

        var theirs = await PostSaleAsync(intruder.Client, new[] { Line(product, 1) });
        var unknown = await PostSaleAsync(intruder.Client, new object[] { new { productId = 99999999, quantity = 1 } });

        Assert.Equal(HttpStatusCode.BadRequest, theirs.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        Assert.Equal(5, await StockAsync(owner.Client, product)); // untouched
    }

    [Fact]
    public async Task AFreeSaleWithA100PercentDiscountIsAllowed()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Gift", 10m, 5);

        var sale = await (await PostSaleAsync(seller.Client, new[] { Line(product, 1) }, discount: 10m, tendered: 0m)).ReadAsync<SaleDto>();

        Assert.Equal(0m, sale.Total);
    }

    // ---------- privacy ----------

    [Fact]
    public async Task SellersOnlySeeAndChangeTheirOwnSales()
    {
        var owner = await _factory.RegisterUserAsync();
        var intruder = await _factory.RegisterUserAsync();
        var product = await owner.Client.CreateProductAsync("Private sale", 5m, 5);
        var sale = await SellAsync(owner.Client, Line(product, 1));

        Assert.Equal(0, (await (await intruder.Client.GetAsync("/api/sales")).ReadAsync<PagedResult<SaleListItemDto>>()).TotalCount);
        Assert.Equal(HttpStatusCode.NotFound, (await intruder.Client.GetAsync($"/api/sales/{sale.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await intruder.Client.PostAsJsonAsync($"/api/sales/{sale.Id}/void", new { reason = "Trying my luck" })).StatusCode);
        Assert.Equal(4, await StockAsync(owner.Client, product));
    }

    // ---------- voiding ----------

    [Fact]
    public async Task VoidingASale_PutsTheStockBack_ExactlyOnce()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Returnable", 5m, 10);
        var sale = await SellAsync(seller.Client, Line(product, 4));
        Assert.Equal(6, await StockAsync(seller.Client, product));

        var first = await seller.Client.PostAsJsonAsync($"/api/sales/{sale.Id}/void", new { reason = "Customer changed their mind" });
        var voided = await first.ReadAsync<SaleDto>();
        var second = await seller.Client.PostAsJsonAsync($"/api/sales/{sale.Id}/void", new { reason = "Again" });

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.True(voided.IsVoided);
        Assert.Equal("Customer changed their mind", voided.VoidReason);
        Assert.NotNull(voided.VoidedAt);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal(10, await StockAsync(seller.Client, product)); // back to 10, not 14
    }

    [Fact]
    public async Task VoidingNeedsAReason()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Item", 5m, 5);
        var sale = await SellAsync(seller.Client, Line(product, 1));

        Assert.Equal(HttpStatusCode.BadRequest,
            (await seller.Client.PostAsJsonAsync($"/api/sales/{sale.Id}/void", new { reason = "no" })).StatusCode);
        Assert.False((await (await seller.Client.GetAsync($"/api/sales/{sale.Id}")).ReadAsync<SaleDto>()).IsVoided);
    }

    [Fact]
    public async Task ASaleSurvivesTheDeletionOfItsProduct_AndCanStillBeVoided()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Short-lived", 7m, 5);
        var sale = await SellAsync(seller.Client, Line(product, 2));

        await seller.Client.DeleteAsync($"/api/products/{product.Id}");

        var loaded = await (await seller.Client.GetAsync($"/api/sales/{sale.Id}")).ReadAsync<SaleDto>();
        var item = Assert.Single(loaded.Items);
        Assert.Null(item.ProductId);                  // the link is gone
        Assert.Equal("Short-lived", item.ProductName); // the receipt still reads correctly
        Assert.Equal(14m, loaded.Total);

        var voided = await seller.Client.PostAsJsonAsync($"/api/sales/{sale.Id}/void", new { reason = "Returned after deletion" });
        Assert.Equal(HttpStatusCode.OK, voided.StatusCode);
    }

    [Fact]
    public async Task ARepricedProductDoesNotChangeAnOldReceipt()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Old price", 10m, 5);
        var sale = await SellAsync(seller.Client, Line(product, 1));

        await seller.Client.PutAsJsonAsync($"/api/products/{product.Id}",
            new { id = product.Id, name = "Renamed", price = 99m, quantity = 4 });

        var loaded = await (await seller.Client.GetAsync($"/api/sales/{sale.Id}")).ReadAsync<SaleDto>();
        Assert.Equal("Old price", loaded.Items[0].ProductName);
        Assert.Equal(10m, loaded.Items[0].UnitPrice);
        Assert.Equal(10m, loaded.Total);
    }

    // ---------- history and summary ----------

    [Fact]
    public async Task TheHistory_IsNewestFirst_AndFiltersAndPages()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Item", 10m, 50);

        var cash1 = await SellAsync(seller.Client, Line(product, 1));
        await PostSaleAsync(seller.Client, new[] { Line(product, 1) }, payment: "Card", tendered: null);
        var cash2 = await SellAsync(seller.Client, Line(product, 2));
        await seller.Client.PostAsJsonAsync($"/api/sales/{cash1.Id}/void", new { reason = "Mistake" });

        async Task<PagedResult<SaleListItemDto>> List(string query) =>
            await (await seller.Client.GetAsync($"/api/sales?{query}")).ReadAsync<PagedResult<SaleListItemDto>>();

        var all = await List("");
        Assert.Equal(3, all.TotalCount);
        Assert.Equal(cash2.Id, all.Items[0].Id);   // newest first
        Assert.Equal(1, all.Items[0].ItemCount);   // one line on the receipt (a quantity of 2)

        Assert.Equal(2, (await List("payment=Cash")).TotalCount);
        Assert.Equal(1, (await List("payment=Card")).TotalCount);
        Assert.Equal(1, (await List("status=voided")).TotalCount);
        Assert.Equal(2, (await List("status=completed")).TotalCount);

        var page2 = await List("pageSize=2&page=2");
        Assert.Equal(2, page2.TotalPages);
        Assert.Single(page2.Items);
    }

    [Fact]
    public async Task TheDateRangeFilters_UsingTheMomentsTheBrowserSends()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Item", 10m, 50);
        await SellAsync(seller.Client, Line(product, 1));

        string Iso(DateTime utc) => Uri.EscapeDataString(utc.ToString("o"));
        async Task<int> Count(string query) =>
            (await (await seller.Client.GetAsync($"/api/sales?{query}")).ReadAsync<PagedResult<SaleListItemDto>>()).TotalCount;

        Assert.Equal(1, await Count($"from={Iso(DateTime.UtcNow.AddHours(-1))}&to={Iso(DateTime.UtcNow.AddHours(1))}"));
        Assert.Equal(0, await Count($"from={Iso(DateTime.UtcNow.AddHours(1))}"));  // starts in the future
        Assert.Equal(0, await Count($"to={Iso(DateTime.UtcNow.AddHours(-1))}"));   // ended an hour ago
    }

    [Fact]
    public async Task TheSummary_CountsOnlyCompletedSales_AndGroupsByPayment()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await seller.Client.CreateProductAsync("Item", 10m, 100);

        await SellAsync(seller.Client, Line(product, 1));                                                       // cash 10
        await SellAsync(seller.Client, Line(product, 2));                                                       // cash 20
        await PostSaleAsync(seller.Client, new[] { Line(product, 3) }, payment: "Card", tendered: null);       // card 30
        var mistake = await SellAsync(seller.Client, Line(product, 5));                                         // cash 50, voided below
        await seller.Client.PostAsJsonAsync($"/api/sales/{mistake.Id}/void", new { reason = "Entered twice" });

        var summary = await (await seller.Client.GetAsync("/api/sales/summary")).ReadAsync<SalesSummaryDto>();

        Assert.Equal(3, summary.SaleCount);
        Assert.Equal(60m, summary.Revenue);        // the voided 50 is not counted
        Assert.Equal(20m, summary.AverageSale);
        Assert.Equal(6, summary.ItemsSold);        // 1 + 2 + 3
        Assert.Equal(1, summary.VoidedCount);

        var cash = Assert.Single(summary.ByPayment, p => p.Method == "Cash");
        Assert.Equal(2, cash.Count);
        Assert.Equal(30m, cash.Total);
        Assert.Equal(30m, Assert.Single(summary.ByPayment, p => p.Method == "Card").Total);
    }

    [Fact]
    public async Task AnEmptySummary_IsAllZeros()
    {
        var seller = await _factory.RegisterUserAsync();

        var summary = await (await seller.Client.GetAsync("/api/sales/summary")).ReadAsync<SalesSummaryDto>();

        Assert.Equal(0, summary.SaleCount);
        Assert.Equal(0m, summary.Revenue);
        Assert.Equal(0m, summary.AverageSale);
        Assert.Empty(summary.ByPayment);
    }

    [Fact]
    public async Task BadHistoryQueriesAreRefused()
    {
        var seller = await _factory.RegisterUserAsync();

        foreach (var query in new[] { "payment=Bitcoin", "status=maybe", "pageSize=500", "page=0", "from=not-a-date" })
            Assert.Equal(HttpStatusCode.BadRequest, (await seller.Client.GetAsync($"/api/sales?{query}")).StatusCode);
    }
}
