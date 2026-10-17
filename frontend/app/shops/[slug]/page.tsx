import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ShopBrowser from "@/components/shop/ShopBrowser";
import { getCategoriesServer, getProductsServer, getShopServer } from "@/lib/serverApi";
import { SHOP_PAGE_SIZE, SITE_NAME, absoluteImageUrl, truncate } from "@/lib/site";

interface PageProps {
  params: { slug: string };
}

const productsQuery = (slug: string) => `shop=${encodeURIComponent(slug)}&pageSize=${SHOP_PAGE_SIZE}`;

// The <title>, description and share preview of this seller's shop.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const shop = await getShopServer(params.slug);
  if (!shop) return { title: "Shop not found", robots: { index: false } };

  const description = truncate(
    shop.description ?? `${shop.name}: ${shop.productCount} product${shop.productCount === 1 ? "" : "s"}.`,
    160
  );

  // Use the picture of the shop's newest product as the share preview
  const firstPage = await getProductsServer(productsQuery(shop.slug));
  const image = absoluteImageUrl(firstPage?.items.find((p) => p.imageFileName)?.imageFileName ?? null);

  return {
    title: shop.name,
    description,
    alternates: { canonical: `/shops/${shop.slug}` },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: shop.name,
      description,
      url: `/shops/${shop.slug}`,
      images: image ? [{ url: image, alt: shop.name }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: shop.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function SellerShopPage({ params }: PageProps) {
  const shop = await getShopServer(params.slug);
  if (!shop) notFound();

  const [initialResult, initialCategories] = await Promise.all([
    getProductsServer(productsQuery(shop.slug)),
    getCategoriesServer(shop.slug),
  ]);

  const initial = shop.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/shops" className="inline-block text-sm text-slate-600 hover:underline">
        &larr; All shops
      </Link>

      <header className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-semibold text-white">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{shop.name}</h1>
          {shop.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{shop.description}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {shop.productCount} product{shop.productCount === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      {/* key = slug: moving to another shop starts with fresh filters */}
      <ShopBrowser
        key={shop.slug}
        shop={shop.slug}
        initialResult={initialResult}
        initialCategories={initialCategories}
      />
    </div>
  );
}
