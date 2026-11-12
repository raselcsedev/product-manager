import Link from "next/link";
import { PublicShop } from "@/types/shop";

// One shop in the shop directory
export default function ShopCard({ shop }: { shop: PublicShop }) {
  const initial = shop.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link
      href={`/shops/${shop.slug}`}
      className="group flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-emerald-400/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50 transition-all duration-300"
    >
      <div className="flex items-center gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-md shadow-emerald-600/30">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-base text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {shop.name}
          </p>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            {shop.productCount} product{shop.productCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      {shop.description && (
        <p className="line-clamp-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {shop.description}
        </p>
      )}
    </Link>
  );
}
