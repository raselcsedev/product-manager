// Must match StockLevels.LowStockLimit on the server (backend/Models/ProductQuery.cs).
export const LOW_STOCK_LIMIT = 10;

export type StockKey = "in" | "low" | "out";

export function getStockStatus(quantity: number): { key: StockKey; label: string } {
  if (quantity <= 0) return { key: "out", label: "Out of stock" };
  if (quantity < LOW_STOCK_LIMIT) return { key: "low", label: `Low stock (${quantity} left)` };
  return { key: "in", label: "In stock" };
}
