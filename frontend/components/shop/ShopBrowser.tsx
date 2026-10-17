"use client";

import { useEffect, useState } from "react";
import Alert from "@/components/Alert";
import PublicProductCard from "@/components/shop/PublicProductCard";
import Spinner from "@/components/Spinner";
import { getPublicCategories, getPublicProducts } from "@/lib/api";
import { SHOP_PAGE_SIZE } from "@/lib/site";
import { useDebounce } from "@/lib/useDebounce";
import { PagedResult } from "@/types/product";
import { PublicCategory, PublicProduct, PublicSort } from "@/types/shop";

const sortOptions: { value: PublicSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name_asc", label: "Name A to Z" },
];

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

interface ShopBrowserProps {
  shop?: string; // a seller's shop address; leave out for the main shop
  // The first page of products and the category list, already fetched on the server.
  // They are part of the page's HTML (so search engines see the products) and
  // the browser does not have to fetch them again.
  initialResult?: PagedResult<PublicProduct> | null;
  initialCategories?: PublicCategory[];
}

// The search box, filters, product grid and paging.
// Used by the main shop (all sellers) and by each seller's shop page.
export default function ShopBrowser({ shop, initialResult, initialCategories }: ShopBrowserProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(""); // "" = all
  const [sort, setSort] = useState<PublicSort>("newest");
  const [page, setPage] = useState(1);

  const dSearch = useDebounce(search); // wait until the visitor pauses typing

  const [categories, setCategories] = useState<PublicCategory[]>(initialCategories ?? []);
  const [result, setResult] = useState<PagedResult<PublicProduct> | null>(initialResult ?? null);
  const [loading, setLoading] = useState(!initialResult);
  const [error, setError] = useState<string | null>(null);

  // Category list: only fetched here when the server did not already provide it
  useEffect(() => {
    if (initialCategories) return;

    let cancelled = false;
    getPublicCategories(shop)
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {
        // the category filter just stays empty
      });
    return () => {
      cancelled = true;
    };
  }, [shop, initialCategories]);

  // Products
  useEffect(() => {
    // Back to the plain first page? Then the products the server already gave us are exactly what we need.
    const isFirstPageView = dSearch === "" && category === "" && sort === "newest" && page === 1;
    if (initialResult && isFirstPageView) {
      setResult(initialResult);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false; // ignore answers from outdated requests

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getPublicProducts({
          shop,
          search: dSearch,
          category: category || undefined,
          sort,
          page,
          pageSize: SHOP_PAGE_SIZE,
        });
        if (!cancelled) setResult(res);
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
  }, [shop, dSearch, category, sort, page, initialResult]);

  const items = result?.items ?? [];
  const totalPages = result?.totalPages ?? 0;
  const hasFilters = search !== "" || category !== "";

  function clearFilters() {
    setSearch("");
    setCategory("");
    setSort("newest");
    setPage(1);
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="shopSearch" className="text-xs font-medium text-slate-600">Search</label>
          <input
            id="shopSearch"
            type="search"
            placeholder="What are you looking for?"
            className={inputClass}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div>
          <label htmlFor="shopCategory" className="text-xs font-medium text-slate-600">Category</label>
          <select
            id="shopCategory"
            className={inputClass}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.productCount})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="shopSort" className="text-xs font-medium text-slate-600">Sort by</label>
          <select
            id="shopSort"
            className={inputClass}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as PublicSort);
              setPage(1);
            }}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {loading && !result ? (
        <Spinner label="Loading products..." />
      ) : result && result.totalCount === 0 && !error ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          {hasFilters ? (
            <>
              <p>No products match your search.</p>
              <button onClick={clearFilters} className="mt-3 text-sm text-blue-600 hover:underline">
                Clear filters
              </button>
            </>
          ) : shop ? (
            "This shop has no published products yet."
          ) : (
            "No products have been published yet. Please check back soon."
          )}
        </div>
      ) : (
        items.length > 0 && (
          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
            {items.map((p) => (
              <PublicProductCard key={p.id} product={p} />
            ))}
          </div>
        )
      )}

      {/* Pagination */}
      {result && result.totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <p>
            {result.totalCount} product{result.totalCount === 1 ? "" : "s"}
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
