// A small "Public" badge for products that are visible on the public shop.
export default function PublicPill() {
  return (
    <span
      title="Visible on the public shop"
      className="inline-flex items-center gap-1 rounded-full border border-blue-200/90 bg-blue-50/90 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
    >
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
      Public
    </span>
  );
}
