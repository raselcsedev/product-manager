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
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Add product</h1>
      <ProductForm submitLabel="Create product" onSubmit={handleCreate} />
    </div>
  );
}
