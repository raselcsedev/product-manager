using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

// One row = one thing somebody did ("Rasel updated product Wireless Mouse").
// Names are copied into the row (a "snapshot"), so the history still reads correctly
// after the product, category or user has been renamed or deleted.
public class AuditLog
{
    public int Id { get; set; }

    // Who did it
    public int UserId { get; set; }

    [StringLength(100)]
    public string ActorName { get; set; } = string.Empty;

    // "Created", "Updated" or "Deleted"
    [StringLength(20)]
    public string Action { get; set; } = string.Empty;

    // "Product", "Category" or "User"
    [StringLength(20)]
    public string EntityType { get; set; } = string.Empty;

    public int? EntityId { get; set; }

    [StringLength(150)]
    public string EntityName { get; set; } = string.Empty;

    // What changed, for example: Price: 10.00 -> 12.50
    [StringLength(1000)]
    public string? Details { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class AuditLogDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public int? EntityId { get; set; }
    public string EntityName { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; }
}

// GET /api/activity?scope=mine&entityType=Product&action=Updated&page=1&pageSize=20
public class ActivityQuery
{
    [RegularExpression("^(mine|all)$", ErrorMessage = "Scope must be mine or all.")]
    public string Scope { get; set; } = "mine";

    [RegularExpression("^(all|Product|Category|User)$", ErrorMessage = "EntityType must be all, Product, Category or User.")]
    public string EntityType { get; set; } = "all";

    [RegularExpression("^(all|Created|Updated|Deleted)$", ErrorMessage = "Action must be all, Created, Updated or Deleted.")]
    public string Action { get; set; } = "all";

    [Range(1, int.MaxValue, ErrorMessage = "Page must be 1 or more.")]
    public int Page { get; set; } = 1;

    [Range(1, 50, ErrorMessage = "PageSize must be between 1 and 50.")]
    public int PageSize { get; set; } = 20;
}
