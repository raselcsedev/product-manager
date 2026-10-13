"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loginUser, registerUser } from "@/lib/api";
import { clearAuth, loadAuth, saveAuth } from "@/lib/authStorage";
import { AuthResponse, AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean; // false until we have checked localStorage
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(loadAuth()?.user ?? null);
    setReady(true);

    // api.ts fires this event when the server answers 401.
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const startSession = (res: AuthResponse) => {
    saveAuth({ token: res.token, expiresAt: res.expiresAt, user: res.user });
    setUser(res.user);
  };

  const login = useCallback(async (email: string, password: string) => {
    startSession(await loginUser({ email, password }));
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    startSession(await registerUser({ name, email, password }));
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
