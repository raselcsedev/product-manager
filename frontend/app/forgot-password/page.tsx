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
    "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>

      {done ? (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <Alert type="success" message={done} />
          <p className="text-sm text-slate-600">
            The email can take a few minutes. Check your spam folder too. The link works for one hour.
          </p>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            Enter your email address and we will send you a link to choose a new password.
          </p>
          {error && <Alert type="error" message={error} />}

          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send reset link"}
          </button>

          <p className="text-center text-sm">
            <Link href="/login" className="text-blue-600 hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
