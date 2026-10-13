import { Product, ProductInput } from "@/types/product";
import { AuthResponse, LoginInput, RegisterInput } from "@/types/auth";
import { clearAuth, loadAuth } from "@/lib/authStorage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080";

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const auth = loadAuth();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${auth.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...options, headers });
  } catch {
    throw new Error("Cannot reach the API. Make sure the backend is running.");
  }

  // A 401 on a normal endpoint means the token is missing, invalid or expired.
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    clearAuth();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Auth ----
export const loginUser = (input: LoginInput) =>
  request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(input) });

export const registerUser = (input: RegisterInput) =>
  request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });

// ---- Products (all require login) ----
export const getProducts = () => request<Product[]>("/api/products");

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
