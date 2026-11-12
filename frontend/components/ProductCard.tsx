import Link from "next/link";
import ProductThumb from "@/components/ProductThumb";
import PublicPill from "@/components/PublicPill";
import StockBadge from "@/components/StockBadge";
import { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
  onDelete: (product: Product) => void;
}

export default function ProductCard({ product: p, onDelete }: ProductCardProps) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-xl hover:border-blue-400/60 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900">
      {/* Product Image & Badges Header */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <Link href={`/products/${p.id}`} aria-label={`View ${p.name}`} className="block h-full w-full">
          <ProductThumb
            fileName={p.imageFileName}
            name={p.name}
            size="fill"
            className="transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </Link>

        {/* Floating Badges */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <div>
            <StockBadge quantity={p.quantity} />
          </div>
          <div className="flex items-center gap-1.5">
            {p.isPublished && <PublicPill />}
          </div>
        </div>
      </div>

      {/* Product Information */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category & ID tag */}
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">#{p.id}</span>
          {p.category ? (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {p.category.name}
            </span>
          ) : (
            <span className="text-slate-400">Uncategorized</span>
          )}
        </div>

        {/* Name */}
        <Link
          href={`/products/${p.id}`}
          className="line-clamp-1 text-base font-semibold text-slate-900 hover:text-blue-600 transition-colors dark:text-slate-100"
          title={p.name}
        >
          {p.name}
        </Link>

        {/* Description */}
        <p className="mt-1 line-clamp-2 min-h-[2.25rem] text-xs text-slate-500 leading-relaxed dark:text-slate-400">
          {p.description || "No description provided for this product."}
        </p>

        {/* Price & Quantity summary */}
        <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <div>
            <span className="text-xs font-medium text-slate-400">Price</span>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              ${p.price.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-medium text-slate-400">Inventory</span>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {p.quantity} <span className="text-xs font-normal text-slate-400">units</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Link
            href={`/products/${p.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View
          </Link>
          <Link
            href={`/products/edit/${p.id}`}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            title="Edit product"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Link>
          <button
            type="button"
            onClick={() => onDelete(p)}
            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors dark:border-red-900/60 dark:bg-slate-800 dark:hover:bg-red-950/40"
            title="Delete product"
            aria-label={`Delete ${p.name}`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
