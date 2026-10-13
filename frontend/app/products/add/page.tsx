"use client";

import { useRouter } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { createProduct } from "@/lib/api";
import { ProductInput } from "@/types/product";

export default function AddProductPage() {
  const router = useRouter();

  async function handleCreate(values: ProductInput) {
    await createProduct(values);
    router.push(`/products?success=${encodeURIComponent("Product created successfully.")}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Add product</h1>
      <ProductForm submitLabel="Create product" onSubmit={handleCreate} />
    </div>
  );
}
