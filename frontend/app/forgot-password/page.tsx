"use client";

import { useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Enter the email address of your account.");
      return;
    }

    setSending(true);
    try {
      const result = await forgotPassword(email.trim());
      setDone(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Reset Password</h1>
        <p className="mt-1 text-sm text-slate-500">We will send a secure password reset link to your email.</p>
      </div>

      {done ? (
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <Alert type="success" message={done} />
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            The email can take a few minutes. Check your spam folder too. The link remains valid for one hour.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          {error && <Alert type="error" message={error} />}

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Account Email</label>
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

          <div className="pt-1">
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {sending ? "Sending reset link..." : "Send Reset Link"}
            </button>
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
            Remember your credentials?{" "}
            <Link href="/login" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
