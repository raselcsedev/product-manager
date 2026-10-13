"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@/components/Alert";
import ProductForm from "@/components/ProductForm";
import Spinner from "@/components/Spinner";
import { getProduct, updateProduct } from "@/lib/api";
import { Product, ProductInput } from "@/types/product";

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

  async function handleUpdate(values: ProductInput) {
    await updateProduct(id, values);
    router.push(`/products?success=${encodeURIComponent("Product updated successfully.")}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Edit product</h1>
      {loading && <Spinner label="Loading product..." />}
      {error && <Alert type="error" message={error} />}
      {product && <ProductForm initialValues={product} submitLabel="Save changes" onSubmit={handleUpdate} />}
    </div>
  );
}
