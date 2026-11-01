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
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <Link href="/pos" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New sale
        </Link>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="range" className="text-xs font-medium text-slate-600">Period</label>
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
          <label htmlFor="payment" className="text-xs font-medium text-slate-600">Payment</label>
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
          <label htmlFor="status" className="text-xs font-medium text-slate-600">Status</label>
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

      {error && <Alert type="error" message={error} />}

      {/* Summary for the chosen period (voided sales are left out) */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue" value={formatMoney(summary.revenue)} hint={rangeLabels[range]} />
          <StatCard label="Sales" value={String(summary.saleCount)} hint={`${summary.itemsSold} items sold`} />
          <StatCard label="Average sale" value={formatMoney(summary.averageSale)} />
          <StatCard label="Voided" value={String(summary.voidedCount)} hint="Not counted in revenue" />
        </div>
      )}

      {summary && summary.byPayment.length > 0 && (
        <p className="text-sm text-slate-600">
          {summary.byPayment.map((p) => `${p.method}: ${formatMoney(p.total)} (${p.count})`).join("  ·  ")}
        </p>
      )}

      {loading && !result ? (
        <Spinner label="Loading sales..." />
      ) : result && result.totalCount === 0 && !error ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          No sales in this period.{" "}
          <Link href="/pos" className="text-blue-600 hover:underline">Open the point of sale</Link>
        </div>
      ) : (
        items.length > 0 && (
          <div className={`overflow-x-auto rounded-lg border border-slate-200 bg-white ${loading ? "opacity-60" : ""}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Receipt</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 text-right font-medium">Lines</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-4 py-3">
                      <Link href={`/sales/${sale.id}`} className="font-medium text-blue-600 hover:underline">
                        {sale.receiptNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatFull(sale.createdAt)}</td>
                    <td className="px-4 py-3 text-right">{sale.itemCount}</td>
                    <td className="px-4 py-3">{sale.paymentMethod}</td>
                    <td className={`px-4 py-3 text-right font-medium ${sale.isVoided ? "text-slate-400 line-through" : ""}`}>
                      {formatMoney(sale.total)}
                    </td>
                    <td className="px-4 py-3">
                      {sale.isVoided ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">Voided</span>
                      ) : (
                        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">Completed</span>
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
        <div className="flex items-center justify-between text-sm text-slate-600">
          <p>{result.totalCount} sale{result.totalCount === 1 ? "" : "s"}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {result.page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
