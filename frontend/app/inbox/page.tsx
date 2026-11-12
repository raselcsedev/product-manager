"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import Spinner from "@/components/Spinner";
import { deleteInquiry, getInquiries, markAllInquiriesRead, setInquiryRead } from "@/lib/api";
import { formatFull, timeAgo } from "@/lib/time";
import { Inquiry } from "@/types/inquiry";
import { PagedResult } from "@/types/product";

const PAGE_SIZE = 20;

// Tells the sidebar to refresh the number next to "Inbox"
const notifyInboxChanged = () => window.dispatchEvent(new Event("inbox:changed"));

export default function InboxPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<PagedResult<Inquiry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await getInquiries({ unread: unreadOnly, page, pageSize: PAGE_SIZE });
        if (cancelled) return;
        setResult(res);
        if (res.items.length === 0 && res.page > 1) setPage(Math.max(1, res.totalPages));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your messages.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [unreadOnly, page, reloadKey]);

  function refresh() {
    setReloadKey((k) => k + 1);
    notifyInboxChanged();
  }

  async function handleToggleRead(inquiry: Inquiry) {
    setBusyId(inquiry.id);
    setError(null);
    setSuccess(null);
    try {
      await setInquiryRead(inquiry.id, !inquiry.isRead);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the message.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(inquiry: Inquiry) {
    if (!window.confirm(`Delete the message from ${inquiry.senderName}? This cannot be undone.`)) return;

    setBusyId(inquiry.id);
    setError(null);
    setSuccess(null);
    try {
      await deleteInquiry(inquiry.id);
      setSuccess("Message deleted.");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the message.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllRead() {
    setError(null);
    setSuccess(null);
    try {
      await markAllInquiriesRead();
      setSuccess("All messages are marked as read.");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update your messages.");
    }
  }

  const items = result?.items ?? [];
  const totalPages = result?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Customer Inquiries</h1>
          <p className="mt-1 text-sm text-slate-500">Messages and inquiries sent by visitors from your public storefront.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-all"
          >
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark all as read
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div role="group" aria-label="Filter messages" className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
          {[
            { label: "All Messages", value: false },
            { label: "Unread Only", value: true },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={unreadOnly === option.value}
              onClick={() => {
                setUnreadOnly(option.value);
                setPage(1);
              }}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                unreadOnly === option.value
                  ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {result && (
          <span className="text-xs font-medium text-slate-500">
            Total: {result.totalCount} message{result.totalCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {loading && !result ? (
        <Spinner label="Loading customer messages..." />
      ) : result && result.totalCount === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500">
          {unreadOnly
            ? "No unread messages found."
            : "No inquiries yet. When a visitor writes to you from one of your public products, it will appear here."}
        </div>
      ) : (
        items.length > 0 && (
          <div className="space-y-4">
            {items.map((inquiry) => (
              <article
                key={inquiry.id}
                className={`rounded-2xl border bg-white p-6 shadow-xs transition-all dark:bg-slate-900 ${
                  inquiry.isRead
                    ? "border-slate-200/80 dark:border-slate-800"
                    : "border-emerald-500/50 ring-1 ring-emerald-500/20 dark:border-emerald-500/40"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        {inquiry.senderName}
                      </h3>
                      {!inquiry.isRead && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {inquiry.senderEmail}
                    </p>
                  </div>
                  <time dateTime={inquiry.createdAt} title={formatFull(inquiry.createdAt)} className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {timeAgo(inquiry.createdAt)}
                  </time>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium">Product inquiry:</span>
                  {inquiry.productId ? (
                    <Link
                      href={`/products/${inquiry.productId}`}
                      className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {inquiry.productName} →
                    </Link>
                  ) : (
                    <span>{inquiry.productName} (Archived / Deleted)</span>
                  )}
                </div>

                {/* Message body */}
                <div className="mt-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800">
                  <p className="whitespace-pre-line break-words text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {inquiry.message}
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <a
                    href={`mailto:${inquiry.senderEmail}?subject=${encodeURIComponent(`Re: ${inquiry.productName}`)}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Reply by email
                  </a>
                  <button
                    type="button"
                    onClick={() => handleToggleRead(inquiry)}
                    disabled={busyId === inquiry.id}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors disabled:opacity-50"
                  >
                    {inquiry.isRead ? "Mark as unread" : "Mark as read"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(inquiry)}
                    disabled={busyId === inquiry.id}
                    className="rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {/* Pagination */}
      {result && result.totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <p>
            Showing {items.length} of {result.totalCount} message{result.totalCount === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-colors disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs px-2 font-medium">
              Page {result.page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-colors disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
