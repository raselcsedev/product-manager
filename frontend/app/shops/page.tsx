import type { Metadata } from "next";
import Link from "next/link";
import ShopCard from "@/components/shop/ShopCard";
import { getShopsServer } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Shops",
  description: "Sellers who have a shop page, and the products they offer.",
  alternates: { canonical: "/shops" },
};

export default async function ShopDirectoryPage() {
  const shops = await getShopsServer();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Storefront Directory</h1>
          <p className="mt-1 text-sm text-slate-500">Explore independent storefronts and verified merchant collections.</p>
        </div>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-colors"
        >
          ← Browse all products
        </Link>
      </div>

      {shops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500">
          No storefronts have been opened yet. Sellers can launch a shop page from <span className="font-semibold text-slate-800 dark:text-slate-200">&ldquo;My shop&rdquo;</span>.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {shops.map((s) => (
            <ShopCard key={s.slug} shop={s} />
          ))}
        </div>
      )}
    </div>
  );
}
