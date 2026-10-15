"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import ProductThumb from "@/components/ProductThumb";
import { getCategories, imageUrl } from "@/lib/api";
import { Category } from "@/types/category";
import { ImageChange, Product, ProductInput } from "@/types/product";

interface ProductFormProps {
  initialValues?: Product;
  submitLabel: string;
  onSubmit: (values: ProductInput, image: ImageChange) => Promise<void>;
}

type FormErrors = Partial<Record<"name" | "price" | "quantity", string>>;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB (the server checks this too)

export default function ProductForm({ initialValues, submitLabel, onSubmit }: ProductFormProps) {
  // Form fields are kept as strings so inputs behave naturally while typing.
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [price, setPrice] = useState(initialValues ? String(initialValues.price) : "");
  const [quantity, setQuantity] = useState(initialValues ? String(initialValues.quantity) : "");
  const [categoryId, setCategoryId] = useState(
    initialValues?.categoryId != null ? String(initialValues.categoryId) : ""
  );
  const [isPublished, setIsPublished] = useState(initialValues?.isPublished ?? false);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0); // changing the key resets the file input

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load the categories for the dropdown
  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {
        if (!cancelled) setCategoriesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Local preview of a newly chosen file (before it is uploaded)
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const existingFileName = initialValues?.imageFileName ?? null;
  const showingExisting = !!existingFileName && !removeImage && !imageFile;
  const hasAnyImage = !!imageFile || showingExisting;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageError(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError("Only JPG, PNG or WebP images are allowed.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }
    setImageFile(file);
    setRemoveImage(false);
  }

  function handleRemoveImage() {
    setImageError(null);
    if (imageFile) {
      // Just forget the newly chosen file
      setImageFile(null);
      setInputKey((k) => k + 1);
    } else {
      // Remove the image that is already saved
      setRemoveImage(true);
    }
  }

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
      await onSubmit(
        {
          name: name.trim(),
          description: description.trim() === "" ? null : description.trim(),
          price: Number(price),
          quantity: Number(quantity),
          categoryId: categoryId === "" ? null : Number(categoryId),
          isPublished,
        },
        { file: imageFile, remove: removeImage && !imageFile }
      );
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

      <div>
        <label htmlFor="category" className="text-sm font-medium">Category</label>
        <select
          id="category"
          className={inputClass}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {categoriesError ? (
          <p className="mt-1 text-sm text-amber-700">Could not load categories. You can still save without one.</p>
        ) : (
          categories.length === 0 && (
            <p className="mt-1 text-sm text-slate-500">
              No categories yet.{" "}
              <Link href="/categories" className="text-blue-600 hover:underline">Create one</Link>
            </p>
          )
        )}
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

      {/* Image */}
      <div>
        <label htmlFor="image" className="text-sm font-medium">Image</label>
        <div className="mt-2 flex items-start gap-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Selected image preview" className="h-32 w-32 rounded-md border border-slate-200 object-cover" />
          ) : showingExisting && existingFileName ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl(existingFileName)} alt={name || "Product image"} className="h-32 w-32 rounded-md border border-slate-200 object-cover" />
          ) : (
            <ProductThumb fileName={null} name={name} size="lg" />
          )}

          <div className="space-y-2">
            <input
              key={inputKey}
              id="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-100"
            />
            <p className="text-xs text-slate-500">JPG, PNG or WebP, up to 2 MB.</p>
            {hasAnyImage && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-sm text-red-700 hover:underline"
              >
                Remove image
              </button>
            )}
            {removeImage && !imageFile && (
              <p className="text-xs text-amber-700">The current image will be removed when you save.</p>
            )}
            {imageError && <p className="text-sm text-red-600">{imageError}</p>}
          </div>
        </div>
      </div>

      {/* Public shop */}
      <div className="rounded-md border border-slate-200 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="font-medium">Show on the public shop</span>
            <span className="block text-slate-500">
              Anyone, even without an account, can then see this product&apos;s name, description, price, image and
              category. Your exact stock quantity stays private (visitors only see In stock, Low stock or Out of stock).
            </span>
          </span>
        </label>
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
