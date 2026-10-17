import Link from "next/link";
import ShopBrowser from "@/components/shop/ShopBrowser";

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Shop</h1>
          <p className="text-sm text-slate-500">Browse products published by our sellers. No account needed.</p>
        </div>
        <Link href="/shops" className="text-sm text-blue-600 hover:underline">
          Browse by shop
        </Link>
      </div>

      <ShopBrowser />
    </div>
  );
}
