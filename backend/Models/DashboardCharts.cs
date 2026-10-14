namespace ProductApi.Models;

public class StockStatusCounts
{
    public int InStock { get; set; }
    public int LowStock { get; set; }
    public int OutOfStock { get; set; }
    public int LowStockLimit { get; set; }
}

public class CategoryStat
{
    public string Name { get; set; } = string.Empty;
    public int ProductCount { get; set; }
    public long Units { get; set; }
    public decimal Value { get; set; }
}

public class DashboardCharts
{
    public StockStatusCounts StockStatus { get; set; } = new();
    public List<CategoryStat> Categories { get; set; } = new();
}
