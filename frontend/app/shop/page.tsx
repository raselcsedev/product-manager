import type { Metadata } from "next";
import Link from "next/link";
import ShopBrowser from "@/components/shop/ShopBrowser";
import { getCategoriesServer, getProductsServer } from "@/lib/serverApi";
import { SHOP_PAGE_SIZE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse products published by independent sellers.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const [initialResult, initialCategories] = await Promise.all([
    getProductsServer(`pageSize=${SHOP_PAGE_SIZE}`),
    getCategoriesServer(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Public Marketplace</h1>
          <p className="mt-1 text-sm text-slate-500">Discover and browse quality products published by independent sellers.</p>
        </div>
        <Link
          href="/shops"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-colors"
        >
          Browse by storefront →
        </Link>
      </div>

      <ShopBrowser initialResult={initialResult} initialCategories={initialCategories} />
    </div>
  );
}
