import { request } from "@/lib/api";
import { CreateSaleInput, Sale, SaleListItem, SaleQueryParams, SalesSummary } from "@/types/pos";
import { PagedResult } from "@/types/product";

export const createSale = (input: CreateSaleInput) =>
  request<Sale>("/api/sales", { method: "POST", body: JSON.stringify(input) });

function rangeQuery(params: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return qs;
}

export function getSales(params: SaleQueryParams) {
  const qs = rangeQuery(params);
  if (params.payment && params.payment !== "all") qs.set("payment", params.payment);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));

  return request<PagedResult<SaleListItem>>(`/api/sales?${qs.toString()}`);
}

export const getSalesSummary = (params: { from?: string; to?: string }) =>
  request<SalesSummary>(`/api/sales/summary?${rangeQuery(params).toString()}`);

export const getSale = (id: number) => request<Sale>(`/api/sales/${id}`);

export const voidSale = (id: number, reason: string) =>
  request<Sale>(`/api/sales/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) });
