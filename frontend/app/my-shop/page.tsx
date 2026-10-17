"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@/components/Alert";
import Spinner from "@/components/Spinner";
import { deleteMyShop, getMyShop, saveMyShop } from "@/lib/api";
import { SLUG_PATTERN, slugify } from "@/lib/slug";
import { MyShop } from "@/types/shop";

type Message = { type: "success" | "error"; text: string } | null;

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

export default function MyShopPage() {
  const [settings, setSettings] = useState<MyShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shopName, setShopName] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false); // once you type an address yourself, we stop suggesting one
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    let cancelled = false;
    getMyShop()
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setShopName(data.shopName ?? "");
        setShopSlug(data.shopSlug ?? "");
        setDescription(data.shopDescription ?? "");
        setSlugTouched(!!data.shopSlug);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load your shop settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleNameChange(value: string) {
    setShopName(value);
    // Suggest an address from the name, until the seller types their own
    if (!slugTouched) setShopSlug(slugify(value));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const name = shopName.trim();
    const slug = shopSlug.trim();

    if (name.length < 3 || name.length > 60) {
      setMessage({ type: "error", text: "Shop name must be between 3 and 60 characters." });
      return;
    }
    if (slug.length < 3 || slug.length > 40 || !SLUG_PATTERN.test(slug)) {
      setMessage({
        type: "error",
        text: "Shop address must be 3 to 40 characters: lowercase letters, numbers and single hyphens (for example: my-shop).",
      });
      return;
    }
    if (description.length > 300) {
      setMessage({ type: "error", text: "Description must be 300 characters or fewer." });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveMyShop({
        shopName: name,
        shopSlug: slug,
        shopDescription: description.trim() === "" ? null : description.trim(),
      });
      setSettings(saved);
      setShopName(saved.shopName ?? "");
      setShopSlug(saved.shopSlug ?? "");
      setMessage({ type: "success", text: "Your shop page is saved." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save your shop." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTurnOff() {
    if (!window.confirm("Turn off your shop page? Its address will stop working. Your products are not deleted.")) return;

    setMessage(null);
    setSaving(true);
    try {
      await deleteMyShop();
      setSettings({ shopName: null, shopSlug: null, shopDescription: null, publishedProductCount: settings?.publishedProductCount ?? 0 });
      setShopName("");
      setShopSlug("");
      setDescription("");
      setSlugTouched(false);
      setMessage({ type: "success", text: "Your shop page was turned off." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to turn off your shop." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading your shop..." />;

  const isLive = !!settings?.shopSlug;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-semibold">My shop</h1>

      {loadError && <Alert type="error" message={loadError} />}

      {/* Status */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        {isLive ? (
          <div className="space-y-2">
            <p className="font-medium">Your shop page is live</p>
            <p className="text-sm text-slate-600">
              Visitors can find it at{" "}
              <Link href={`/shops/${settings.shopSlug}`} className="font-medium text-blue-600 hover:underline">
                /shops/{settings.shopSlug}
              </Link>
            </p>
            <p className="text-sm text-slate-600">
              It shows your <span className="font-medium">{settings.publishedProductCount}</span> published product
              {settings.publishedProductCount === 1 ? "" : "s"}.
            </p>
            {settings.publishedProductCount === 0 && (
              <p className="text-sm text-amber-700">
                You have no published products yet, so the shop is not listed in the directory. Tick{" "}
                <span className="font-medium">Show on the public shop</span> when you edit a product.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="font-medium">You don&apos;t have a shop page yet</p>
            <p className="text-sm text-slate-600">
              A shop page gives you your own address and a place that lists all your published products. It&apos;s optional,
              and your account name and email are never shown.
            </p>
          </div>
        )}
      </section>

      {/* Settings form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-medium">{isLive ? "Shop settings" : "Open your shop page"}</h2>
        {message && <Alert type={message.type} message={message.text} />}

        <div>
          <label htmlFor="shopName" className="text-sm font-medium">Shop name *</label>
          <input
            id="shopName"
            className={inputClass}
            value={shopName}
            maxLength={60}
            onChange={(e) => handleNameChange(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">This is the name visitors see. It does not have to be your own name.</p>
        </div>

        <div>
          <label htmlFor="shopSlug" className="text-sm font-medium">Shop address *</label>
          <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600">
            <span className="select-none pl-3 text-sm text-slate-500">/shops/</span>
            <input
              id="shopSlug"
              className="w-full bg-transparent px-1 py-2 text-sm focus:outline-none"
              value={shopSlug}
              maxLength={40}
              onChange={(e) => {
                setSlugTouched(true);
                setShopSlug(e.target.value.toLowerCase());
              }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Lowercase letters, numbers and hyphens only. If your shop name uses another alphabet, type the address yourself.
          </p>
        </div>

        <div>
          <label htmlFor="shopDescription" className="text-sm font-medium">Description</label>
          <textarea
            id="shopDescription"
            rows={3}
            className={inputClass}
            value={description}
            maxLength={300}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">{description.length}/300</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : isLive ? "Save changes" : "Open my shop"}
          </button>
          {isLive && (
            <button
              type="button"
              onClick={handleTurnOff}
              disabled={saving}
              className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Turn off shop page
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
