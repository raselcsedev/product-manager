"use client";

import { useRouter } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { createProduct, uploadProductImage } from "@/lib/api";
import { ImageChange, ProductInput } from "@/types/product";

export default function AddProductPage() {
  const router = useRouter();

  async function handleCreate(values: ProductInput, image: ImageChange) {
    // Step 1: create the product (JSON)
    const created = await createProduct(values);

    // Step 2: upload the image for the new product (multipart), if one was chosen
    if (image.file) {
      try {
        await uploadProductImage(created.id, image.file);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown error";
        // The product exists, so don't make the user fill the form again.
        router.push(`/products?error=${encodeURIComponent(`Product created, but the image upload failed: ${reason}`)}`);
        return;
      }
    }

    router.push(`/products?success=${encodeURIComponent("Product created successfully.")}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Add product</h1>
        <p className="mt-1 text-sm text-slate-500">Create a new item in your inventory catalog.</p>
      </div>
      <ProductForm submitLabel="Create product" onSubmit={handleCreate} />
    </div>
  );
}
