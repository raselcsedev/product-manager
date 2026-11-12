import { getStockStatus } from "@/lib/stock";

const styles = {
  in: "border-emerald-200/90 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  low: "border-amber-200/90 bg-amber-50/90 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  out: "border-rose-200/90 bg-rose-50/90 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
};

const dots = {
  in: "bg-emerald-500",
  low: "bg-amber-500",
  out: "bg-rose-500",
};

// A small colored pill with status indicator dot
export default function StockBadge({ quantity }: { quantity: number }) {
  const status = getStockStatus(quantity);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm shadow-xs ${styles[status.key]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status.key]}`} />
      {status.label}
    </span>
  );
}
