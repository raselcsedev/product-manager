"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import Spinner from "@/components/Spinner";
import { getProducts } from "@/lib/api";
import { Product } from "@/types/product";

const LOW_STOCK_LIMIT = 10;

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setProducts(await getProducts());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalProducts = products.length;
  const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);
  const inventoryValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const lowStock = products
    .filter((p) => p.quantity < LOW_STOCK_LIMIT)
    .sort((a, b) => a.quantity - b.quantity);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          href="/products/add"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add product
        </Link>
      </div>

      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading dashboard..." />}

      {!loading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total products" value={String(totalProducts)} />
            <StatCard label="Units in stock" value={totalUnits.toLocaleString()} />
            <StatCard
              label="Inventory value"
              value={inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            />
            <StatCard label={`Low stock (under ${LOW_STOCK_LIMIT})`} value={String(lowStock.length)} />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-medium">Products that need restocking</h2>
              <Link href="/products" className="text-sm text-blue-600 hover:underline">
                View all products
              </Link>
            </div>

            {totalProducts === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-600">
                No products yet. Add your first product to see stats here.
              </p>
            ) : lowStock.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-600">
                Every product has at least {LOW_STOCK_LIMIT} units in stock.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lowStock.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-slate-500">
                        {p.quantity === 0 ? "Out of stock" : `${p.quantity} left`}
                      </p>
                    </div>
                    <Link
                      href={`/products/edit/${p.id}`}
                      className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
                    >
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
