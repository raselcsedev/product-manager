using System.ComponentModel.DataAnnotations;

namespace ProductApi.Models;

// What a seller sends to set up or change their shop page
public class MyShopRequest
{
    [Required(ErrorMessage = "Shop name is required.")]
    [StringLength(60, MinimumLength = 3, ErrorMessage = "Shop name must be between 3 and 60 characters.")]
    public string ShopName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Shop address is required.")]
    [StringLength(40, MinimumLength = 3, ErrorMessage = "Shop address must be between 3 and 40 characters.")]
    [RegularExpression("^[a-z0-9]+(-[a-z0-9]+)*$",
        ErrorMessage = "Shop address can only contain lowercase letters, numbers and single hyphens (for example: my-shop).")]
    public string ShopSlug { get; set; } = string.Empty;

    [StringLength(300, ErrorMessage = "Description must be 300 characters or fewer.")]
    public string? ShopDescription { get; set; }
}

// What the seller sees about their own shop
public class MyShopDto
{
    public string? ShopName { get; set; }
    public string? ShopSlug { get; set; }
    public string? ShopDescription { get; set; }
    public int PublishedProductCount { get; set; }
}
