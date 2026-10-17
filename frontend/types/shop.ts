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
  shopName: string | null; // only set when the seller has a shop page
  shopSlug: string | null;
}

export interface PublicCategory {
  name: string;
  productCount: number;
}

// A seller's public shop page
export interface PublicShop {
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
}

export type PublicSort = "newest" | "price_asc" | "price_desc" | "name_asc";

export interface PublicProductQueryParams {
  search?: string;
  category?: string;
  shop?: string;
  sort?: PublicSort;
  page?: number;
  pageSize?: number;
}

// The seller's own shop settings
export interface MyShop {
  shopName: string | null;
  shopSlug: string | null;
  shopDescription: string | null;
  publishedProductCount: number;
}

export interface MyShopInput {
  shopName: string;
  shopSlug: string;
  shopDescription: string | null;
}
