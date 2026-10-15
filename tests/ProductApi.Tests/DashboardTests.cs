using System.Net;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class DashboardTests
{
    private readonly ApiFactory _factory;

    public DashboardTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Charts_RequireALogin()
    {
        var response = await _factory.CreateClient().GetAsync("/api/dashboard/charts");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Charts_CountStockStatusesAndGroupByCategory()
    {
        var user = await _factory.RegisterUserAsync();
        var electronics = await user.Client.CreateCategoryAsync("Electronics");
        await user.Client.CreateProductAsync("P1", 10m, 0, electronics.Id);   // out of stock
        await user.Client.CreateProductAsync("P2", 10m, 5, electronics.Id);   // low stock
        await user.Client.CreateProductAsync("P3", 2m, 50);                   // in stock, no category

        var charts = await (await user.Client.GetAsync("/api/dashboard/charts")).ReadAsync<DashboardCharts>();

        Assert.Equal(1, charts.StockStatus.OutOfStock);
        Assert.Equal(1, charts.StockStatus.LowStock);
        Assert.Equal(1, charts.StockStatus.InStock);

        var withCategory = Assert.Single(charts.Categories, c => c.Name == "Electronics");
        Assert.Equal(2, withCategory.ProductCount);
        Assert.Equal(5, withCategory.Units);
        Assert.Equal(50m, withCategory.Value);   // 10*0 + 10*5

        var without = Assert.Single(charts.Categories, c => c.Name == "Uncategorized");
        Assert.Equal(100m, without.Value);        // 2*50

        // the biggest value comes first
        Assert.Equal("Uncategorized", charts.Categories[0].Name);
    }

    [Fact]
    public async Task Charts_AreEmptyForAUserWithNoProducts()
    {
        var user = await _factory.RegisterUserAsync();

        var charts = await (await user.Client.GetAsync("/api/dashboard/charts")).ReadAsync<DashboardCharts>();

        Assert.Equal(0, charts.StockStatus.InStock + charts.StockStatus.LowStock + charts.StockStatus.OutOfStock);
        Assert.Empty(charts.Categories);
    }
}
