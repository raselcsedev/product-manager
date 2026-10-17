import type { MetadataRoute } from "next";
import { getSitemapServer } from "@/lib/serverApi";
import { SITE_URL } from "@/lib/site";

// Served at /sitemap.xml: a list of every public page, so search engines can find all of them.
// "force-dynamic" = built when asked, so new products appear without rebuilding the website.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/shop`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/shops`, changeFrequency: "daily", priority: 0.7 },
  ];

  try {
    const data = await getSitemapServer();
    if (data) {
      for (const id of data.productIds) {
        entries.push({ url: `${SITE_URL}/shop/${id}`, changeFrequency: "weekly", priority: 0.8 });
      }
      for (const slug of data.shopSlugs) {
        entries.push({ url: `${SITE_URL}/shops/${slug}`, changeFrequency: "weekly", priority: 0.6 });
      }
    }
  } catch {
    // The API is down: still serve the main pages instead of failing the whole sitemap.
  }

  return entries;
}
