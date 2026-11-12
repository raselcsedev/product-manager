import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-5 py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Page not found</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        We couldn&apos;t find that page. The product or storefront may have been moved, removed, or made private.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <Link
          href="/shop"
          className="inline-flex items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 transition-all"
        >
          Browse marketplace
        </Link>
        <Link
          href="/shops"
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-colors"
        >
          See all storefronts
        </Link>
      </div>
    </div>
  );
}
