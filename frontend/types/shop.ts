export type Availability = "In stock" | "Low stock" | "Out of stock";

// What a visitor who is not logged in is allowed to see
export interface PublicProduct {
  id: number;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  imageFileName: string | null;
  availability: Availability;
}

export interface PublicCategory {
  name: string;
  productCount: number;
}

export type PublicSort = "newest" | "price_asc" | "price_desc" | "name_asc";

export interface PublicProductQueryParams {
  search?: string;
  category?: string;
  sort?: PublicSort;
  page?: number;
  pageSize?: number;
}
