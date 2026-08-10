"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";

const COPY: Record<string, { heading: string; body: string; button: string }> = {
  recovery: {
    heading: "Reset Your Password",
    body: "Click below to continue resetting your password.",
    button: "Continue",
  },
  signup: {
    heading: "Confirm Your Email",
    body: "Click below to confirm your email and finish setting up your account.",
    button: "Confirm Email",
  },
};

const DEFAULT_COPY = {
  heading: "Confirm",
  body: "Click below to continue.",
  button: "Continue",
};

/**
 * Intermediate landing page for Supabase email links (signup confirmation,
 * password reset). Deliberately requires an explicit click before the token
 * is ever verified — the link in the email points here, not directly at
 * Supabase's own /auth/v1/verify endpoint, which consumes a token on the
 * first GET it receives. That made every link vulnerable to being silently
 * burned by any automated fetch: an inbox security scanner pre-checking the
 * URL, a link-preview generator, anything that follows a URL without a real
 * user behind it. This page just sits inert until a real person clicks the
 * button, which is the only thing that calls verifyOtp().
 */
export default function ConfirmPage() {
  const params = useMemo(
    () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null),
    []
  );
  const tokenHash = params?.get("token_hash") ?? null;
  const type = (params?.get("type") as EmailOtpType | null) ?? null;
  const next = params?.get("next") ?? null;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tokenHash || !type) {
    return (
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-sm px-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Link Invalid</h1>
          <p className="mt-3 text-sm text-zinc-400">
            This link is invalid or has expired — request a new one.
          </p>
        </div>
      </section>
    );
  }

  const copy = COPY[type] ?? DEFAULT_COPY;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

    if (error) {
      setSubmitting(false);
      setError("This link is invalid or has expired — request a new one.");
      return;
    }

    if (type === "recovery") {
      window.location.href = "/auth/reset-password";
    } else {
      window.location.href = next ?? "/account";
    }
  }

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-sm px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white">{copy.heading}</h1>
        <p className="mt-3 text-sm text-zinc-400">{copy.body}</p>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="mt-8 w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
        >
          {submitting ? "Confirming…" : copy.button}
        </button>
      </div>
    </section>
  );
}
