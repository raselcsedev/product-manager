export interface StockStatusCounts {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  lowStockLimit: number;
}

export interface CategoryStat {
  name: string;
  productCount: number;
  units: number;
  value: number;
}

export interface DashboardCharts {
  stockStatus: StockStatusCounts;
  categories: CategoryStat[];
}
