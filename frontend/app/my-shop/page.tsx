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
  "mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

export default function MyShopPage() {
  const [settings, setSettings] = useState<MyShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shopName, setShopName] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
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
        text: "Shop address must be 3 to 40 characters: lowercase letters, numbers and single hyphens (e.g. my-brand).",
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
      setMessage({ type: "success", text: "Your public storefront settings have been saved." });
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

  if (loading) return <Spinner label="Loading your shop configuration..." />;

  const isLive = !!settings?.shopSlug;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Storefront Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Configure your public seller page and storefront profile.</p>
      </div>

      {loadError && <Alert type="error" message={loadError} />}

      {/* 2-Column Responsive Layout */}
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left Column: Live Status & Preview */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className={`h-2.5 w-2.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                {isLive ? "Storefront is Live" : "Storefront Inactive"}
              </h2>
            </div>

            {isLive ? (
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Public URL</span>
                  <div className="mt-1">
                    <Link
                      href={`/shops/${settings.shopSlug}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400 break-all"
                    >
                      /shops/{settings.shopSlug}
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Published Products</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{settings.publishedProductCount}</span>
                  </div>
                </div>

                {settings.publishedProductCount === 0 && (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 leading-relaxed">
                    You have no published products yet. Turn on <span className="font-semibold">&ldquo;Show on public shop&rdquo;</span> when adding or editing products to make them visible here.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <p>
                  Opening a storefront gives you a dedicated public URL where customers can browse your published products and send you inquiries.
                </p>
                <p>
                  Your email and login credentials will remain completely private.
                </p>
              </div>
            )}
          </section>

          {/* Quick tips */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/30">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Branding Tip</h3>
            <p className="leading-relaxed">
              Choose an address slug that reflects your brand. You can share this URL directly with your customers or on social media.
            </p>
          </div>
        </div>

        {/* Right Column: Settings Form */}
        <div>
          <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isLive ? "Storefront Profile Details" : "Launch Your Storefront"}
              </h2>
              <p className="text-xs text-slate-500">Provide details for your public storefront listing.</p>
            </div>

            {message && <Alert type={message.type} message={message.text} />}

            <div>
              <label htmlFor="shopName" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Store Name *
              </label>
              <input
                id="shopName"
                placeholder="e.g. Acme Tech Studio"
                className={inputClass}
                value={shopName}
                maxLength={60}
                onChange={(e) => handleNameChange(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-slate-400">The public name displayed at the top of your shop directory.</p>
            </div>

            <div>
              <label htmlFor="shopSlug" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Custom Address Slug *
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                <span className="select-none text-xs font-semibold text-slate-400 mr-1">/shops/</span>
                <input
                  id="shopSlug"
                  placeholder="acme-tech"
                  className="w-full bg-transparent text-sm focus:outline-none"
                  value={shopSlug}
                  maxLength={40}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setShopSlug(e.target.value.toLowerCase());
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Lowercase letters, numbers and single hyphens only.
              </p>
            </div>

            <div>
              <label htmlFor="shopDescription" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Store Bio & Description
              </label>
              <textarea
                id="shopDescription"
                rows={4}
                placeholder="Briefly describe what you offer, shipping policies, or store background..."
                className={inputClass}
                value={description}
                maxLength={300}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="mt-1.5 flex justify-end">
                <span className="text-[11px] text-slate-400">{description.length}/300 characters</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {saving ? "Saving..." : isLive ? "Save Storefront Changes" : "Publish & Open Store"}
              </button>
              {isLive && (
                <button
                  type="button"
                  onClick={handleTurnOff}
                  disabled={saving}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-60"
                >
                  Unpublish Storefront
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
