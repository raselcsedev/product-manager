import { imageUrl } from "@/lib/api";

interface ProductThumbProps {
  fileName: string | null;
  name: string;
  // sm = 40px table thumbnail, lg = 128px form preview, fill = square that fills its container (cards, detail page)
  size?: "sm" | "lg" | "fill";
}

// Shows the product image, or a gray placeholder when there is none.
export default function ProductThumb({ fileName, name, size = "sm" }: ProductThumbProps) {
  const box = size === "lg" ? "h-32 w-32" : size === "fill" ? "aspect-square w-full" : "h-10 w-10";

  if (!fileName) {
    const iconWidth = size === "fill" ? "w-1/4" : "w-1/2";
    return (
      <div className={`${box} flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-400`}>
        <svg className={`${iconWidth} h-auto`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 16l4-4 4 4 4-6 4 6M4 4h16v16H4z" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(fileName)}
      alt={name}
      className={`${box} shrink-0 rounded-md border border-slate-200 object-cover`}
    />
  );
}
