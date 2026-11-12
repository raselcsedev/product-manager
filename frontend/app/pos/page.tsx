"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@/components/Alert";
import Receipt from "@/components/pos/Receipt";
import ProductThumb from "@/components/ProductThumb";
import Spinner from "@/components/Spinner";
import { getCategories, getProductsPage } from "@/lib/api";
import { formatMoney, fromCents, toCents } from "@/lib/pos";
import { createSale } from "@/lib/salesApi";
import { useDebounce } from "@/lib/useDebounce";
import { Category } from "@/types/category";
import { PaymentMethod, Sale } from "@/types/pos";
import { Product } from "@/types/product";

interface CartLine {
  product: Product;
  quantity: number;
}

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Card", "Mobile"];

const inputClass =
  "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

export default function PosPage() {
  // ---- finding products ----
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const dSearch = useDebounce(search, 250);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // ---- the sale ----
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [tendered, setTendered] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  // The tax rate is remembered, because a shop usually charges the same rate every time
  useEffect(() => {
    try {
      const saved = localStorage.getItem("posTaxRate");
      if (saved) setTaxRate(saved);
    } catch {
      // storage can be blocked: the field simply starts empty
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false; // ignore answers from outdated requests

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await getProductsPage({
          search: dSearch,
          categoryId: categoryId === "" ? undefined : Number(categoryId),
          sortBy: "name",
          sortDir: "asc",
          pageSize: 48,
        });
        if (cancelled) return;
        setProducts(res.items);
        setTotalProducts(res.totalCount);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load products.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dSearch, categoryId, reloadKey]);

  // ---- cart actions ----
  const inCart = (productId: number) => cart.find((l) => l.product.id === productId)?.quantity ?? 0;

  function addToCart(product: Product) {
    setSaleError(null);
    setCart((lines) => {
      const existing = lines.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) return lines; // no more in stock
        return lines.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      if (product.quantity < 1) return lines;
      return [...lines, { product, quantity: 1 }];
    });
  }

  function setQuantity(productId: number, value: number) {
    setSaleError(null);
    setCart((lines) =>
      lines.map((l) =>
        l.product.id === productId
          ? { ...l, quantity: Math.max(1, Math.min(l.product.quantity, Math.floor(value) || 1)) }
          : l
      )
    );
  }

  function removeLine(productId: number) {
    setCart((lines) => lines.filter((l) => l.product.id !== productId));
  }

  function clearCart() {
    setCart([]);
    setDiscount("");
    setTendered("");
    setSaleError(null);
    searchRef.current?.focus();
  }

  // Enter in the search box adds the first product that is in stock (a barcode scanner types the code and presses Enter)
  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const first = products.find((p) => p.quantity - inCart(p.id) > 0);
    if (first) {
      addToCart(first);
      setSearch("");
    }
  }

  // ---- the maths (in whole cents; the server calculates the real figures again) ----
  const rate = Math.min(100, Math.max(0, Number(taxRate) || 0));
  const subtotalCents = cart.reduce((sum, l) => sum + toCents(l.product.price) * l.quantity, 0);
  const rawDiscountCents = toCents(Number(discount) || 0);
  const discountTooBig = rawDiscountCents > subtotalCents;
  const discountCents = Math.min(rawDiscountCents, subtotalCents);
  const taxableCents = subtotalCents - discountCents;
  const taxCents = Math.round((taxableCents * rate) / 100);
  const totalCents = taxableCents + taxCents;
  const tenderedCents = toCents(Number(tendered) || 0);
  const changeCents = tenderedCents - totalCents;

  const cashShort = payment === "Cash" && (tendered.trim() === "" || tenderedCents < totalCents);
  const canComplete = cart.length > 0 && !discountTooBig && !cashShort && !submitting;

  const itemCount = useMemo(() => cart.reduce((sum, l) => sum + l.quantity, 0), [cart]);

  async function completeSale() {
    if (!canComplete) return;
    setSubmitting(true);
    setSaleError(null);
    try {
      const sale = await createSale({
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        discount: fromCents(discountCents),
        taxRatePercent: rate,
        paymentMethod: payment,
        amountTendered: payment === "Cash" ? fromCents(tenderedCents) : null,
      });

      try {
        localStorage.setItem("posTaxRate", String(rate));
      } catch {
        // ignore
      }

      setReceipt(sale);
      setCart([]);
      setDiscount("");
      setTendered("");
      setReloadKey((k) => k + 1); // stock numbers changed
    } catch (err) {
      setSaleError(err instanceof Error ? err.message : "The sale could not be completed.");
      setReloadKey((k) => k + 1); // maybe the stock changed meanwhile: show the real numbers
    } finally {
      setSubmitting(false);
    }
  }

  function closeReceipt() {
    setReceipt(null);
    searchRef.current?.focus();
  }

  // Esc closes the receipt
  useEffect(() => {
    if (!receipt) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setReceipt(null);
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [receipt]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* ---------- Left: products ---------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Point of sale</h1>
            <p className="mt-1 text-sm text-slate-500">Tap products to quickly add to customer order.</p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <kbd className="rounded border border-blue-200 bg-white px-1 font-mono text-[11px] shadow-xs dark:border-blue-800 dark:bg-slate-900">Enter</kbd>
            in search adds top match
          </span>
        </div>

        {/* Search & Category Filter */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                id="posSearch"
                ref={searchRef}
                type="search"
                autoFocus
                autoComplete="off"
                placeholder="Search products or scan barcode..."
                className={`${inputClass} pl-10`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <div>
              <label htmlFor="posCategory" className="sr-only">Category</label>
              <select
                id="posCategory"
                className={inputClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Category Chips */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setCategoryId("")}
                className={`shrink-0 rounded-full px-3 py-1 font-medium transition-colors ${
                  categoryId === ""
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                All
              </button>
              {categories.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(categoryId === String(c.id) ? "" : String(c.id))}
                  className={`shrink-0 rounded-full px-3 py-1 font-medium transition-colors ${
                    categoryId === String(c.id)
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {loadError && <Alert type="error" message={loadError} />}

        {loading && products.length === 0 ? (
          <Spinner label="Loading products..." />
        ) : products.length === 0 && !loadError ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <svg className="mx-auto h-12 w-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="mt-3 text-base font-semibold text-slate-700 dark:text-slate-300">No products found</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting your search terms or category filter.</p>
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 ${loading ? "opacity-60" : ""}`}>
              {products.map((p) => {
                const inCartQty = inCart(p.id);
                const available = p.quantity - inCartQty;
                const disabled = available <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    disabled={disabled}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border text-left p-3.5 transition-all duration-200 ${
                      disabled
                        ? "border-slate-200/60 bg-slate-50/50 opacity-60 cursor-not-allowed dark:border-slate-800 dark:bg-slate-900/40"
                        : inCartQty > 0
                        ? "border-blue-500 bg-blue-50/20 shadow-sm ring-1 ring-blue-500/20 hover:border-blue-600 hover:shadow-md active:scale-[0.98] dark:border-blue-500/80 dark:bg-blue-950/20"
                        : "border-slate-200/90 bg-white shadow-xs hover:border-blue-400 hover:shadow-md active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    {/* In-cart badge */}
                    {inCartQty > 0 && (
                      <span className="absolute top-2.5 right-2.5 z-10 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs">
                        {inCartQty} in cart
                      </span>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                        <ProductThumb fileName={p.imageFileName} name={p.name} size="sm" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1 pr-6">
                        <span className="line-clamp-2 text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors dark:text-slate-100">
                          {p.name}
                        </span>
                        {p.category && (
                          <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                            {p.category.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        {formatMoney(p.price)}
                      </span>
                      <span className={`font-medium ${available <= 0 ? "text-rose-600" : "text-slate-500"}`}>
                        {available <= 0 ? "Out of stock" : `${available} left`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {totalProducts > products.length && (
              <p className="text-center text-xs text-slate-500">
                Showing {products.length} of {totalProducts}. Type in the search box to find others.
              </p>
            )}
          </>
        )}
      </section>

      {/* ---------- Right: the cart ---------- */}
      <aside className="space-y-4 self-start rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-20">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-2 4h13M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
            <h2 className="font-bold text-slate-900 dark:text-white">Order Summary</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400 dark:border-slate-800">
            <svg className="mx-auto h-8 w-8 text-slate-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="text-sm font-medium">Cart is currently empty</p>
            <p className="text-xs mt-0.5 text-slate-400">Click products on the left to add items</p>
          </div>
        ) : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
            {cart.map((line) => (
              <li key={line.product.id} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 line-clamp-1 dark:text-slate-100">
                    {line.product.name}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ${line.product.name}`}
                    onClick={() => removeLine(line.product.id)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Fewer"
                      onClick={() => (line.quantity > 1 ? setQuantity(line.product.id, line.quantity - 1) : removeLine(line.product.id))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 font-bold hover:bg-slate-100 active:scale-95 transition-all dark:border-slate-700 dark:bg-slate-800"
                    >
                      -
                    </button>
                    <input
                      aria-label={`Quantity of ${line.product.name}`}
                      type="number"
                      min={1}
                      max={line.product.quantity}
                      value={line.quantity}
                      onChange={(e) => setQuantity(line.product.id, Number(e.target.value))}
                      className="h-7 w-12 rounded-lg border border-slate-200 bg-white text-center text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      aria-label="More"
                      onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                      disabled={line.quantity >= line.product.quantity}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 font-bold hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800"
                    >
                      +
                    </button>
                    <span className="ml-1 text-xs text-slate-400">× {formatMoney(line.product.price)}</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatMoney(fromCents(toCents(line.product.price) * line.quantity))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Discount and tax */}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div>
            <label htmlFor="posDiscount" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Discount ($)</label>
            <input
              id="posDiscount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className={inputClass}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="posTax" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Tax rate (%)</label>
            <input
              id="posTax"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              className={inputClass}
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
        </div>
        {discountTooBig && <p className="text-xs text-rose-600 font-medium">Discount cannot exceed subtotal.</p>}

        {/* Totals Breakdown */}
        <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <div className="flex justify-between text-slate-500">
            <dt>Subtotal</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-300">{formatMoney(fromCents(subtotalCents))}</dd>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between text-emerald-600">
              <dt>Discount</dt>
              <dd className="font-semibold">-{formatMoney(fromCents(discountCents))}</dd>
            </div>
          )}
          {taxCents > 0 && (
            <div className="flex justify-between text-slate-500">
              <dt>Tax ({rate}%)</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-300">{formatMoney(fromCents(taxCents))}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200/80 pt-2 text-lg font-bold text-slate-900 dark:border-slate-800 dark:text-white">
            <dt>Total</dt>
            <dd className="text-blue-600 dark:text-blue-400">{formatMoney(fromCents(totalCents))}</dd>
          </div>
        </dl>

        {/* Payment */}
        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Payment method</p>
          <div role="group" aria-label="Payment method" className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                aria-pressed={payment === method}
                onClick={() => setPayment(method)}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  payment === method
                    ? "bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {payment === "Cash" && (
          <div className="space-y-1.5">
            <label htmlFor="posTendered" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cash received</label>
            <div className="flex gap-2">
              <input
                id="posTendered"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className={inputClass}
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    completeSale();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setTendered(String(fromCents(totalCents)))}
                disabled={cart.length === 0}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Exact
              </button>
            </div>
            {tendered.trim() !== "" && (
              <p className={`text-xs font-medium ${changeCents < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {changeCents < 0
                  ? `${formatMoney(fromCents(-changeCents))} short`
                  : `Change due: ${formatMoney(fromCents(changeCents))}`}
              </p>
            )}
          </div>
        )}

        {saleError && <Alert type="error" message={saleError} />}

        <button
          type="button"
          onClick={completeSale}
          disabled={!canComplete}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            "Processing sale..."
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Complete Sale • {formatMoney(fromCents(totalCents))}
            </>
          )}
        </button>
      </aside>

      {/* ---------- Receipt pop-up ---------- */}
      {receipt && (
        <div
          className="print-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Receipt"
        >
          <div className="print-scroll max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <Alert type="success" message={`Sale #${receipt.receiptNumber} completed successfully.`} />
            <div className="my-5">
              <Receipt sale={receipt} />
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print receipt
              </button>
              <button
                type="button"
                onClick={closeReceipt}
                autoFocus
                className="flex-1 inline-flex items-center justify-center rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                New sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
