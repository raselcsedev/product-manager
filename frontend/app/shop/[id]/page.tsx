import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductThumb from "@/components/ProductThumb";
import AvailabilityBadge from "@/components/shop/AvailabilityBadge";
import InquiryForm from "@/components/shop/InquiryForm";
import PublicProductCard from "@/components/shop/PublicProductCard";
import { money } from "@/lib/format";
import { getPublicProductServer, getRelatedServer } from "@/lib/serverApi";
import { CURRENCY, SITE_NAME, SITE_URL, absoluteImageUrl, truncate } from "@/lib/site";
import { Availability } from "@/types/shop";

interface PageProps {
  params: { id: string };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const schemaAvailability: Record<Availability, string> = {
  "In stock": "https://schema.org/InStock",
  "Low stock": "https://schema.org/LimitedAvailability",
  "Out of stock": "https://schema.org/OutOfStock",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = parseId(params.id);
  const product = id ? await getPublicProductServer(id) : null;

  if (!product) return { title: "Product not available", robots: { index: false } };

  const description = truncate(product.description ?? `${product.name} for ${money(product.price)}`, 160);
  const image = absoluteImageUrl(product.imageFileName);

  return {
    title: product.name,
    description,
    alternates: { canonical: `/shop/${product.id}` },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: product.name,
      description,
      url: `/shop/${product.id}`,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ShopProductPage({ params }: PageProps) {
  const id = parseId(params.id);
  if (!id) notFound();

  const product = await getPublicProductServer(id);
  if (!product) notFound();

  const related = await getRelatedServer(id);
  const image = absoluteImageUrl(product.imageFileName);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: image ? [image] : undefined,
    category: product.category ?? undefined,
    brand: product.shopName ? { "@type": "Brand", name: product.shopName } : undefined,
    offers: CURRENCY
      ? {
          "@type": "Offer",
          url: `${SITE_URL}/shop/${product.id}`,
          price: product.price.toFixed(2),
          priceCurrency: CURRENCY,
          availability: schemaAvailability[product.availability],
        }
      : undefined,
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to marketplace
      </Link>

      <div className="grid gap-8 rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-xs md:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 aspect-square dark:border-slate-800 dark:bg-slate-800">
          <ProductThumb fileName={product.imageFileName} name={product.name} size="fill" className="h-full w-full object-cover" />
        </div>

        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {product.category && (
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {product.category}
                  </span>
                )}
                <AvailabilityBadge availability={product.availability} />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {product.name}
              </h1>
              <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {money(product.price)}
              </p>
            </div>

            {product.shopSlug && product.shopName && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sold and shipped by{" "}
                <Link href={`/shops/${product.shopSlug}`} className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
                  {product.shopName}
                </Link>
              </p>
            )}

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Product Description</h2>
              {product.description ? (
                <p className="whitespace-pre-line text-sm text-slate-600 leading-relaxed dark:text-slate-300">
                  {product.description}
                </p>
              ) : (
                <p className="text-xs text-slate-400">No detailed description provided for this product.</p>
              )}
            </div>
          </div>

          {product.shopSlug && product.shopName && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <Link
                href={`/shops/${product.shopSlug}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
              >
                Visit Storefront ({product.shopName}) →
              </Link>
            </div>
          )}
        </div>
      </div>

      <InquiryForm productId={product.id} productName={product.name} />

      {related.length > 0 && (
        <section className="space-y-4 pt-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Related Products</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <PublicProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
