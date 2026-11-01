using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProductApi.Data;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Controllers;

// The point of sale. Everything here is limited to the logged-in seller's own products and sales.
[Authorize]
[ApiController]
[Route("api/sales")]
public class SalesController : ControllerBase
{
    private const int MaxAttempts = 3;

    private readonly AppDbContext _db;

    public SalesController(AppDbContext db)
    {
        _db = db;
    }

    private DbSet<Sale> Sales => _db.Set<Sale>();

    private IQueryable<Sale> OwnSales()
    {
        var ownerId = User.GetUserId();
        return Sales.Where(s => s.OwnerId == ownerId);
    }

    private static IQueryable<Sale> InRange(IQueryable<Sale> query, DateTimeOffset? from, DateTimeOffset? to)
    {
        if (from.HasValue)
        {
            var start = from.Value.UtcDateTime;
            query = query.Where(s => s.CreatedAt >= start);
        }
        if (to.HasValue)
        {
            var end = to.Value.UtcDateTime;
            query = query.Where(s => s.CreatedAt < end);
        }
        return query;
    }

    // POST /api/sales
    [HttpPost]
    public async Task<ActionResult<SaleDto>> Create(CreateSaleRequest request)
    {
        var ownerId = User.GetUserId();

        if (request.Items.GroupBy(i => i.ProductId).Any(g => g.Count() > 1))
            return BadRequest(new { message = "Each product can appear only once. Change its quantity instead." });

        // 1. The REAL prices and names come from the database, never from the request.
        var ids = request.Items.Select(i => i.ProductId).ToList();
        var products = await _db.Products
            .AsNoTracking()
            .Where(p => p.OwnerId == ownerId && ids.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.Price })
            .ToListAsync();

        // A product that is not found, or belongs to somebody else, gets the same answer.
        if (products.Count != ids.Count)
            return BadRequest(new { message = "One of the products does not exist any more. Reload the page and try again." });

        var lines = request.Items.Select(item =>
        {
            var product = products.First(p => p.Id == item.ProductId);
            return new { product.Id, product.Name, UnitPrice = product.Price, item.Quantity, LineTotal = product.Price * item.Quantity };
        }).ToList();

        // 2. The maths, done once, here, in exact decimals
        var subtotal = lines.Sum(l => l.LineTotal);
        var discount = Math.Round(request.Discount, 2, MidpointRounding.AwayFromZero);
        var taxRate = Math.Round(request.TaxRatePercent, 2, MidpointRounding.AwayFromZero);

        if (discount > subtotal)
            return BadRequest(new { message = "The discount cannot be larger than the subtotal." });

        var taxable = subtotal - discount;
        var tax = Math.Round(taxable * taxRate / 100m, 2, MidpointRounding.AwayFromZero);
        var total = taxable + tax;

        decimal tendered;
        decimal change;
        if (request.PaymentMethod == "Cash")
        {
            if (request.AmountTendered is null || request.AmountTendered.Value < total)
                return BadRequest(new { message = "The amount received is less than the total." });

            tendered = request.AmountTendered.Value;
            change = tendered - total;
        }
        else
        {
            tendered = total; // card and mobile payments are for the exact total
            change = 0;
        }

        var seller = await _db.Users.AsNoTracking()
            .Where(u => u.Id == ownerId)
            .Select(u => new { u.Name, u.ShopName })
            .FirstAsync();

        // 3. Take the stock and save the sale in ONE transaction: both happen, or neither does.
        for (var attempt = 1; ; attempt++)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                foreach (var line in lines)
                {
                    var quantity = line.Quantity;
                    var productId = line.Id;

                    // "Take 2 from the stock, but ONLY if at least 2 are left", as one atomic database step.
                    // Two cashiers selling the last item at the same moment: one gets 1 row changed, the other 0.
                    var changed = await _db.Products
                        .Where(p => p.Id == productId && p.OwnerId == ownerId && p.Quantity >= quantity)
                        .ExecuteUpdateAsync(s => s.SetProperty(p => p.Quantity, p => p.Quantity - quantity));

                    if (changed == 0)
                    {
                        // Leaving here without Commit undoes the stock already taken for earlier lines
                        return Conflict(new { message = $"Not enough stock for \"{line.Name}\"." });
                    }
                }

