namespace ProductApi.Models;

// Just enough for the website to build its sitemap.xml: ids and addresses, nothing else.
public class PublicSitemapDto
{
    public List<int> ProductIds { get; set; } = new();
    public List<string> ShopSlugs { get; set; } = new();
}
