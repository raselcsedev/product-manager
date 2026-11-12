"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { createProduct, uploadProductImage } from "@/lib/api";
import { ImageChange, ProductInput } from "@/types/product";

export default function AddProductPage() {
  const router = useRouter();

  async function handleCreate(values: ProductInput, image: ImageChange) {
    const created = await createProduct(values);

    if (image.file) {
      try {
        await uploadProductImage(created.id, image.file);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown error";
        router.push(`/products?error=${encodeURIComponent(`Product created, but the image upload failed: ${reason}`)}`);
        return;
      }
    }

    router.push(`/products?success=${encodeURIComponent("Product created successfully.")}`);
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Add Product</h1>
        <p className="mt-1 text-sm text-slate-500">Create a new item in your inventory catalog.</p>
      </div>
      <ProductForm submitLabel="Create Product" onSubmit={handleCreate} />
    </div>
  );
}
