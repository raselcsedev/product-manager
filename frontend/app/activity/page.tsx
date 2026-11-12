"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";
import { getActivity } from "@/lib/api";
import { formatFull, timeAgo } from "@/lib/time";
import { AuditAction, AuditEntityType, AuditLog } from "@/types/activity";
import { PagedResult } from "@/types/product";

const PAGE_SIZE = 20;

const actionStyles: Record<AuditAction, string> = {
  Created: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300",
  Updated: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800/80 dark:bg-teal-950/40 dark:text-teal-300",
  Deleted: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-300",
};

const verbs: Record<AuditAction, string> = {
  Created: "created",
  Updated: "updated",
  Deleted: "deleted",
};

const typeLabels: Record<AuditEntityType, string> = {
  Product: "product",
  Category: "category",
  User: "user account",
};

const selectClass =
  "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

export default function ActivityPage() {
  const { user, isAdmin } = useAuth();

  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<PagedResult<AuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getActivity({
          scope: isAdmin ? scope : "mine",
          entityType,
          action,
          page,
          pageSize: PAGE_SIZE,
        });
        if (!cancelled) setResult(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load activity.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scope, entityType, action, page, isAdmin, reloadKey]);

  const items = result?.items ?? [];
  const totalPages = result?.totalPages ?? 0;
  const showingEveryone = isAdmin && scope === "all";

  function renderEntity(log: AuditLog) {
    const label = `"${log.entityName}"`;

    if (log.entityType === "Product" && log.entityId && log.action !== "Deleted" && log.userId === user?.id) {
      return (
        <Link href={`/products/${log.entityId}`} className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
          {label}
        </Link>
      );
    }
    return <span className="font-semibold text-slate-900 dark:text-white">{label}</span>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Activity Log</h1>
          <p className="mt-1 text-sm text-slate-500">
            {showingEveryone
              ? "Comprehensive audit log of system events across all accounts."
              : "Track recent changes, inventory updates, and category events."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-all disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${loading ? "animate-spin text-emerald-600" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        {isAdmin && (
          <div>
            <label htmlFor="scope" className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">Scope</label>
            <select
              id="scope"
              className={selectClass}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as "mine" | "all");
                setPage(1);
              }}
            >
              <option value="mine">My activity</option>
              <option value="all">Everyone</option>
            </select>
          </div>
        )}

        <div>
          <label htmlFor="entityType" className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">Target Type</label>
          <select
            id="entityType"
            className={selectClass}
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Everything</option>
            <option value="Product">Products</option>
            <option value="Category">Categories</option>
            <option value="User">Accounts</option>
          </select>
        </div>

        <div>
          <label htmlFor="action" className="block mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">Action</label>
          <select
            id="action"
            className={selectClass}
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All actions</option>
            <option value="Created">Created</option>
            <option value="Updated">Updated</option>
            <option value="Deleted">Deleted</option>
          </select>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {loading && !result ? (
        <Spinner label="Loading activity..." />
      ) : result && result.totalCount === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500">
          Nothing here yet. When you add, change or delete products and categories, it shows up here.
        </div>
      ) : (
        items.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <ul className={`divide-y divide-slate-100 dark:divide-slate-800 ${loading ? "opacity-60" : ""}`}>
              {items.map((log) => {
                const who = log.userId === user?.id ? "You" : log.actorName;
                return (
                  <li key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <span
                      className={`mt-0.5 h-fit shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${actionStyles[log.action]}`}
                    >
                      {log.action}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800 dark:text-slate-200">
                        <span className="font-semibold text-slate-900 dark:text-white">{who}</span> {verbs[log.action]}{" "}
                        {typeLabels[log.entityType] ?? log.entityType.toLowerCase()} {renderEntity(log)}
                      </p>
                      {log.details && (
                        <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg font-mono">
                          {log.details}
                        </p>
                      )}
                    </div>

                    <time
                      dateTime={log.createdAt}
                      title={formatFull(log.createdAt)}
                      className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500"
                    >
                      {timeAgo(log.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      )}

      {/* Pagination */}
      {result && result.totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <p>
            Showing {items.length} of {result.totalCount} event{result.totalCount === 1 ? "" : "s"}
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
