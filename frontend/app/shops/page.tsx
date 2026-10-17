"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import ShopCard from "@/components/shop/ShopCard";
import Spinner from "@/components/Spinner";
import { getPublicShops } from "@/lib/api";
import { PublicShop } from "@/types/shop";

export default function ShopDirectoryPage() {
  const [shops, setShops] = useState<PublicShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicShops()
      .then((list) => {
        if (!cancelled) setShops(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load shops.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading shops..." />}

      {!loading && !error && shops.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          No shops yet. Sellers can open a shop page from <span className="font-medium">My shop</span> after logging in.
        </div>
      )}

      {shops.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s) => (
            <ShopCard key={s.slug} shop={s} />
          ))}
        </div>
      )}
    </div>
  );
}
