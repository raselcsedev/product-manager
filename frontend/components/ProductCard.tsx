import Link from "next/link";
import ProductThumb from "@/components/ProductThumb";
import PublicPill from "@/components/PublicPill";
import StockBadge from "@/components/StockBadge";
import { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
  onDelete: (product: Product) => void;
}

// One product as a card, used by the grid view on the Products page.
export default function ProductCard({ product: p, onDelete }: ProductCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <Link href={`/products/${p.id}`} aria-label={`View ${p.name}`} className="block p-2 pb-0">
        <ProductThumb fileName={p.imageFileName} name={p.name} size="fill" />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/products/${p.id}`} className="font-medium hover:underline">
            {p.name}
          </Link>
          <span className="shrink-0 font-semibold">{p.price.toFixed(2)}</span>
        </div>

        {(p.category || p.isPublished) && (
          <div className="flex flex-wrap items-center gap-2">
            {p.category && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{p.category.name}</span>
            )}
            {p.isPublished && <PublicPill />}
          </div>
        )}

        {p.description && <p className="line-clamp-2 text-sm text-slate-600">{p.description}</p>}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <StockBadge quantity={p.quantity} />
          <div className="flex gap-2 text-sm">
            <Link href={`/products/edit/${p.id}`} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100">
              Edit
            </Link>
            <button
              type="button"
              onClick={() => onDelete(p)}
              className="rounded-md border border-red-200 px-3 py-1 text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
