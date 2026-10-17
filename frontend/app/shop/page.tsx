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

// A server component: the first page of products is fetched here, so it is already in the HTML
// that search engines and link previews read.
export default async function ShopPage() {
  const [initialResult, initialCategories] = await Promise.all([
    getProductsServer(`pageSize=${SHOP_PAGE_SIZE}`),
    getCategoriesServer(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Shop</h1>
          <p className="text-sm text-slate-500">Browse products published by our sellers. No account needed.</p>
        </div>
        <Link href="/shops" className="text-sm text-blue-600 hover:underline">
          Browse by shop
        </Link>
      </div>

      <ShopBrowser initialResult={initialResult} initialCategories={initialCategories} />
    </div>
  );
}
