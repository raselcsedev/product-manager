"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Alert from "@/components/Alert";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/");
  }, [ready, user, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to your Product Manager account.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {error && <Alert type="error" message={error} />}

        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Email Address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@domain.com"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in to Dashboard"}
        </button>
      </form>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Don&apos;t have an account yet?{" "}
        <Link href="/register" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
          Create account
        </Link>
      </p>
    </div>
  );
}
