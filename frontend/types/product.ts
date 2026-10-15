export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  categoryId: number | null;
  category: { id: number; name: string } | null;
  imageFileName: string | null;
  isPublished: boolean; // true = visible on the public shop
}

// What the form collects (no id, no image: images are uploaded separately)
export interface ProductInput {
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  categoryId: number | null;
  isPublished: boolean;
}

// What the user did with the image in the form
export interface ImageChange {
  file: File | null; // a newly chosen image to upload
  remove: boolean;   // true = delete the current image
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ProductSummary {
  totalProducts: number;
  totalUnits: number;
  inventoryValue: number;
  lowStockLimit: number;
  lowStockCount: number;
  lowStock: Product[];
}

export type StockFilter = "all" | "in" | "low" | "out";

export interface ProductQueryParams {
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  stock?: StockFilter;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  pageSize?: number;
}
