export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
}

// What the form collects (no id)
export interface ProductInput {
  name: string;
  description: string | null;
  price: number;
  quantity: number;
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
  minPrice?: number;
  maxPrice?: number;
  stock?: StockFilter;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  pageSize?: number;
}
