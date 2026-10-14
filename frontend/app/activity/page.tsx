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
  Created: "border-green-200 bg-green-50 text-green-800",
  Updated: "border-blue-200 bg-blue-50 text-blue-800",
  Deleted: "border-red-200 bg-red-50 text-red-800",
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
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

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
    let cancelled = false; // ignore answers from outdated requests

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

    // Link to the product, but only your own, and only while it still exists.
    if (log.entityType === "Product" && log.entityId && log.action !== "Deleted" && log.userId === user?.id) {
      return (
        <Link href={`/products/${log.entityId}`} className="font-medium text-blue-600 hover:underline">
          {label}
        </Link>
      );
    }
    return <span className="font-medium">{label}</span>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <p className="text-sm text-slate-500">
        {showingEveryone
          ? "Everything every user has done, newest first."
          : "A history of the changes you made, newest first."}
      </p>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
        {isAdmin && (
          <div>
            <label htmlFor="scope" className="text-xs font-medium text-slate-600">Show</label>
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
          <label htmlFor="entityType" className="text-xs font-medium text-slate-600">Type</label>
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
          <label htmlFor="action" className="text-xs font-medium text-slate-600">Action</label>
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
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          Nothing here yet. When you add, change or delete products and categories, it shows up here.
        </div>
      ) : (
        items.length > 0 && (
          <ul className={`divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white ${loading ? "opacity-60" : ""}`}>
            {items.map((log) => {
              const who = log.userId === user?.id ? "You" : log.actorName;
              return (
                <li key={log.id} className="flex gap-4 px-4 py-3">
                  <span
                    className={`mt-0.5 h-fit shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${actionStyles[log.action]}`}
                  >
                    {log.action}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{who}</span> {verbs[log.action]}{" "}
                      {typeLabels[log.entityType] ?? log.entityType.toLowerCase()} {renderEntity(log)}
                    </p>
                    {log.details && <p className="mt-0.5 break-words text-sm text-slate-500">{log.details}</p>}
                  </div>

                  <time
                    dateTime={log.createdAt}
                    title={formatFull(log.createdAt)}
                    className="shrink-0 text-xs text-slate-500"
                  >
                    {timeAgo(log.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        )
      )}

      {/* Pagination */}
      {result && result.totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <p>
            {result.totalCount} event{result.totalCount === 1 ? "" : "s"}
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
