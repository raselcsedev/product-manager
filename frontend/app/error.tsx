"use client";

// Shown when something goes wrong while a page is being built, for example when the API is not running.
// It does NOT show the technical message: that could reveal details about the server.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-slate-600">The page could not be loaded right now. Please try again in a moment.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
