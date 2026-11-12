import Link from "next/link";
import AvailabilityBadge from "@/components/shop/AvailabilityBadge";
import ProductThumb from "@/components/ProductThumb";
import { PublicProduct } from "@/types/shop";

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PublicProductCard({ product: p }: { product: PublicProduct }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-xl hover:border-emerald-400/60 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50">
      {/* Product Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <Link href={`/shop/${p.id}`} aria-label={`View ${p.name}`} className="block h-full w-full">
          <ProductThumb
            fileName={p.imageFileName}
            name={p.name}
            size="fill"
            className="transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </Link>
        <div className="pointer-events-none absolute left-3 top-3">
          <AvailabilityBadge availability={p.availability} />
        </div>
      </div>

      {/* Product Information */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category & Shop attribution */}
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          {p.category ? (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {p.category}
            </span>
          ) : (
            <span>Product</span>
          )}

          {p.shopSlug && p.shopName && (
            <span className="truncate pl-2">
              by{" "}
              <Link href={`/shops/${p.shopSlug}`} className="font-semibold text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors dark:text-slate-300">
                {p.shopName}
              </Link>
            </span>
          )}
        </div>

        {/* Product Name */}
        <Link
          href={`/shop/${p.id}`}
          className="line-clamp-1 text-base font-semibold text-slate-900 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors dark:text-slate-100"
          title={p.name}
        >
          {p.name}
        </Link>

        {/* Description */}
        <p className="mt-1 line-clamp-2 min-h-[2.25rem] text-xs text-slate-500 leading-relaxed dark:text-slate-400">
          {p.description || "Discover this quality product in our shop."}
        </p>

        {/* Price & Action Row */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-medium text-slate-400">Price</span>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              ${money(p.price)}
            </div>
          </div>
          <Link
            href={`/shop/${p.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all"
          >
            Details
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
