"use client";

import { useState } from "react";
import Alert from "@/components/Alert";
import { sendInquiry } from "@/lib/api";

// Same rule as the server: it also rejects characters like ? & = and spaces.
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const LINK_PATTERN = /https?:\/\/|www\./gi;

type FormErrors = Partial<Record<"name" | "email" | "message", string>>;

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

// "Ask the seller a question". It is on every public product page, and needs no account.
export default function InquiryForm({ productId, productName }: { productId: number; productName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState(""); // hidden from people; only bots fill it in

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function validate(): FormErrors {
    const e: FormErrors = {};
    const n = name.trim();
    const m = message.trim();

    if (n.length < 2) e.name = "Please enter your name (at least 2 characters).";
    else if (n.length > 100) e.name = "Your name must be 100 characters or fewer.";

    if (!EMAIL_PATTERN.test(email.trim())) e.email = "Enter a valid email address.";

    if (m.length < 10) e.message = "Your message must be at least 10 characters.";
    else if (m.length > 2000) e.message = "Your message must be 2000 characters or fewer.";
    else if ((m.match(LINK_PATTERN) ?? []).length > 2) e.message = "Please remove the links from your message.";

    return e;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSending(true);
    try {
      await sendInquiry(productId, {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        companyWebsite: honeypot,
      });
      setSent(true);
      setMessage("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Your message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
        <Alert type="success" message="Your message was sent. The seller can reply to your email address." />
        <button type="button" onClick={() => setSent(false)} className="text-sm text-blue-600 hover:underline">
          Send another message
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Ask the seller a question</h2>
      <p className="mt-1 text-sm text-slate-500">About: {productName}</p>

      <form onSubmit={handleSubmit} noValidate className="relative mt-4 space-y-4">
        {submitError && <Alert type="error" message={submitError} />}

        {/* The honeypot: moved far off-screen, skipped by the keyboard, ignored by screen readers.
            People never see it, bots that fill in every field do. */}
        <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
          <label htmlFor="companyWebsite">Company website (leave this empty)</label>
          <input
            id="companyWebsite"
            name="companyWebsite"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="inquiryName" className="text-sm font-medium">Your name *</label>
            <input
              id="inquiryName"
              autoComplete="name"
              className={inputClass}
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="inquiryEmail" className="text-sm font-medium">Your email *</label>
            <input
              id="inquiryEmail"
              type="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              maxLength={255}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="inquiryMessage" className="text-sm font-medium">Message *</label>
          <textarea
            id="inquiryMessage"
            rows={4}
            className={inputClass}
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-1 flex items-start justify-between gap-3">
            {errors.message ? <p className="text-sm text-red-600">{errors.message}</p> : <span />}
            <span className="shrink-0 text-xs text-slate-500">{message.length}/2000</span>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Your name and email are shared with the seller, only so they can reply. They are not shown publicly.
        </p>

        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send message"}
        </button>
      </form>
    </section>
  );
}
