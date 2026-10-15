import Link from "next/link";
import AvailabilityBadge from "@/components/shop/AvailabilityBadge";
import ProductThumb from "@/components/ProductThumb";
import { PublicProduct } from "@/types/shop";

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PublicProductCard({ product: p }: { product: PublicProduct }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <Link href={`/shop/${p.id}`} aria-label={`View ${p.name}`} className="block p-2 pb-0">
        <ProductThumb fileName={p.imageFileName} name={p.name} size="fill" />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/shop/${p.id}`} className="font-medium hover:underline">
            {p.name}
          </Link>
          <span className="shrink-0 font-semibold">{money(p.price)}</span>
        </div>

        {p.category && (
          <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{p.category}</span>
        )}

        {p.description && <p className="line-clamp-2 text-sm text-slate-600">{p.description}</p>}

        <div className="mt-auto pt-2">
          <AvailabilityBadge availability={p.availability} />
        </div>
      </div>
    </article>
  );
}
