using System.Globalization;
using System.Text;
using ProductApi.Models;

namespace ProductApi.Services;

public static class CsvFormatter
{
    private static readonly char[] SpecialChars = { ',', '"', '\r', '\n' };

    // Escapes ONE text cell so it is safe in a CSV file and safe to open in Excel / Google Sheets.
    public static string EscapeText(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";

        var text = value;
        var guarded = false;

        // CSV / formula injection: a cell that starts with = + - @ (or a tab / carriage return)
        // can be run as a formula by Excel (for example =HYPERLINK(...) or =cmd|...).
        // A leading single quote makes spreadsheets treat the cell as plain text.
        if (text[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
        {
            text = "'" + text;
            guarded = true;
        }

        // RFC 4180: wrap in quotes if the value has a comma, quote or line break,
        // and write every quote inside it twice.
        var needsQuotes = guarded || text.IndexOfAny(SpecialChars) >= 0;
        return needsQuotes ? "\"" + text.Replace("\"", "\"\"") + "\"" : text;
    }

    public static string BuildProductsCsv(IEnumerable<Product> products)
    {
        var sb = new StringBuilder();
        sb.Append("Id,Name,Category,Description,Price,Quantity,Status\r\n");

        foreach (var p in products)
        {
            sb.Append(p.Id.ToString(CultureInfo.InvariantCulture)).Append(',')
              .Append(EscapeText(p.Name)).Append(',')
              .Append(EscapeText(p.Category?.Name)).Append(',')
              .Append(EscapeText(p.Description)).Append(',')
              // InvariantCulture: always "19.99", never "19,99", whatever the server's language is
              .Append(p.Price.ToString("0.00", CultureInfo.InvariantCulture)).Append(',')
              .Append(p.Quantity.ToString(CultureInfo.InvariantCulture)).Append(',')
              .Append(StatusOf(p.Quantity))
              .Append("\r\n");
        }

        return sb.ToString();
    }

    // UTF-8 with a "byte order mark" so Excel shows non-English characters correctly.
    public static byte[] ToUtf8WithBom(string text)
    {
        var encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);
        return encoding.GetPreamble().Concat(encoding.GetBytes(text)).ToArray();
    }

    private static string StatusOf(int quantity) =>
        quantity == 0 ? "Out of stock"
        : quantity < StockLevels.LowStockLimit ? "Low stock"
        : "In stock";
}
