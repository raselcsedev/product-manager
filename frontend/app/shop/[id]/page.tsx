"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Alert from "@/components/Alert";
import ProductThumb from "@/components/ProductThumb";
import AvailabilityBadge from "@/components/shop/AvailabilityBadge";
import PublicProductCard from "@/components/shop/PublicProductCard";
import Spinner from "@/components/Spinner";
import { getPublicProduct, getRelatedProducts } from "@/lib/api";
import { PublicProduct } from "@/types/shop";

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ShopProductPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [related, setRelated] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) {
      setError("This product link is not valid.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setProduct(null);
    setRelated([]);

    async function load() {
      try {
        const data = await getPublicProduct(id);
        if (cancelled) return;
        setProduct(data);

        // Related products are a bonus: if they fail to load, the page still works.
        getRelatedProducts(id, 4)
          .then((list) => {
            if (!cancelled) setRelated(list);
          })
          .catch(() => {});
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load product.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/shop" className="inline-block text-sm text-slate-600 hover:underline">
        &larr; Back to shop
      </Link>

      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading product..." />}

      {product && (
        <>
          <div className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 md:grid-cols-2">
            <ProductThumb fileName={product.imageFileName} name={product.name} size="fill" />

            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-semibold">{product.name}</h1>
                <p className="mt-2 text-2xl font-semibold">{money(product.price)}</p>
              </div>

              {/* Only shown when the seller has chosen to have a shop page */}
              {product.shopSlug && product.shopName && (
                <p className="text-sm text-slate-600">
                  Sold by{" "}
                  <Link href={`/shops/${product.shopSlug}`} className="font-medium text-blue-600 hover:underline">
                    {product.shopName}
                  </Link>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {product.category && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{product.category}</span>
                )}
                <AvailabilityBadge availability={product.availability} />
              </div>

              <div>
                <h2 className="text-sm font-medium">Description</h2>
                {product.description ? (
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{product.description}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">No description.</p>
                )}
              </div>

              {product.shopSlug && product.shopName && (
                <Link
                  href={`/shops/${product.shopSlug}`}
                  className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
                >
                  More from {product.shopName}
                </Link>
              )}
            </div>
          </div>

          {related.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">You may also like</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((p) => (
                  <PublicProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
