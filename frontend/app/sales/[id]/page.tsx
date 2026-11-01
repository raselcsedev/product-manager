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

  const [voiding, setVoiding] = useState(false); // is the "void" form open?
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
      setSuccess("The sale was voided and the items are back in stock.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The sale could not be voided.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link href="/sales" className="inline-block text-sm text-slate-600 hover:underline">
        &larr; Back to sales
      </Link>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}
      {loading && <Spinner label="Loading the sale..." />}

      {sale && (
        <>
          <Receipt sale={sale} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Print receipt
            </button>
            {!sale.isVoided && !voiding && (
              <button
                type="button"
                onClick={() => setVoiding(true)}
                className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Void sale
              </button>
            )}
          </div>

          {voiding && !sale.isVoided && (
            <form onSubmit={handleVoid} className="space-y-3 rounded-lg border border-red-200 bg-white p-4">
              <p className="text-sm font-medium">Void this sale?</p>
              <p className="text-sm text-slate-600">
                The whole sale is cancelled and every item goes back into stock. It stays in your history, marked as voided.
                This cannot be undone.
              </p>
              <div>
                <label htmlFor="voidReason" className="text-sm font-medium">Reason *</label>
                <textarea
                  id="voidReason"
                  rows={2}
                  maxLength={200}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? "Voiding..." : "Void sale"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiding(false);
                    setReason("");
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
