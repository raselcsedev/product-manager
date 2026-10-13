"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Alert from "@/components/Alert";
import ProductThumb from "@/components/ProductThumb";
import Spinner from "@/components/Spinner";
import { deleteProduct, downloadProductsCsv, getCategories, getProductsPage } from "@/lib/api";
import { saveBlob } from "@/lib/download";
import { useDebounce } from "@/lib/useDebounce";
import { Category } from "@/types/category";
import { PagedResult, Product, StockFilter } from "@/types/product";

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

const pageSizes = [5, 10, 20, 50];

export default function ProductList() {
  const searchParams = useSearchParams();

  // Filter / sort / page state
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(""); // "" = all categories
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [stock, setStock] = useState<StockFilter>("all");
  const [sort, setSort] = useState("id:asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
  const [success, setSuccess] = useState<string | null>(searchParams.get("success"));
  const [reloadKey, setReloadKey] = useState(0); // bump to force a reload (after delete)

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
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load products.");
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
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    setError(null);
    setSuccess(null);
    try {
      await deleteProduct(product.id);
      setSuccess(`"${product.name}" was deleted.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product.");
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      // Same filters and sorting as the table, but no page / pageSize: we want every matching row.
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
        setError("The export was limited to the first 10,000 products. Narrow the filters to export the rest.");
      } else {
        setSuccess("CSV downloaded. It contains all products matching your current filters and sort order.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export products.");
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
    search !== "" || categoryId !== "" || minPrice !== "" || maxPrice !== "" || stock !== "all";
  const products = result?.items ?? [];
  const totalPages = result?.totalPages ?? 0;
  const from = result && result.totalCount > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const to = result ? Math.min(result.page * result.pageSize, result.totalCount) : 0;

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !result || result.totalCount === 0}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <Link href="/products/add" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Add product
          </Link>
        </div>
      </div>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="search" className="text-xs font-medium text-slate-600">Search</label>
          <input
            id="search"
            type="search"
            placeholder="Name or description"
            className={inputClass}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label htmlFor="stock" className="text-xs font-medium text-slate-600">Stock</label>
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
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="categoryFilter" className="text-xs font-medium text-slate-600">Category</label>
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
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="minPrice" className="text-xs font-medium text-slate-600">Min price</label>
          <input
            id="minPrice"
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={minPrice}
            onChange={(e) => {
              setMinPrice(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label htmlFor="maxPrice" className="text-xs font-medium text-slate-600">Max price</label>
          <input
            id="maxPrice"
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label htmlFor="sort" className="text-xs font-medium text-slate-600">Sort by</label>
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
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
              <button onClick={clearFilters} className="mt-3 text-sm text-blue-600 hover:underline">
                Clear filters
              </button>
            </>
          ) : (
            "No products yet. Add your first product to get started."
          )}
        </div>
      ) : (
        products.length > 0 && (
          <div className={`overflow-x-auto rounded-lg border border-slate-200 bg-white ${loading ? "opacity-60" : ""}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{p.id}</td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-3">
                        <ProductThumb fileName={p.imageFileName} name={p.name} />
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.category ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {p.category.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.description ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{p.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{p.quantity}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/products/edit/${p.id}`}
                          className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(p)}
                          className="rounded-md border border-red-200 px-3 py-1 text-red-700 hover:bg-red-50"
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
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-slate-600 sm:flex-row">
          <p>
            Showing {from}-{to} of {result.totalCount}
          </p>

          <div className="flex items-center gap-3">
            <label htmlFor="pageSize" className="sr-only">Rows per page</label>
            <select
              id="pageSize"
              className="rounded-md border border-slate-300 bg-white px-2 py-1"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>

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
