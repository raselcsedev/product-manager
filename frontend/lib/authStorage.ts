import { AuthUser } from "@/types/auth";

const KEY = "auth";

export interface StoredAuth {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

// Returns the saved login, or null if there is none or it has expired.
export function loadAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw) as StoredAuth;
    if (new Date(auth.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return auth;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth) {
  localStorage.setItem(KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}
