using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProductApi.Models;

// One completed sale at the point of sale (POS). Everything that matters is COPIED into it
// (names, prices, shop and cashier names), so an old receipt never changes, even when you later
// rename or reprice a product, or delete it.
public class Sale
{
    public int Id { get; set; }

    // The seller who made the sale
    public int OwnerId { get; set; }

    // 1, 2, 3 ... counted separately for every seller (shown as R-000001)
    public int SaleNumber { get; set; }

    [StringLength(100)]
    public string CashierName { get; set; } = string.Empty;

    [StringLength(100)]
    public string ShopName { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal Subtotal { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountAmount { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal TaxRatePercent { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal TaxAmount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Total { get; set; }

    // "Cash", "Card" or "Mobile"
    [StringLength(20)]
    public string PaymentMethod { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal AmountTendered { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal ChangeGiven { get; set; }

    public DateTime CreatedAt { get; set; }

    public bool IsVoided { get; set; }
    public DateTime? VoidedAt { get; set; }

    [StringLength(200)]
    public string? VoidReason { get; set; }

    public List<SaleItem> Items { get; set; } = new();
}

public class SaleItem
{
    public int Id { get; set; }
    public int SaleId { get; set; }

    // Null once the product has been deleted (the name below still tells what it was)
    public int? ProductId { get; set; }

    [StringLength(100)]
    public string ProductName { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal UnitPrice { get; set; }

    public int Quantity { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal LineTotal { get; set; }
}

// ---------- What the cashier screen sends ----------
public class SaleItemRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Invalid product.")]
    public int ProductId { get; set; }

    [Range(1, 9999, ErrorMessage = "Quantity must be between 1 and 9999.")]
    public int Quantity { get; set; }
}

// NOTE: there is no price in here. The server always uses the product's real price from the database,
// so a changed request can never sell something cheaper.
public class CreateSaleRequest
{
    [Required(ErrorMessage = "A sale needs at least one product.")]
    [MinLength(1, ErrorMessage = "A sale needs at least one product.")]
    [MaxLength(100, ErrorMessage = "A sale can have at most 100 different products.")]
    public List<SaleItemRequest> Items { get; set; } = new();

    [Range(0, 999999999, ErrorMessage = "The discount cannot be negative.")]
    public decimal Discount { get; set; }

    [Range(0, 100, ErrorMessage = "The tax rate must be between 0 and 100.")]
    public decimal TaxRatePercent { get; set; }

    [Required(ErrorMessage = "Choose a payment method.")]
    [RegularExpression("^(Cash|Card|Mobile)$", ErrorMessage = "Payment method must be Cash, Card or Mobile.")]
    public string PaymentMethod { get; set; } = string.Empty;

    // Only used for Cash: how much money the customer handed over
    [Range(0, 999999999, ErrorMessage = "The amount received cannot be negative.")]
    public decimal? AmountTendered { get; set; }
}

public class VoidSaleRequest
{
    [Required(ErrorMessage = "Please give a reason.")]
    [StringLength(200, MinimumLength = 3, ErrorMessage = "The reason must be between 3 and 200 characters.")]
    public string Reason { get; set; } = string.Empty;
}

// GET /api/sales?from=...&to=...&payment=Cash&status=voided&page=1&pageSize=20
// (from / to are exact moments, sent by the browser, so "today" means the seller's own today)
public class SaleListQuery
{
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }

    [RegularExpression("^(all|Cash|Card|Mobile)$", ErrorMessage = "Payment must be all, Cash, Card or Mobile.")]
    public string Payment { get; set; } = "all";

    [RegularExpression("^(all|completed|voided)$", ErrorMessage = "Status must be all, completed or voided.")]
    public string Status { get; set; } = "all";

    [Range(1, int.MaxValue, ErrorMessage = "Page must be 1 or more.")]
    public int Page { get; set; } = 1;

    [Range(1, 50, ErrorMessage = "PageSize must be between 1 and 50.")]
    public int PageSize { get; set; } = 20;
}

public class SaleSummaryQuery
{
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }
}

// ---------- What the API answers ----------
public class SaleItemDto
{
    public int Id { get; set; }
    public int? ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
}

public class SaleDto
{
    public int Id { get; set; }
    public int SaleNumber { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string CashierName { get; set; } = string.Empty;
    public string ShopName { get; set; } = string.Empty;
    public List<SaleItemDto> Items { get; set; } = new();
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxRatePercent { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public decimal AmountTendered { get; set; }
    public decimal ChangeGiven { get; set; }
    public bool IsVoided { get; set; }
    public DateTime? VoidedAt { get; set; }
    public string? VoidReason { get; set; }
}

public class SaleListItemDto
{
    public int Id { get; set; }
    public int SaleNumber { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public decimal Total { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public int ItemCount { get; set; }      // number of lines on the receipt
    public bool IsVoided { get; set; }
}

public class PaymentTotalDto
{
    public string Method { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Total { get; set; }
}

public class SalesSummaryDto
{
    public int SaleCount { get; set; }          // voided sales are not counted
    public decimal Revenue { get; set; }        // voided sales are not counted
    public decimal AverageSale { get; set; }
    public int ItemsSold { get; set; }
    public int VoidedCount { get; set; }
    public List<PaymentTotalDto> ByPayment { get; set; } = new();
}
