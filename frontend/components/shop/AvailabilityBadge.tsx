import { Availability } from "@/types/shop";

const styles: Record<Availability, string> = {
  "In stock": "border-green-200 bg-green-50 text-green-800",
  "Low stock": "border-amber-200 bg-amber-50 text-amber-800",
  "Out of stock": "border-red-200 bg-red-50 text-red-800",
};

// The public shop shows a label instead of the exact number of items in stock.
export default function AvailabilityBadge({ availability }: { availability: Availability }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles[availability]}`}>
      {availability}
    </span>
  );
}
