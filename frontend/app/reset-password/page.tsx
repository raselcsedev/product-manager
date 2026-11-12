"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import { resetPassword } from "@/lib/api";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const found = params.get("token");
    if (found) {
      setToken(found);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setChecked(true);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8 || password.length > 72) {
      setError("Your new password must be between 8 and 72 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (!token) return;

    setSaving(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The password could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  if (!checked) return null;

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Password Updated</h1>
          <p className="mt-1 text-sm text-slate-500">Your account credentials have been securely updated.</p>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <Alert type="success" message="Your password has been changed. All previous sessions have been ended. You can now log in with your new password." />
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 transition-all"
          >
            Continue to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Reset Link Expired</h1>
          <p className="mt-1 text-sm text-slate-500">This password reset link is invalid or has already been used.</p>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900 text-center">
          <Alert type="error" message="Please request a new reset link to proceed." />
          <div className="pt-2">
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Request a new password link →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Choose New Password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter a secure new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {error && <Alert type="error" message={error} />}

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">New Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-400">8 to 72 characters.</p>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Confirm New Password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className={inputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {saving ? "Saving new password..." : "Reset Password"}
          </button>
        </div>

        {error?.includes("not valid any more") && (
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
            <Link href="/forgot-password" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
              Request a new password reset link
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
