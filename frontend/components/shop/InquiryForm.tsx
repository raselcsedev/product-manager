"use client";

import { useState } from "react";
import Alert from "@/components/Alert";
import { sendInquiry } from "@/lib/api";

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const LINK_PATTERN = /https?:\/\/|www\./gi;

type FormErrors = Partial<Record<"name" | "email" | "message", string>>;

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

export default function InquiryForm({ productId, productName }: { productId: number; productName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");

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
      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <Alert type="success" message="Your message was sent successfully. The seller will reply to your email address." />
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Send another message →
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ask the Seller a Question</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Inquiry about: <span className="font-semibold text-slate-700 dark:text-slate-300">{productName}</span></p>

      <form onSubmit={handleSubmit} noValidate className="relative mt-5 space-y-4">
        {submitError && <Alert type="error" message={submitError} />}

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
            <label htmlFor="inquiryName" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Your name *</label>
            <input
              id="inquiryName"
              autoComplete="name"
              className={inputClass}
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="inquiryEmail" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Your email *</label>
            <input
              id="inquiryEmail"
              type="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              maxLength={255}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.email}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="inquiryMessage" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Message *</label>
          <textarea
            id="inquiryMessage"
            rows={4}
            className={inputClass}
            value={message}
            maxLength={2000}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-1 flex items-start justify-between gap-3">
            {errors.message ? <p className="text-xs text-rose-600 dark:text-rose-400">{errors.message}</p> : <span />}
            <span className="shrink-0 text-xs text-slate-400">{message.length}/2000</span>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Your contact info is shared only with the verified seller for the purpose of answering this inquiry.
        </p>

        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send Message"}
        </button>
      </form>
    </section>
  );
}
