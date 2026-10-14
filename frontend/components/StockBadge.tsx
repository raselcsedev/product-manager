import { getStockStatus } from "@/lib/stock";

const styles = {
  in: "border-green-200 bg-green-50 text-green-800",
  low: "border-amber-200 bg-amber-50 text-amber-800",
  out: "border-red-200 bg-red-50 text-red-800",
};

// A small colored pill: In stock / Low stock / Out of stock
export default function StockBadge({ quantity }: { quantity: number }) {
  const status = getStockStatus(quantity);

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status.key]}`}>
      {status.label}
    </span>
  );
}
