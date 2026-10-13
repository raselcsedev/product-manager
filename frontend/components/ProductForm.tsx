"use client";

import { useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import { Product, ProductInput } from "@/types/product";

interface ProductFormProps {
  initialValues?: Product;
  submitLabel: string;
  onSubmit: (values: ProductInput) => Promise<void>;
}

type FormErrors = Partial<Record<"name" | "price" | "quantity", string>>;

export default function ProductForm({ initialValues, submitLabel, onSubmit }: ProductFormProps) {
  // Form fields are kept as strings so inputs behave naturally while typing.
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [price, setPrice] = useState(initialValues ? String(initialValues.price) : "");
  const [quantity, setQuantity] = useState(initialValues ? String(initialValues.quantity) : "");

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!name.trim()) e.name = "Product name is required.";
    else if (name.length > 100) e.name = "Product name must be 100 characters or fewer.";

    const priceNum = Number(price);
    if (price.trim() === "" || Number.isNaN(priceNum)) e.price = "Price is required.";
    else if (priceNum <= 0) e.price = "Price must be greater than zero.";

    const qtyNum = Number(quantity);
    if (quantity.trim() === "" || Number.isNaN(qtyNum)) e.quantity = "Quantity is required.";
    else if (!Number.isInteger(qtyNum)) e.quantity = "Quantity must be a whole number.";
    else if (qtyNum < 0) e.quantity = "Quantity cannot be negative.";

    return e;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() === "" ? null : description.trim(),
        price: Number(price),
        quantity: Number(quantity),
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
    // On success the parent navigates away, so we leave `submitting` as true.
  }

  const inputClass =
    "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      {submitError && <Alert type="error" message={submitError} />}

      <div>
        <label htmlFor="name" className="text-sm font-medium">Product name *</label>
        <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium">Description</label>
        <textarea
          id="description"
          rows={3}
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className="text-sm font-medium">Price *</label>
          <input
            id="price"
            type="number"
            step="0.01"
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
        </div>

        <div>
          <label htmlFor="quantity" className="text-sm font-medium">Quantity *</label>
          <input
            id="quantity"
            type="number"
            step="1"
            className={inputClass}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {errors.quantity && <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
        <Link href="/products" className="text-sm text-slate-600 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
