import { Availability } from "@/types/shop";

const styles: Record<Availability, string> = {
  "In stock": "border-emerald-200/90 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  "Low stock": "border-amber-200/90 bg-amber-50/90 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  "Out of stock": "border-rose-200/90 bg-rose-50/90 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
};

// The public shop shows a label instead of the exact number of items in stock.
export default function AvailabilityBadge({ availability }: { availability: Availability }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm shadow-xs ${styles[availability]}`}>
      {availability}
    </span>
  );
}
