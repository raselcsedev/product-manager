"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, loginUser, registerUser } from "@/lib/api";
import { clearAuth, loadAuth, saveAuth } from "@/lib/authStorage";
import { AuthResponse, AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  ready: boolean; // false until we have checked localStorage
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  updateUser: (user: AuthUser) => void; // after the profile changed on the server
  replaceSession: (res: AuthResponse) => void; // after a password change: carry on with the fresh token
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadAuth();
    setUser(stored?.user ?? null);
    setReady(true);

    // Ask the server for the latest user data (role, name). If the user was deleted or the
    // token is no longer valid, api.ts clears the session and fires "auth:expired".
    if (stored) {
      getMe()
        .then((me) => {
          const current = loadAuth();
          if (!current) return;
          saveAuth({ ...current, user: me });
          setUser(me);
        })
        .catch(() => {
          // 401 is handled inside api.ts. Network errors are ignored: we keep the saved user.
        });
    }

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

  const replaceSession = useCallback((res: AuthResponse) => {
    startSession(res);
  }, []);

  const updateUser = useCallback((next: AuthUser) => {
    const current = loadAuth();
    if (current) saveAuth({ ...current, user: next });
    setUser(next);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAdmin: user?.role === "Admin", ready, login, register, updateUser, replaceSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
