import Link from "next/link";
import { PublicShop } from "@/types/shop";

// One shop in the shop directory
export default function ShopCard({ shop }: { shop: PublicShop }) {
  const initial = shop.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link
      href={`/shops/${shop.slug}`}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 hover:border-blue-300"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{shop.name}</p>
          <p className="text-xs text-slate-500">
            {shop.productCount} product{shop.productCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      {shop.description && <p className="line-clamp-3 text-sm text-slate-600">{shop.description}</p>}
    </Link>
  );
}
