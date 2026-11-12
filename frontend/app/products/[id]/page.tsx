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
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{value}</p>
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
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to products
      </Link>

      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading product..." />}

      {product && (
        <div className="grid gap-8 rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-xs md:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 aspect-square dark:border-slate-800 dark:bg-slate-800">
              <ProductThumb fileName={product.imageFileName} name={product.name} size="fill" className="h-full w-full object-cover" />
            </div>
            {!product.imageFileName && (
              <p className="mt-2 text-xs text-slate-400 text-center">
                No product image uploaded.{" "}
                <Link href={`/products/edit/${product.id}`} className="text-emerald-600 hover:underline dark:text-emerald-400">
                  Upload image
                </Link>
              </p>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <p className="font-mono text-xs text-slate-400">Product #{product.id}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{product.name}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {product.category ? (
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {product.category.name}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Uncategorized</span>
              )}
              <StockBadge quantity={product.quantity} />
              {product.isPublished ? (
                <PublicPill />
              ) : (
                <span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-400 dark:border-slate-700">Private</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Price" value={`$${money(product.price)}`} />
              <Stat label="Quantity" value={product.quantity.toLocaleString()} />
              <Stat label="Total Value" value={`$${money(product.price * product.quantity)}`} />
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Description</h2>
              {product.description ? (
                <p className="mt-2 whitespace-pre-line text-sm text-slate-600 leading-relaxed dark:text-slate-300">{product.description}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-400">No description provided for this product.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Link
                href={`/products/edit/${product.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 transition-all"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit product
              </Link>
              {product.isPublished && (
                <Link
                  href={`/shop/${product.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  View in shop
                </Link>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60 dark:border-red-900/60 dark:bg-slate-800 dark:text-red-400"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
