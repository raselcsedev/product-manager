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
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* ---------- Left: products ---------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-2xl font-semibold">Point of sale</h1>
          <p className="text-sm text-slate-500">Press Enter in the search box to add the first match.</p>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_180px]">
          <div>
            <label htmlFor="posSearch" className="sr-only">Search products</label>
            <input
              id="posSearch"
              ref={searchRef}
              type="search"
              autoFocus
              autoComplete="off"
              placeholder="Search products by name..."
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <div>
            <label htmlFor="posCategory" className="sr-only">Category</label>
            <select id="posCategory" className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loadError && <Alert type="error" message={loadError} />}

        {loading && products.length === 0 ? (
          <Spinner label="Loading products..." />
        ) : products.length === 0 && !loadError ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
            No products found.
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
              {products.map((p) => {
                const available = p.quantity - inCart(p.id);
                const disabled = available <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    disabled={disabled}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-start gap-2">
                      <ProductThumb fileName={p.imageFileName} name={p.name} />
                      <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between text-sm">
                      <span className="font-semibold">{formatMoney(p.price)}</span>
                      <span className={available <= 0 ? "text-red-600" : "text-slate-500"}>
                        {available <= 0 ? "Out of stock" : `${available} left`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {totalProducts > products.length && (
              <p className="text-center text-xs text-slate-500">
                Showing {products.length} of {totalProducts}. Type in the search box to find the others.
              </p>
            )}
          </>
        )}
      </section>

      {/* ---------- Right: the cart ---------- */}
      <aside className="space-y-3 self-start rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Cart ({itemCount})</h2>
          {cart.length > 0 && (
            <button type="button" onClick={clearCart} className="text-sm text-red-700 hover:underline">
              Clear
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Click a product to add it.
          </p>
        ) : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {cart.map((line) => (
              <li key={line.product.id} className="py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{line.product.name}</p>
                  <button
                    type="button"
                    aria-label={`Remove ${line.product.name}`}
                    onClick={() => removeLine(line.product.id)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    &times;
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Fewer"
                      onClick={() => (line.quantity > 1 ? setQuantity(line.product.id, line.quantity - 1) : removeLine(line.product.id))}
                      className="h-7 w-7 rounded-md border border-slate-300 hover:bg-slate-100"
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
                      className="h-7 w-12 rounded-md border border-slate-300 bg-white text-center"
                    />
                    <button
                      type="button"
                      aria-label="More"
                      onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                      disabled={line.quantity >= line.product.quantity}
                      className="h-7 w-7 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-40"
                    >
                      +
                    </button>
                    <span className="ml-1 text-xs text-slate-500">x {formatMoney(line.product.price)}</span>
                  </div>
                  <span className="font-medium">{formatMoney(fromCents(toCents(line.product.price) * line.quantity))}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Discount and tax */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="posDiscount" className="text-xs font-medium text-slate-600">Discount</label>
            <input
              id="posDiscount"
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="posTax" className="text-xs font-medium text-slate-600">Tax rate (%)</label>
            <input
              id="posTax"
              type="number"
              min="0"
              max="100"
              step="0.01"
              className={inputClass}
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
        </div>
        {discountTooBig && <p className="text-sm text-red-600">The discount is larger than the subtotal.</p>}

        {/* Totals */}
        <dl className="space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd>{formatMoney(fromCents(subtotalCents))}</dd>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-600">Discount</dt>
              <dd>-{formatMoney(fromCents(discountCents))}</dd>
            </div>
          )}
          {taxCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-600">Tax ({rate}%)</dt>
              <dd>{formatMoney(fromCents(taxCents))}</dd>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(fromCents(totalCents))}</dd>
          </div>
        </dl>

        {/* Payment */}
        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Payment</p>
          <div role="group" aria-label="Payment method" className="flex overflow-hidden rounded-md border border-slate-300">
            {PAYMENT_METHODS.map((method, index) => (
              <button
                key={method}
                type="button"
                aria-pressed={payment === method}
                onClick={() => setPayment(method)}
                className={`flex-1 px-3 py-2 text-sm font-medium ${index > 0 ? "border-l border-slate-300" : ""} ${
                  payment === method ? "bg-blue-600 text-white" : "bg-white hover:bg-slate-100"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {payment === "Cash" && (
          <div className="space-y-1">
            <label htmlFor="posTendered" className="text-xs font-medium text-slate-600">Cash received</label>
            <div className="flex gap-2">
              <input
                id="posTendered"
                type="number"
                min="0"
                step="0.01"
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
                className="shrink-0 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-100 disabled:opacity-50"
              >
                Exact
              </button>
            </div>
            {tendered.trim() !== "" && (
              <p className={`text-sm ${changeCents < 0 ? "text-red-600" : "font-medium"}`}>
                {changeCents < 0
                  ? `${formatMoney(fromCents(-changeCents))} short`
                  : `Change: ${formatMoney(fromCents(changeCents))}`}
              </p>
            )}
          </div>
        )}

        {saleError && <Alert type="error" message={saleError} />}

        <button
          type="button"
          onClick={completeSale}
          disabled={!canComplete}
          className="w-full rounded-md bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving..." : `Complete sale  ${formatMoney(fromCents(totalCents))}`}
        </button>
      </aside>

      {/* ---------- Receipt pop-up ---------- */}
      {receipt && (
        <div
          className="print-modal fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Receipt"
        >
          <div className="print-scroll max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4">
            <Alert type="success" message={`Sale ${receipt.receiptNumber} completed.`} />
            <div className="my-4">
              <Receipt sale={receipt} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Print receipt
              </button>
              <button
                type="button"
                onClick={closeReceipt}
                autoFocus
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
