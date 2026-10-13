"use client";

import { useEffect, useState } from "react";
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
    // Step 1: save the product fields (JSON)
    await updateProduct(id, values);

    // Step 2: apply the image change, if any
    try {
      if (image.file) await uploadProductImage(id, image.file); // new or replacement image
      else if (image.remove) await deleteProductImage(id);      // removed image
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      router.push(`/products?error=${encodeURIComponent(`Product updated, but the image change failed: ${reason}`)}`);
      return;
    }

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
