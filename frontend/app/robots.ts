import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Served at /robots.txt. It tells search engines what they may visit:
// the public shop, and nothing else (the dashboard, products, admin pages ... stay out of search results).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/shop", "/shops"], // "/shop" also covers "/shop/5"
        disallow: ["/"],            // everything else is private. The longer "allow" rules win.
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
