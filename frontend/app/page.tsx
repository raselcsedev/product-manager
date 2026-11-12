"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import BarList from "@/components/charts/BarList";
import DonutChart from "@/components/charts/DonutChart";
import Spinner from "@/components/Spinner";
import StockBadge from "@/components/StockBadge";
import { useAuth } from "@/context/AuthContext";
import { getDashboardCharts, getProductSummary } from "@/lib/api";
import { DashboardCharts } from "@/types/dashboard";
import { ProductSummary } from "@/types/product";

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ label, value, sublabel, icon, iconBg }: StatCardProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all duration-200 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
        {sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}
      </div>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconBg}`}>
        {icon}
      </div>
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
      {/* Welcome Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {user?.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of your store performance and inventory health.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/pos"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-2 4h13M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
            Open POS
          </Link>
          <Link
            href="/products/add"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add product
          </Link>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading dashboard metrics..." />}

      {summary && charts && (
        <>
          {/* Stat Cards Grid */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Products"
              value={String(summary.totalProducts)}
              sublabel="Catalog items"
              iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
            />
            <StatCard
              label="Units In Stock"
              value={summary.totalUnits.toLocaleString()}
              sublabel="Total available units"
              iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              }
            />
            <StatCard
              label="Inventory Value"
              value={`$${money(summary.inventoryValue)}`}
              sublabel="Retail pricing valuation"
              iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Low Stock Alerts"
              value={String(summary.lowStockCount)}
              sublabel={`Threshold < ${summary.lowStockLimit} units`}
              iconBg="bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
          </div>

          {/* Charts Section */}
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="font-bold text-slate-900 dark:text-white">Stock Status Breakdown</h2>
              </div>
              {summary.totalProducts === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">No products available to chart.</p>
              ) : (
                <div className="py-2">
                  <DonutChart
                    centerValue={String(summary.totalProducts)}
                    centerLabel="products"
                    slices={[
                      { label: "In stock", value: charts.stockStatus.inStock, color: "#10b981" },
                      {
                        label: `Low stock (< ${charts.stockStatus.lowStockLimit})`,
                        value: charts.stockStatus.lowStock,
                        color: "#f59e0b",
                      },
                      { label: "Out of stock", value: charts.stockStatus.outOfStock, color: "#ef4444" },
                    ]}
                  />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="font-bold text-slate-900 dark:text-white">Inventory Value by Category</h2>
                <span className="text-xs text-slate-400">Ranked by total valuation</span>
              </div>
              {charts.categories.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">No category data available.</p>
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

          {/* Restock Attention List */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <h2 className="font-bold text-slate-900 dark:text-white">Products Requiring Restock</h2>
              </div>
              <Link href="/products" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400">
                View all inventory →
              </Link>
            </div>

            {summary.totalProducts === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-400">
                You have no products yet. Add products to track stock health here.
              </p>
            ) : summary.lowStock.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                <svg className="mx-auto h-8 w-8 text-emerald-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                All products meet healthy stock levels (above {summary.lowStockLimit} units).
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {summary.lowStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <Link href={`/products/${p.id}`} className="font-semibold text-sm text-slate-800 hover:text-emerald-600 transition-colors dark:text-slate-100">
                          {p.name}
                        </Link>
                        <span className="text-xs text-slate-400">ID: #{p.id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <StockBadge quantity={p.quantity} />
                      <Link
                        href={`/products/edit/${p.id}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Update Stock
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
