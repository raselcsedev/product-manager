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
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Shops</h1>
          <p className="text-sm text-slate-500">Sellers who have a shop page with at least one product.</p>
        </div>
        <Link href="/shop" className="text-sm text-blue-600 hover:underline">
          Browse all products
        </Link>
      </div>

      {shops.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          No shops yet. Sellers can open a shop page from <span className="font-medium">My shop</span> after logging in.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s) => (
            <ShopCard key={s.slug} shop={s} />
          ))}
        </div>
      )}
    </div>
  );
}
