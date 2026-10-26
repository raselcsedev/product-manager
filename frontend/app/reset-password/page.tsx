"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import { resetPassword } from "@/lib/api";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // The secret is in the part of the address after "#" (it is never sent to any server).
  // We read it, and then remove it from the address bar and the browser history.
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
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Password changed</h1>
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <Alert type="success" message="Your password was changed. You were logged out everywhere. Log in with the new password." />
          <Link
            href="/login"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <Alert type="error" message="This link is incomplete or has already been used." />
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        {error && <Alert type="error" message={error} />}

        <div>
          <label htmlFor="password" className="text-sm font-medium">New password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">8 to 72 characters.</p>
        </div>

        <div>
          <label htmlFor="confirm" className="text-sm font-medium">Confirm new password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Change password"}
        </button>

        {error?.includes("not valid any more") && (
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="text-blue-600 hover:underline">
              Request a new link
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
