export type PaymentMethod = "Cash" | "Card" | "Mobile";

export interface SaleItem {
  id: number;
  productId: number | null; // null once the product was deleted
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

// A whole sale: also the receipt
export interface Sale {
  id: number;
  saleNumber: number;
  receiptNumber: string;
  createdAt: string;
  cashierName: string;
  shopName: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  taxRatePercent: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  changeGiven: number;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
}

// One row of the sales history
export interface SaleListItem {
  id: number;
  saleNumber: number;
  receiptNumber: string;
  createdAt: string;
  total: number;
  paymentMethod: PaymentMethod;
  itemCount: number;
  isVoided: boolean;
}

export interface SalesSummary {
  saleCount: number;
  revenue: number;
  averageSale: number;
  itemsSold: number;
  voidedCount: number;
  byPayment: { method: PaymentMethod; count: number; total: number }[];
}

// What the cashier screen sends. There is no price: the server uses the product's real price.
export interface CreateSaleInput {
  items: { productId: number; quantity: number }[];
  discount: number;
  taxRatePercent: number;
  paymentMethod: PaymentMethod;
  amountTendered: number | null;
}

export interface SaleQueryParams {
  from?: string; // an exact moment (ISO), for example the start of the seller's "today"
  to?: string;
  payment?: "all" | PaymentMethod;
  status?: "all" | "completed" | "voided";
  page?: number;
  pageSize?: number;
}
