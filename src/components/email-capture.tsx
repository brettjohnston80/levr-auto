"use client";

import { useState, type FormEvent } from "react";
import { captureEmailSignup } from "@/lib/email-signup-actions";

// Low-commitment alternative to Get Started (website audit item 12) --
// deliberately muted styling, no emerald CTA-button treatment, so it
// doesn't compete with the primary "Get Started" CTA above it.
export function EmailCapture() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await captureEmailSignup(email);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  }

  return (
    <section className="bg-zinc-950 pb-20">
      <div className="mx-auto max-w-md px-6 text-center">
        <p className="text-sm text-zinc-500">Not ready yet? Leave your email and we&apos;ll keep you posted.</p>

        {done ? (
          <p className="mt-4 text-sm text-zinc-400">Thanks — we&apos;ll be in touch.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full flex-1 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Notify me"}
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </section>
  );
}
