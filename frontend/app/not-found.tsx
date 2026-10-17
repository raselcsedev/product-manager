import Link from "next/link";

// Shown (with a real 404 status) when a product or shop does not exist or is no longer public.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-slate-600">
        We couldn&apos;t find that page. The product or shop may have been removed, or the seller may have made it private.
      </p>
      <div className="flex justify-center gap-3">
        <Link href="/shop" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Browse the shop
        </Link>
        <Link href="/shops" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">
          See all shops
        </Link>
      </div>
    </div>
  );
}
