import { ActivityQueryParams, AuditLog } from "@/types/activity";
import { PagedResult, Product, ProductInput, ProductQueryParams, ProductSummary } from "@/types/product";
import { PublicCategory, PublicProduct, PublicProductQueryParams } from "@/types/shop";
import { Category, CategoryInput } from "@/types/category";
import { DashboardCharts } from "@/types/dashboard";
import { AdminUser, AuthResponse, AuthUser, LoginInput, RegisterInput, Role } from "@/types/auth";
import { clearAuth, loadAuth } from "@/lib/authStorage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

// Full URL of an uploaded product image
export const imageUrl = (fileName: string) => `${API_URL}/uploads/products/${fileName}`;

// Turns an ASP.NET error response into a readable message.
async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    // Validation errors: { errors: { Price: ["Price must be greater than zero."] } }
    if (data?.errors) {
      return (Object.values(data.errors) as string[][]).flat().join(" ");
    }
    // Our custom errors: { message: "..." }
    if (data?.message) return data.message;
    if (data?.title) return data.title;
  } catch {
    // response had no JSON body
  }
  return `Request failed (${res.status}).`;
}

// Sends a request with the login token attached and handles the errors every call shares.
async function send(path: string, options?: RequestInit): Promise<Response> {
  // The public shop is for everybody, so those calls never carry a login token.
  const isPublicCall = path.startsWith("/api/public/");
  const auth = isPublicCall ? null : loadAuth();

  // For file uploads (FormData) the browser must set Content-Type itself, including the multipart boundary.
  const isForm = typeof FormData !== "undefined" && options?.body instanceof FormData;
  const headers: Record<string, string> = isForm ? {} : { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${auth.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...options, headers });
  } catch {
    throw new Error("Cannot reach the API. Make sure the backend is running.");
  }

  // 401 = token missing, invalid, expired, or the user no longer exists.
  // (A wrong password on the login/register forms is also a 401, but that is not a session problem.)
  const isCredentialCall = path === "/api/auth/login" || path === "/api/auth/register";
  if (res.status === 401 && !isCredentialCall) {
    clearAuth();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Your session has expired. Please log in again.");
  }

  // 403 = logged in, but not allowed to do this (for example, not an admin).
  if (res.status === 403) {
    throw new Error("You do not have permission to do this.");
  }

  if (res.status === 413) {
    throw new Error("The file is too large.");
  }

  // 429 = the public shop's request limit was reached
  if (res.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  return res;
}

// Normal JSON request
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await send(path, options);
  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Auth ----
export const loginUser = (input: LoginInput) =>
  request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(input) });

export const registerUser = (input: RegisterInput) =>
  request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });

// Current user data straight from the database (so role changes show up without logging in again)
export const getMe = () => request<AuthUser>("/api/auth/me");

// ---- Profile ----
export const updateProfile = (name: string) =>
  request<AuthUser>("/api/auth/profile", { method: "PUT", body: JSON.stringify({ name }) });

export const changePassword = (currentPassword: string, newPassword: string) =>
  request<void>("/api/auth/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

// ---- Admin: user management (Admin role only) ----
export const getAdminUsers = () => request<AdminUser[]>("/api/admin/users");

export const updateUserRole = (id: number, role: Role) =>
  request<void>(`/api/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) });

export const deleteAdminUser = (id: number) =>
  request<void>(`/api/admin/users/${id}`, { method: "DELETE" });

// ---- Activity history ----
export function getActivity(params: ActivityQueryParams) {
  const qs = new URLSearchParams();
  if (params.scope) qs.set("scope", params.scope);
  if (params.entityType && params.entityType !== "all") qs.set("entityType", params.entityType);
  if (params.action && params.action !== "all") qs.set("action", params.action);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));

  return request<PagedResult<AuditLog>>(`/api/activity?${qs.toString()}`);
}

// ---- Dashboard ----
export const getDashboardCharts = () => request<DashboardCharts>("/api/dashboard/charts");

// ---- Public shop (no login needed) ----
export function getPublicProducts(params: PublicProductQueryParams) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.category) qs.set("category", params.category);
  if (params.sort && params.sort !== "newest") qs.set("sort", params.sort);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));

  return request<PagedResult<PublicProduct>>(`/api/public/products?${qs.toString()}`);
}

export const getPublicCategories = () => request<PublicCategory[]>("/api/public/categories");

export const getPublicProduct = (id: number) => request<PublicProduct>(`/api/public/products/${id}`);

export const getRelatedProducts = (id: number, limit = 4) =>
  request<PublicProduct[]>(`/api/public/products/${id}/related?limit=${limit}`);

// ---- Categories ----
export const getCategories = () => request<Category[]>("/api/categories");

export const createCategory = (input: CategoryInput) =>
  request<Category>("/api/categories", { method: "POST", body: JSON.stringify(input) });

export const updateCategory = (id: number, input: CategoryInput) =>
  request<void>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(input) });

export const deleteCategory = (id: number) =>
  request<void>(`/api/categories/${id}`, { method: "DELETE" });

// ---- Products (all require login) ----

// Builds "search=mouse&page=2" from an object, skipping empty values.
function buildProductQuery(params: ProductQueryParams) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.categoryId !== undefined) qs.set("categoryId", String(params.categoryId));
  if (params.minPrice !== undefined) qs.set("minPrice", String(params.minPrice));
  if (params.maxPrice !== undefined) qs.set("maxPrice", String(params.maxPrice));
  if (params.stock && params.stock !== "all") qs.set("stock", params.stock);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortDir) qs.set("sortDir", params.sortDir);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return qs.toString();
}

export async function getProductsPage(params: ProductQueryParams) {
  const data = await request<PagedResult<Product>>(`/api/products?${buildProductQuery(params)}`);
  if (!data || !Array.isArray(data.items)) {
    throw new Error("Unexpected response from the API. Restart the backend so it runs the latest code.");
  }
  return data;
}

// Downloads the products that match the filters as a CSV file (all rows, not just one page).
// We use fetch (not a plain link) because the request must carry the login token.
export async function downloadProductsCsv(params: ProductQueryParams) {
  const res = await send(`/api/products/export?${buildProductQuery(params)}`);
  if (!res.ok) throw new Error(await readError(res));

  const blob = await res.blob();
  const truncated = res.headers.get("X-Export-Truncated") === "true";
  return { blob, truncated };
}

export const getProductSummary = () => request<ProductSummary>("/api/products/summary");

export const getProduct = (id: number) => request<Product>(`/api/products/${id}`);

export const createProduct = (input: ProductInput) =>
  request<Product>("/api/products", { method: "POST", body: JSON.stringify(input) });

export const updateProduct = (id: number, input: ProductInput) =>
  request<void>(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify({ id, ...input }),
  });

export const deleteProduct = (id: number) =>
  request<void>(`/api/products/${id}`, { method: "DELETE" });

// ---- Product images ----
export function uploadProductImage(id: number, file: File) {
  const form = new FormData();
  form.append("file", file); // the field name must be "file" (matches the C# parameter name)
  return request<{ imageFileName: string }>(`/api/products/${id}/image`, { method: "POST", body: form });
}

export const deleteProductImage = (id: number) =>
  request<void>(`/api/products/${id}/image`, { method: "DELETE" });
