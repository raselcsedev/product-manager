import { imageUrl } from "@/lib/api";

interface ProductThumbProps {
  fileName: string | null;
  name: string;
  // sm = 42px table thumbnail, lg = 128px form preview, fill = fills its container (cards, detail page)
  size?: "sm" | "lg" | "fill";
  className?: string;
}

// Shows the product image, or an elegant placeholder when there is none.
export default function ProductThumb({ fileName, name, size = "sm", className = "" }: ProductThumbProps) {
  const box =
    size === "lg"
      ? "h-32 w-32 rounded-xl"
      : size === "fill"
      ? "h-full w-full"
      : "h-11 w-11 rounded-lg";

  if (!fileName) {
    const iconSize = size === "fill" ? "h-10 w-10" : size === "lg" ? "h-8 w-8" : "h-5 w-5";
    return (
      <div
        className={`${box} flex shrink-0 items-center justify-center border border-slate-200/80 bg-gradient-to-br from-slate-100 to-slate-200/70 text-slate-400 dark:border-slate-800 dark:from-slate-800 dark:to-slate-900 ${className}`}
        aria-hidden="true"
      >
        <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(fileName)}
      alt={name}
      loading="lazy"
      className={`${box} shrink-0 border border-slate-200/60 object-cover dark:border-slate-800 ${className}`}
    />
  );
}
