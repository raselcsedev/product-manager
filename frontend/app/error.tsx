"use client";

// Shown when something goes wrong while a page is being built, for example when the API is not running.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Something went wrong</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">The page could not be loaded right now. Please try again in a moment.</p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 transition-all"
      >
        Try again
      </button>
    </div>
  );
}
