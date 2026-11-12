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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const shop = await getShopServer(params.slug);
  if (!shop) return { title: "Shop not found", robots: { index: false } };

  const description = truncate(
    shop.description ?? `${shop.name}: ${shop.productCount} product${shop.productCount === 1 ? "" : "s"}.`,
    160
  );

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
    <div className="space-y-6">
      <Link
        href="/shops"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to storefront directory
      </Link>

      <header className="flex items-center gap-5 rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-lg shadow-emerald-600/30">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{shop.name}</h1>
          {shop.description && (
            <p className="mt-1 whitespace-pre-line text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              {shop.description}
            </p>
          )}
          <p className="mt-2 text-xs font-medium text-slate-400">
            {shop.productCount} published product{shop.productCount === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <ShopBrowser
        key={shop.slug}
        shop={shop.slug}
        initialResult={initialResult}
        initialCategories={initialCategories}
      />
    </div>
  );
}
