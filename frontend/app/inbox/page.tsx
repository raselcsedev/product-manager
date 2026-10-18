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
    let cancelled = false; // ignore answers from outdated requests

    async function load() {
      setLoading(true);
      try {
        const res = await getInquiries({ unread: unreadOnly, page, pageSize: PAGE_SIZE });
        if (cancelled) return;
        setResult(res);
        // Deleted the last message on the last page? Step back one page.
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
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-sm text-slate-500">Messages visitors sent you from your public products.</p>
        </div>
        <button
          type="button"
          onClick={handleMarkAllRead}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          Mark all as read
        </button>
      </div>

      {/* Filter */}
      <div role="group" aria-label="Filter messages" className="inline-flex overflow-hidden rounded-md border border-slate-300">
        {[
          { label: "All", value: false },
          { label: "Unread", value: true },
        ].map((option, index) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={unreadOnly === option.value}
            onClick={() => {
              setUnreadOnly(option.value);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-medium ${index > 0 ? "border-l border-slate-300" : ""} ${
              unreadOnly === option.value ? "bg-blue-600 text-white" : "bg-white hover:bg-slate-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {loading && !result ? (
        <Spinner label="Loading your messages..." />
      ) : result && result.totalCount === 0 && !error ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          {unreadOnly
            ? "No unread messages."
            : "No messages yet. When a visitor writes to you from one of your public products, it shows up here."}
        </div>
      ) : (
        items.length > 0 && (
          <ul className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
            {items.map((inquiry) => (
              <li
                key={inquiry.id}
                className={`rounded-lg border bg-white p-4 ${inquiry.isRead ? "border-slate-200" : "border-blue-300"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{inquiry.senderName}</span>
                      {!inquiry.isRead && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                          New
                        </span>
                      )}
                    </p>
                    <p className="break-all text-sm text-slate-500">{inquiry.senderEmail}</p>
                  </div>
                  <time dateTime={inquiry.createdAt} title={formatFull(inquiry.createdAt)} className="shrink-0 text-xs text-slate-500">
                    {timeAgo(inquiry.createdAt)}
                  </time>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  About:{" "}
                  {inquiry.productId ? (
                    <Link href={`/products/${inquiry.productId}`} className="font-medium text-blue-600 hover:underline">
                      {inquiry.productName}
                    </Link>
                  ) : (
                    <span>{inquiry.productName} (product deleted)</span>
                  )}
                </p>

                {/* Shown as plain text: anything a visitor typed, even HTML, can never run on this page */}
                <p className="mt-3 whitespace-pre-line break-words text-sm">{inquiry.message}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <a
                    href={`mailto:${inquiry.senderEmail}?subject=${encodeURIComponent(`Re: ${inquiry.productName}`)}`}
                    className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
                  >
                    Reply by email
                  </a>
                  <button
                    type="button"
                    onClick={() => handleToggleRead(inquiry)}
                    disabled={busyId === inquiry.id}
                    className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {inquiry.isRead ? "Mark as unread" : "Mark as read"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(inquiry)}
                    disabled={busyId === inquiry.id}
                    className="rounded-md border border-red-200 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Pagination */}
      {result && result.totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <p>
            {result.totalCount} message{result.totalCount === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {result.page} of {totalPages}
            </span>
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