                var nextNumber = (await Sales.Where(s => s.OwnerId == ownerId).MaxAsync(s => (int?)s.SaleNumber) ?? 0) + 1;

                var sale = new Sale
                {
                    OwnerId = ownerId,
                    SaleNumber = nextNumber,
                    CashierName = seller.Name,
                    ShopName = string.IsNullOrWhiteSpace(seller.ShopName) ? seller.Name : seller.ShopName,
                    Subtotal = subtotal,
                    DiscountAmount = discount,
                    TaxRatePercent = taxRate,
                    TaxAmount = tax,
                    Total = total,
                    PaymentMethod = request.PaymentMethod,
                    AmountTendered = tendered,
                    ChangeGiven = change,
                    CreatedAt = DateTime.UtcNow,
                    Items = lines.Select(l => new SaleItem
                    {
                        ProductId = l.Id,
                        ProductName = l.Name,
                        UnitPrice = l.UnitPrice,
                        Quantity = l.Quantity,
                        LineTotal = l.LineTotal,
                    }).ToList(),
                };

                Sales.Add(sale);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return StatusCode(StatusCodes.Status201Created, ToDto(sale));
            }
            catch (DbUpdateException) when (attempt < MaxAttempts)
            {
                // Two sales got the same receipt number at the same moment (the unique index stopped the second).
                // Undo everything and start again, which picks the next free number.
                await transaction.RollbackAsync();
                _db.ChangeTracker.Clear();
            }
        }
    }

    // GET /api/sales
    [HttpGet]
    public async Task<ActionResult<PagedResult<SaleListItemDto>>> GetAll([FromQuery] SaleListQuery q)
    {
        IQueryable<Sale> query = InRange(OwnSales().AsNoTracking(), q.From, q.To);

        if (q.Payment != "all") query = query.Where(s => s.PaymentMethod == q.Payment);
        if (q.Status == "completed") query = query.Where(s => !s.IsVoided);
        if (q.Status == "voided") query = query.Where(s => s.IsVoided);

        query = query.OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id);

        var totalCount = await query.CountAsync();
        var rows = await query
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(s => new { s.Id, s.SaleNumber, s.CreatedAt, s.Total, s.PaymentMethod, ItemCount = s.Items.Count, s.IsVoided })
            .ToListAsync();

        return Ok(new PagedResult<SaleListItemDto>
        {
            Items = rows.Select(r => new SaleListItemDto
            {
                Id = r.Id,
                SaleNumber = r.SaleNumber,
                ReceiptNumber = Receipt(r.SaleNumber),
                CreatedAt = r.CreatedAt,
                Total = r.Total,
                PaymentMethod = r.PaymentMethod,
                ItemCount = r.ItemCount,
                IsVoided = r.IsVoided,
            }).ToList(),
            Page = q.Page,
            PageSize = q.PageSize,
            TotalCount = totalCount,
        });
    }

    // GET /api/sales/summary?from=...&to=...
    [HttpGet("summary")]
    public async Task<ActionResult<SalesSummaryDto>> GetSummary([FromQuery] SaleSummaryQuery q)
    {
        var inRange = InRange(OwnSales().AsNoTracking(), q.From, q.To);
        var completed = inRange.Where(s => !s.IsVoided);

        var saleCount = await completed.CountAsync();
        var revenue = await completed.SumAsync(s => (decimal?)s.Total) ?? 0m;
        var itemsSold = await completed.SelectMany(s => s.Items).SumAsync(i => (int?)i.Quantity) ?? 0;
        var voidedCount = await inRange.CountAsync(s => s.IsVoided);

        var byPayment = await completed
            .GroupBy(s => s.PaymentMethod)
            .Select(g => new PaymentTotalDto { Method = g.Key, Count = g.Count(), Total = g.Sum(s => s.Total) })
            .ToListAsync();

        return Ok(new SalesSummaryDto
        {
            SaleCount = saleCount,
            Revenue = revenue,
            AverageSale = saleCount == 0 ? 0m : Math.Round(revenue / saleCount, 2, MidpointRounding.AwayFromZero),
            ItemsSold = itemsSold,
            VoidedCount = voidedCount,
            ByPayment = byPayment.OrderBy(p => p.Method).ToList(),
        });
    }

    // GET /api/sales/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<SaleDto>> GetById(int id)
    {
        var sale = await OwnSales().AsNoTracking().Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id);

        // Someone else's sale gives 404 (not 403), so nobody can tell it exists.
        if (sale is null)
            return NotFound(new { message = $"Sale with id {id} was not found." });

        return Ok(ToDto(sale));
    }

    // POST /api/sales/5/void   body: { "reason": "Customer changed their mind" }
    // Cancels the whole sale and puts the items back into stock. The sale stays in the history, marked as void.
    [HttpPost("{id:int}/void")]
    public async Task<ActionResult<SaleDto>> Void(int id, VoidSaleRequest request)
    {
        var ownerId = User.GetUserId();

        var sale = await OwnSales().AsNoTracking().Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id);
        if (sale is null)
            return NotFound(new { message = $"Sale with id {id} was not found." });

        var reason = request.Reason.Trim();
        var now = DateTime.UtcNow;

        await using (var transaction = await _db.Database.BeginTransactionAsync())
        {
            // Mark it void in ONE step that only works while it is not void yet,
            // so voiding twice (even at the same moment) can never put the stock back twice.
            var claimed = await Sales
                .Where(s => s.Id == id && s.OwnerId == ownerId && !s.IsVoided)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.IsVoided, true)
                    .SetProperty(x => x.VoidedAt, (DateTime?)now)
                    .SetProperty(x => x.VoidReason, reason));

            if (claimed == 0)
                return Conflict(new { message = "This sale was already voided." });

            foreach (var item in sale.Items.Where(i => i.ProductId.HasValue))
            {
                var productId = item.ProductId!.Value;
                var quantity = item.Quantity;

                // (A product that was deleted since is simply skipped: there is no stock left to put back into.)
                await _db.Products
                    .Where(p => p.Id == productId && p.OwnerId == ownerId)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Quantity, p => p.Quantity + quantity));
            }

            await transaction.CommitAsync();
        }

        _db.ChangeTracker.Clear();
        var voided = await OwnSales().AsNoTracking().Include(s => s.Items).FirstAsync(s => s.Id == id);
        return Ok(ToDto(voided));
    }

    private static string Receipt(int saleNumber) => $"R-{saleNumber:D6}";

    private static SaleDto ToDto(Sale sale) => new()
    {
        Id = sale.Id,
        SaleNumber = sale.SaleNumber,
        ReceiptNumber = Receipt(sale.SaleNumber),
        CreatedAt = sale.CreatedAt,
        CashierName = sale.CashierName,
        ShopName = sale.ShopName,
        Items = sale.Items.OrderBy(i => i.Id).Select(i => new SaleItemDto
        {
            Id = i.Id,
            ProductId = i.ProductId,
            ProductName = i.ProductName,
            UnitPrice = i.UnitPrice,
            Quantity = i.Quantity,
            LineTotal = i.LineTotal,
        }).ToList(),
        Subtotal = sale.Subtotal,
        DiscountAmount = sale.DiscountAmount,
        TaxRatePercent = sale.TaxRatePercent,
        TaxAmount = sale.TaxAmount,
        Total = sale.Total,
        PaymentMethod = sale.PaymentMethod,
        AmountTendered = sale.AmountTendered,
        ChangeGiven = sale.ChangeGiven,
        IsVoided = sale.IsVoided,
        VoidedAt = sale.VoidedAt,
        VoidReason = sale.VoidReason,
    };
}
