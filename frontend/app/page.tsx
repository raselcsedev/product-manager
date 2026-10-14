"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import BarList from "@/components/charts/BarList";
import DonutChart from "@/components/charts/DonutChart";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";
import { getDashboardCharts, getProductSummary } from "@/lib/api";
import { DashboardCharts } from "@/types/dashboard";
import { ProductSummary } from "@/types/product";

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ProductSummary | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Both requests run at the same time, so the page loads faster.
        const [s, c] = await Promise.all([getProductSummary(), getDashboardCharts()]);
        setSummary(s);
        setCharts(c);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {user?.name}</h1>
          <p className="text-sm text-slate-500">These numbers include only the products you created.</p>
        </div>
        <Link
          href="/products/add"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add product
        </Link>
      </div>

      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading dashboard..." />}

      {summary && charts && (
        <>
          {/* Numbers */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total products" value={String(summary.totalProducts)} />
            <StatCard label="Units in stock" value={summary.totalUnits.toLocaleString()} />
            <StatCard label="Inventory value" value={money(summary.inventoryValue)} />
            <StatCard label={`Low stock (under ${summary.lowStockLimit})`} value={String(summary.lowStockCount)} />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 font-medium">Stock status</h2>
              {summary.totalProducts === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">No products yet, so there is nothing to chart.</p>
              ) : (
                <DonutChart
                  centerValue={String(summary.totalProducts)}
                  centerLabel="products"
                  slices={[
                    { label: "In stock", value: charts.stockStatus.inStock, color: "#10b981" },
                    {
                      label: `Low stock (under ${charts.stockStatus.lowStockLimit})`,
                      value: charts.stockStatus.lowStock,
                      color: "#f59e0b",
                    },
                    { label: "Out of stock", value: charts.stockStatus.outOfStock, color: "#ef4444" },
                  ]}
                />
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
              <h2 className="mb-4 font-medium">Inventory value by category</h2>
              {charts.categories.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">No products yet, so there is nothing to chart.</p>
              ) : (
                <BarList
                  format={money}
                  items={charts.categories.map((c) => ({
                    label: c.name,
                    value: c.value,
                    detail: `${c.productCount} product${c.productCount === 1 ? "" : "s"}, ${c.units.toLocaleString()} units`,
                  }))}
                />
              )}
            </section>
          </div>

          {/* Restock list */}
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-medium">Products that need restocking</h2>
              <Link href="/products" className="text-sm text-blue-600 hover:underline">
                View all products
              </Link>
            </div>

            {summary.totalProducts === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-600">
                You have no products yet. Add your first product to see stats here.
              </p>
            ) : summary.lowStock.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-600">
                Every product has at least {summary.lowStockLimit} units in stock.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.lowStock.map((p) => (
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
