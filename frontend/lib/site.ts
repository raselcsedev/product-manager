// Settings and small helpers shared by the public pages (these run on the server).

export const SITE_NAME = "Product Manager";

// The public address of the website, without a trailing slash
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

// Optional. Search engines need a currency to understand a price, but this app has no currency setting.
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || undefined;

// How many products one page of the shop shows (must stay in sync between server and browser)
export const SHOP_PAGE_SIZE = 12;

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

// Share previews need a FULL image address, not just a file name.
export function absoluteImageUrl(fileName: string | null): string | undefined {
  return fileName ? `${PUBLIC_API_URL}/uploads/products/${fileName}` : undefined;
}

// Shortens text for a page description. Search engines show about 160 characters.
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
