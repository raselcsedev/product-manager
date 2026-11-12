"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Alert from "@/components/Alert";
import ProductCard from "@/components/ProductCard";
import ProductThumb from "@/components/ProductThumb";
import Spinner from "@/components/Spinner";
import {
  deleteProduct,
  downloadProductsCsv,
  getCategories,
  getProductsPage,
} from "@/lib/api";
import { saveBlob } from "@/lib/download";
import { useDebounce } from "@/lib/useDebounce";
import { Category } from "@/types/category";
import { PagedResult, Product, StockFilter } from "@/types/product";
import PublicPill from "@/components/PublicPill";
import StockBadge from "@/components/StockBadge";

const sortOptions = [
  { value: "id:asc", label: "Oldest first" },
  { value: "id:desc", label: "Newest first" },
  { value: "name:asc", label: "Name A to Z" },
  { value: "name:desc", label: "Name Z to A" },
  { value: "price:asc", label: "Price: low to high" },
  { value: "price:desc", label: "Price: high to low" },
  { value: "quantity:asc", label: "Quantity: low to high" },
  { value: "quantity:desc", label: "Quantity: high to low" },
];

const stockOptions: { value: StockFilter; label: string }[] = [
  { value: "all", label: "All stock levels" },
  { value: "in", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

const pageSizes = [6, 12, 24, 48];

type ViewMode = "table" | "grid";

export default function ProductList() {
  const searchParams = useSearchParams();

  // Table or grid (remembered between visits, default to grid for card system)
  const [view, setView] = useState<ViewMode>("grid");

  // Filter / sort / page state
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(""); // "" = all categories
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [stock, setStock] = useState<StockFilter>("all");
  const [sort, setSort] = useState("id:asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Text inputs update instantly, but the API is called after the user pauses typing.
  const dSearch = useDebounce(search);
  const dMin = useDebounce(minPrice);
  const dMax = useDebounce(maxPrice);

  // Data state
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<PagedResult<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [success, setSuccess] = useState<string | null>(
    searchParams.get("success"),
  );
  const [reloadKey, setReloadKey] = useState(0); // bump to force a reload (after delete)

  // Load the saved view choice (done in an effect, because localStorage does not exist on the server)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("productsView");
      if (saved === "table" || saved === "grid") setView(saved);
    } catch {
      // storage can be blocked; the default view is fine
    }
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem("productsView", next);
    } catch {
      // ignore
    }
  }

  // Categories for the filter dropdown (loaded once)
  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {
        // The filter simply stays empty if categories fail to load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false; // ignore answers from outdated requests

    async function load() {
      setLoading(true);
      try {
        const [sortBy, sortDir] = sort.split(":");
        const res = await getProductsPage({
          search: dSearch,
          categoryId: categoryId === "" ? undefined : Number(categoryId),
          minPrice: dMin === "" ? undefined : Number(dMin),
          maxPrice: dMax === "" ? undefined : Number(dMax),
          stock,
          sortBy,
          sortDir,
          page,
          pageSize,
        });
        if (cancelled) return;
        setResult(res);
        // Deleted the last row on the last page? Step back one page.
        if (res.items.length === 0 && res.page > 1) {
          setPage(Math.max(1, res.totalPages));
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load products.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dSearch, categoryId, dMin, dMax, stock, sort, page, pageSize, reloadKey]);

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`))
      return;

    setError(null);
    setSuccess(null);
    try {
      await deleteProduct(product.id);
      setSuccess(`"${product.name}" was deleted.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete product.",
      );
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      // Same filters and sorting as the list, but no page / pageSize: we want every matching row.
      const [sortBy, sortDir] = sort.split(":");
      const { blob, truncated } = await downloadProductsCsv({
        search: dSearch,
        categoryId: categoryId === "" ? undefined : Number(categoryId),
        minPrice: dMin === "" ? undefined : Number(dMin),
        maxPrice: dMax === "" ? undefined : Number(dMax),
        stock,
        sortBy,
        sortDir,
      });

      saveBlob(blob, `products-${new Date().toLocaleDateString("en-CA")}.csv`);

      if (truncated) {
        setError(
          "The export was limited to the first 10,000 products. Narrow the filters to export the rest.",
        );
      } else {
        setSuccess(
          "CSV downloaded. It contains all products matching your current filters and sort order.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to export products.",
      );
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setCategoryId("");
    setMinPrice("");
    setMaxPrice("");
    setStock("all");
    setSort("id:asc");
    setPage(1);
  }

  const hasFilters =
    search !== "" ||
    categoryId !== "" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    stock !== "all";
  const products = result?.items ?? [];
  const totalPages = result?.totalPages ?? 0;
  const from =
    result && result.totalCount > 0
      ? (result.page - 1) * result.pageSize + 1
      : 0;
  const to = result
    ? Math.min(result.page * result.pageSize, result.totalCount)
    : 0;

  const inputClass =
    "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

  const viewButton = (
    mode: ViewMode,
    label: string,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      aria-pressed={view === mode}
      onClick={() => changeView(mode)}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
        view === mode
          ? "bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Products</h1>
          <p className="mt-1 text-sm text-slate-500">Manage and browse your complete inventory catalog.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="View mode"
            className="flex items-center rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900"
          >
            {viewButton(
              "table",
              "Table",
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>,
            )}
            {viewButton(
              "grid",
              "Cards",
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
              </svg>,
            )}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !result || result.totalCount === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <Link
            href="/products/add"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add product
          </Link>
        </div>
      </div>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters & Sorting
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
            >
              Reset filters
            </button>
          )}
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <label
              htmlFor="search"
              className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Search
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                id="search"
                type="search"
                placeholder="Product name or keywords..."
                className={`${inputClass} pl-9`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="categoryFilter" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Category
            </label>
            <select
              id="categoryFilter"
              className={inputClass}
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="stock" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Stock
            </label>
            <select
              id="stock"
              className={inputClass}
              value={stock}
              onChange={(e) => {
                setStock(e.target.value as StockFilter);
                setPage(1);
              }}
            >
              {stockOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="minPrice"
              className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Min price
            </label>
            <input
              id="minPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className={inputClass}
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="sort" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Sort by
            </label>
            <select
              id="sort"
              className={inputClass}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading && !result ? (
        <Spinner label="Loading products..." />
      ) : result && result.totalCount === 0 && !error ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          {hasFilters ? (
            <>
              <p>No products match your filters.</p>
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            </>
          ) : (
            "No products yet. Add your first product to get started."
          )}
        </div>
      ) : products.length > 0 && view === "grid" ? (
        <div
          className={`grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 ${loading ? "opacity-60" : ""}`}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        products.length > 0 && (
          <div
            className={`overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 ${loading ? "opacity-60" : ""}`}
          >
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5 text-right">Price</th>
                  <th className="px-5 py-3.5 text-right">Stock</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/50">
                    <td className="px-5 py-4 font-mono text-xs text-slate-400">#{p.id}</td>
                    <td className="px-5 py-4 font-medium">
                      <Link
                        href={`/products/${p.id}`}
                        className="flex items-center gap-3 text-slate-900 hover:text-blue-600 transition-colors dark:text-slate-100"
                      >
                        <ProductThumb
                          fileName={p.imageFileName}
                          name={p.name}
                          size="sm"
                        />
                        <div className="flex flex-col">
                          <span className="font-semibold">{p.name}</span>
                          {p.isPublished && <div className="mt-0.5"><PublicPill /></div>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      {p.category ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {p.category.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {p.description ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900 dark:text-white">
                      ${p.price.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <StockBadge quantity={p.quantity} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/products/edit/${p.id}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(p)}
                          className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors dark:border-red-900/60 dark:bg-slate-800 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Pagination */}
      {result && result.totalCount > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600 shadow-xs sm:flex-row dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <p className="text-xs font-medium text-slate-500">
            Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{from}</span> to <span className="font-semibold text-slate-800 dark:text-slate-200">{to}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{result.totalCount}</span> products
          </p>

          <div className="flex items-center gap-3">
            <label htmlFor="pageSize" className="sr-only">
              Rows per page
            </label>
            <select
              id="pageSize"
              className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>

            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Previous
            </button>
            <span className="text-xs font-medium">
              Page {result.page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
