import { Suspense } from "react";
import ProductList from "@/components/ProductList";
import Spinner from "@/components/Spinner";

export default function ProductsPage() {
  // Suspense is required because ProductList reads the URL query string.
  return (
    <Suspense fallback={<Spinner />}>
      <ProductList />
    </Suspense>
  );
}
