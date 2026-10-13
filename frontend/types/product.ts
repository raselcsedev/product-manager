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
