"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Alert from "@/components/Alert";
import ProductThumb from "@/components/ProductThumb";
import PublicPill from "@/components/PublicPill";
import Spinner from "@/components/Spinner";
import StockBadge from "@/components/StockBadge";
import { deleteProduct, getProduct } from "@/lib/api";
import { Product } from "@/types/product";

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) {
      setError("This product link is not valid.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const data = await getProduct(id);
        if (!cancelled) setProduct(data);
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

  async function handleDelete() {
    if (!product) return;
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteProduct(product.id);
      router.push(`/products?success=${encodeURIComponent(`"${product.name}" was deleted.`)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product.");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/products" className="inline-block text-sm text-slate-600 hover:underline">
        &larr; Back to products
      </Link>

      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading product..." />}

      {product && (
        <div className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 md:grid-cols-2">
          <div>
            <ProductThumb fileName={product.imageFileName} name={product.name} size="fill" />
            {!product.imageFileName && (
              <p className="mt-2 text-xs text-slate-500">
                No image yet.{" "}
                <Link href={`/products/edit/${product.id}`} className="text-blue-600 hover:underline">
                  Add one
                </Link>
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500">Product #{product.id}</p>
              <h1 className="text-2xl font-semibold">{product.name}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {product.category ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {product.category.name}
                </span>
              ) : (
                <span className="text-xs text-slate-400">No category</span>
              )}
              <StockBadge quantity={product.quantity} />
              {product.isPublished ? (
                <PublicPill />
              ) : (
                <span className="text-xs text-slate-400">Private</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Price" value={money(product.price)} />
              <Stat label="Quantity" value={product.quantity.toLocaleString()} />
              <Stat label="Stock value" value={money(product.price * product.quantity)} />
            </div>

            <div>
              <h2 className="text-sm font-medium">Description</h2>
              {product.description ? (
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{product.description}</p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">No description.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href={`/products/edit/${product.id}`}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Edit
              </Link>
              {product.isPublished && (
                <Link
                  href={`/shop/${product.id}`}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
                >
                  View in shop
                </Link>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
