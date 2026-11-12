"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Alert from "@/components/Alert";
import { useAuth } from "@/context/AuthContext";

type FormErrors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

export default function RegisterPage() {
  const router = useRouter();
  const { user, ready, register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/");
  }, [ready, user, router]);

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!name.trim()) e.name = "Name is required.";
    else if (name.trim().length > 100) e.name = "Name must be 100 characters or fewer.";

    if (!email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email address.";

    if (!password) e.password = "Password is required.";
    else if (password.length < 8 || password.length > 72)
      e.password = "Password must be between 8 and 72 characters.";

    if (password !== confirm) e.confirm = "Passwords do not match.";

    return e;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Registration failed.");
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
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Create an account</h1>
        <p className="mt-1 text-sm text-slate-500">Get started with your product catalog and POS store.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {submitError && <Alert type="error" message={submitError} />}

        <div>
          <label htmlFor="name" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Full Name</label>
          <input id="name" autoComplete="name" placeholder="John Doe" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          {errors.name && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.name}</p>}
        </div>

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
          {errors.email && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.email}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirm" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Confirm</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.confirm}</p>}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {submitting ? "Creating account..." : "Complete Registration"}
          </button>
        </div>
      </form>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
          Sign in
        </Link>
      </p>
    </div>
  );
}
