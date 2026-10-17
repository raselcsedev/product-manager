"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Alert from "@/components/Alert";
import ShopBrowser from "@/components/shop/ShopBrowser";
import Spinner from "@/components/Spinner";
import { getPublicShop } from "@/lib/api";
import { PublicShop } from "@/types/shop";

export default function SellerShopPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [shop, setShop] = useState<PublicShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setShop(null);

    getPublicShop(slug)
      .then((data) => {
        if (!cancelled) setShop(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load shop.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const initial = shop?.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/shops" className="inline-block text-sm text-slate-600 hover:underline">
        &larr; All shops
      </Link>

      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading shop..." />}

      {shop && (
        <>
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

          {/* key = slug: switching to another shop starts with fresh filters */}
          <ShopBrowser key={shop.slug} shop={shop.slug} />
        </>
      )}
    </div>
  );
}
