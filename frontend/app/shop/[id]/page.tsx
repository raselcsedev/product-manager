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

// The <title>, description and share preview (WhatsApp, Facebook, X ...) of this product.
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

// A server component: the whole product is part of the HTML the server sends.
// The contact form at the bottom is a client component, because it needs to react to typing.
export default async function ShopProductPage({ params }: PageProps) {
  const id = parseId(params.id);
  if (!id) notFound();

  const product = await getPublicProductServer(id);
  if (!product) notFound(); // a real 404 status, which tells search engines to drop the page

  const related = await getRelatedServer(id);
  const image = absoluteImageUrl(product.imageFileName);

  // "Structured data": the same facts in a form search engines understand (rich results).
  // A price is only included when a currency is configured, because a price without one is not valid.
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
    <div className="mx-auto max-w-6xl space-y-6">
      {/* "<" is escaped so a product name containing "</script>" can never break out of this tag */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      <Link href="/shop" className="inline-block text-sm text-slate-600 hover:underline">
        &larr; Back to shop
      </Link>

      <div className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 md:grid-cols-2">
        <ProductThumb fileName={product.imageFileName} name={product.name} size="fill" />

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <p className="mt-2 text-2xl font-semibold">{money(product.price)}</p>
          </div>

          {/* Only shown when the seller has chosen to have a shop page */}
          {product.shopSlug && product.shopName && (
            <p className="text-sm text-slate-600">
              Sold by{" "}
              <Link href={`/shops/${product.shopSlug}`} className="font-medium text-blue-600 hover:underline">
                {product.shopName}
              </Link>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {product.category && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{product.category}</span>
            )}
            <AvailabilityBadge availability={product.availability} />
          </div>

          <div>
            <h2 className="text-sm font-medium">Description</h2>
            {product.description ? (
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{product.description}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">No description.</p>
            )}
          </div>

          {product.shopSlug && product.shopName && (
            <Link
              href={`/shops/${product.shopSlug}`}
              className="inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              More from {product.shopName}
            </Link>
          )}
        </div>
      </div>

      <InquiryForm productId={product.id} productName={product.name} />

      {related.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">You may also like</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <PublicProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
