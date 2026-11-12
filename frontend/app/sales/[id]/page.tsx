"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Alert from "@/components/Alert";
import Receipt from "@/components/pos/Receipt";
import Spinner from "@/components/Spinner";
import { getSale, voidSale } from "@/lib/salesApi";
import { Sale } from "@/types/pos";

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) {
      setError("This sale link is not valid.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    getSale(id)
      .then((data) => {
        if (!cancelled) setSale(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the sale.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleVoid(event: React.FormEvent) {
    event.preventDefault();
    if (!sale) return;

    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Please give a reason (at least 3 characters).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await voidSale(sale.id, trimmed);
      setSale(updated);
      setVoiding(false);
      setReason("");
      setSuccess("The sale was voided and the items were returned to stock.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The sale could not be voided.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/sales"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to sales list
      </Link>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading sale transaction..." />}

      {sale && (
        <div className="space-y-6">
          <Receipt sale={sale} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 transition-all"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Receipt
            </button>
            {!sale.isVoided && !voiding && (
              <button
                type="button"
                onClick={() => setVoiding(true)}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
              >
                Void Sale
              </button>
            )}
          </div>

          {voiding && !sale.isVoided && (
            <form onSubmit={handleVoid} className="space-y-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-6 shadow-xs">
              <div>
                <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">Void This Transaction?</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  The sale will be cancelled and item quantities will be restocked to inventory. This audit entry is permanent.
                </p>
              </div>

              <div>
                <label htmlFor="voidReason" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Reason for voiding *
                </label>
                <textarea
                  id="voidReason"
                  rows={2}
                  maxLength={200}
                  placeholder="e.g. Customer refund, incorrect item rung up"
                  className="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition-colors"
                >
                  {saving ? "Voiding..." : "Confirm Void"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiding(false);
                    setReason("");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
