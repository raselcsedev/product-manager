using System.Globalization;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Tests;

public class CsvFormatterTests
{
    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("Wireless Mouse", "Wireless Mouse")]
    [InlineData("Mouse, wireless", "\"Mouse, wireless\"")]
    [InlineData("5\" cable", "\"5\"\" cable\"")]
    [InlineData("line1\nline2", "\"line1\nline2\"")]
    [InlineData("a=b", "a=b")] // an equals sign in the middle is harmless
    public void EscapeText_QuotesOnlyWhenNeeded(string? input, string expected)
    {
        Assert.Equal(expected, CsvFormatter.EscapeText(input));
    }

    [Theory]
    [InlineData("=1+1", "\"'=1+1\"")]
    [InlineData("+cmd", "\"'+cmd\"")]
    [InlineData("-5", "\"'-5\"")]
    [InlineData("@SUM(A1)", "\"'@SUM(A1)\"")]
    [InlineData("\tTabbed", "\"'\tTabbed\"")]
    [InlineData("=HYPERLINK(\"http://evil.test\")", "\"'=HYPERLINK(\"\"http://evil.test\"\")\"")]
    public void EscapeText_NeutralizesFormulaInjection(string input, string expected)
    {
        Assert.Equal(expected, CsvFormatter.EscapeText(input));
    }

    [Fact]
    public void BuildProductsCsv_WritesHeaderAndOneRowPerProduct()
    {
        var products = new[]
        {
            new Product { Id = 1, Name = "Mouse", Description = "Black, wireless", Price = 19.99m, Quantity = 25,
                          Category = new Category { Id = 7, Name = "Electronics" } },
            new Product { Id = 2, Name = "Cable", Price = 5m, Quantity = 0 },
            new Product { Id = 3, Name = "Lamp", Price = 12.5m, Quantity = 4 },
        };

        var lines = CsvFormatter.BuildProductsCsv(products).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("Id,Name,Category,Description,Price,Quantity,Status", lines[0]);
        Assert.Equal("1,Mouse,Electronics,\"Black, wireless\",19.99,25,In stock", lines[1]);
        Assert.Equal("2,Cable,,,5.00,0,Out of stock", lines[2]);
        Assert.Equal("3,Lamp,,,12.50,4,Low stock", lines[3]);
        Assert.Equal(4, lines.Length);
    }

    [Fact]
    public void BuildProductsCsv_AlwaysUsesADotAsTheDecimalSeparator()
    {
        var original = CultureInfo.CurrentCulture;
        try
        {
            // German writes 1234,50. A CSV must not change with the server's language.
            CultureInfo.CurrentCulture = new CultureInfo("de-DE");

            var csv = CsvFormatter.BuildProductsCsv(new[] { new Product { Id = 1, Name = "A", Price = 1234.5m, Quantity = 3 } });

            Assert.Contains(",1234.50,3,", csv);
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }

    [Fact]
    public void ToUtf8WithBom_StartsWithTheByteOrderMark()
    {
        var bytes = CsvFormatter.ToUtf8WithBom("Café");

        Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, bytes[..3]);
        Assert.Equal("Café", System.Text.Encoding.UTF8.GetString(bytes[3..]));
    }
}
