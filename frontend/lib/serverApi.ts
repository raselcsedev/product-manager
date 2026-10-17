import { cache } from "react";
import { headers } from "next/headers";
import { PagedResult } from "@/types/product";
import { PublicCategory, PublicProduct, PublicShop } from "@/types/shop";

// Fetching data for the public pages ON THE SERVER, before the HTML is sent to the visitor.
// (The browser version of these calls lives in lib/api.ts.)

// The server may reach the API at a different address than a browser does (for example inside Docker).
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

// Returns the data, or null when the API says 404 (so the page can show "not found").
// Any other problem (API down, 500, rate limit) throws, so visitors see the error page, not a false 404.
async function getJson<T>(path: string): Promise<T | null> {
  const requestHeaders: Record<string, string> = { Accept: "application/json" };

  // Pass the visitor's real address on, so the API's per-visitor rate limit still works
  // (otherwise every visitor would look like this one server).
  try {
    const forwarded = headers().get("x-forwarded-for");
    if (forwarded) requestHeaders["X-Forwarded-For"] = forwarded;
  } catch {
    // not inside a request (for example while building): nothing to forward
  }

  // no-store = always ask the API. An unpublished product must stop being visible immediately,
  // not after some cache expires.
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", headers: requestHeaders });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The shop is temporarily unavailable (API answered ${res.status}).`);
  return (await res.json()) as T;
}

// React's cache() means: if the same call is made twice while building ONE page
// (for example by generateMetadata and by the page itself), the API is only asked once.

export const getPublicProductServer = cache((id: number) => getJson<PublicProduct>(`/api/public/products/${id}`));

export const getRelatedServer = cache(async (id: number) => {
  // Related products are a bonus. If they fail to load, the product page still works.
  try {
    return (await getJson<PublicProduct[]>(`/api/public/products/${id}/related?limit=4`)) ?? [];
  } catch {
    return [];
  }
});

export const getProductsServer = cache((query: string) =>
  getJson<PagedResult<PublicProduct>>(`/api/public/products?${query}`)
);

export const getCategoriesServer = cache(async (shop?: string) =>
  (await getJson<PublicCategory[]>(`/api/public/categories${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`)) ?? []
);

export const getShopServer = cache((slug: string) =>
  getJson<PublicShop>(`/api/public/shops/${encodeURIComponent(slug)}`)
);

export const getShopsServer = cache(async () => (await getJson<PublicShop[]>("/api/public/shops")) ?? []);

export const getSitemapServer = cache(() =>
  getJson<{ productIds: number[]; shopSlugs: string[] }>("/api/public/sitemap")
);
