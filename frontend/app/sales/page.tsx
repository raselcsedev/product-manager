"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import Spinner from "@/components/Spinner";
import { RangeKey, formatMoney, rangeFor, rangeLabels } from "@/lib/pos";
import { getSales, getSalesSummary } from "@/lib/salesApi";
import { formatFull } from "@/lib/time";
import { SaleListItem, SalesSummary } from "@/types/pos";
import { PagedResult } from "@/types/product";

const PAGE_SIZE = 20;

const selectClass =
  "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function SalesPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [payment, setPayment] = useState<"all" | "Cash" | "Card" | "Mobile">("all");
  const [status, setStatus] = useState<"all" | "completed" | "voided">("all");
  const [page, setPage] = useState(1);

  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [result, setResult] = useState<PagedResult<SaleListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = rangeFor(range);
        const [s, list] = await Promise.all([
          getSalesSummary({ from, to }),
          getSales({ from, to, payment, status, page, pageSize: PAGE_SIZE }),
        ]);
        if (cancelled) return;
        setSummary(s);
        setResult(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your sales.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [range, payment, status, page]);

  const items = result?.items ?? [];
  const totalPages = result?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Sales & Transactions</h1>
          <p className="mt-1 text-sm text-slate-500">Track orders, payment methods, and revenue history.</p>
        </div>
        <Link
          href="/pos"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New sale
        </Link>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="range" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Period</label>
            <select
              id="range"
              className={selectClass}
              value={range}
              onChange={(e) => {
                setRange(e.target.value as RangeKey);
                setPage(1);
              }}
            >
              {(Object.keys(rangeLabels) as RangeKey[]).map((key) => (
                <option key={key} value={key}>{rangeLabels[key]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="payment" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Payment method</label>
            <select
              id="payment"
              className={selectClass}
              value={payment}
              onChange={(e) => {
                setPayment(e.target.value as typeof payment);
                setPage(1);
              }}
            >
              <option value="all">All methods</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Mobile">Mobile</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Transaction Status</label>
            <select
              id="status"
              className={selectClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                setPage(1);
              }}
            >
              <option value="all">All sales</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Summary for the chosen period */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Revenue" value={formatMoney(summary.revenue)} hint={rangeLabels[range]} />
          <StatCard label="Orders Completed" value={String(summary.saleCount)} hint={`${summary.itemsSold} items sold`} />
          <StatCard label="Average Order Value" value={formatMoney(summary.averageSale)} hint="Per completed transaction" />
          <StatCard label="Voided Transactions" value={String(summary.voidedCount)} hint="Excluded from revenue" />
        </div>
      )}

      {summary && summary.byPayment.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Payment breakdown:</span>
          {summary.byPayment.map((p) => (
            <span key={p.method} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {p.method}: <strong className="text-slate-900 dark:text-white">{formatMoney(p.total)}</strong> ({p.count})
            </span>
          ))}
        </div>
      )}

      {loading && !result ? (
        <Spinner label="Loading sales transactions..." />
      ) : result && result.totalCount === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <svg className="mx-auto h-12 w-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
          </svg>
          <p className="mt-3 text-base font-semibold text-slate-700 dark:text-slate-300">No transactions recorded for this period.</p>
          <p className="mt-1 text-xs text-slate-400">
            Process orders via POS to view receipts and financial records here.
          </p>
          <Link href="/pos" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:underline">
            Open Point of Sale →
          </Link>
        </div>
      ) : (
        items.length > 0 && (
          <div className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 ${loading ? "opacity-60" : ""}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Receipt #</th>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5 text-center">Items</th>
                  <th className="px-5 py-3.5">Payment</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/50">
                    <td className="px-5 py-4">
                      <Link href={`/sales/${sale.id}`} className="font-mono text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400">
                        {sale.receiptNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">{formatFull(sale.createdAt)}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {sale.itemCount}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className={`px-5 py-4 text-right font-bold ${sale.isVoided ? "text-slate-400 line-through" : "text-slate-900 dark:text-white"}`}>
                      {formatMoney(sale.total)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {sale.isVoided ? (
                        <span className="inline-flex items-center rounded-full border border-rose-200/90 bg-rose-50/90 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400">
                          Voided
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400">
                          Completed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {result && result.totalCount > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600 shadow-xs sm:flex-row dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <p className="text-xs font-medium text-slate-500">
            Total of <span className="font-semibold text-slate-800 dark:text-slate-200">{result.totalCount}</span> {result.totalCount === 1 ? "transaction" : "transactions"}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Previous
            </button>
            <span className="text-xs font-medium">Page {result.page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
