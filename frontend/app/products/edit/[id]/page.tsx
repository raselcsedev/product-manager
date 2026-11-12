"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Alert from "@/components/Alert";
import ProductForm from "@/components/ProductForm";
import Spinner from "@/components/Spinner";
import { deleteProductImage, getProduct, updateProduct, uploadProductImage } from "@/lib/api";
import { ImageChange, Product, ProductInput } from "@/types/product";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setProduct(await getProduct(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load product.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleUpdate(values: ProductInput, image: ImageChange) {
    await updateProduct(id, values);

    try {
      if (image.file) await uploadProductImage(id, image.file);
      else if (image.remove) await deleteProductImage(id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      router.push(`/products?error=${encodeURIComponent(`Product updated, but the image change failed: ${reason}`)}`);
      return;
    }

    router.push(`/products?success=${encodeURIComponent("Product updated successfully.")}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to products
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Edit Product</h1>
        <p className="mt-1 text-sm text-slate-500">Update product details, pricing and inventory levels.</p>
      </div>
      {loading && <Spinner label="Loading product..." />}
      {error && <Alert type="error" message={error} />}
      {product && <ProductForm initialValues={product} submitLabel="Save Changes" onSubmit={handleUpdate} />}
    </div>
  );
}
