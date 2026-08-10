"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updatePasswordFromRecovery } from "@/lib/auth-actions";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Preferred path: /auth/confirm already established a real session
    // (via an explicit user click, not an auto-fetched link) before
    // redirecting here — just use it.
    //
    // Fallback path: a direct Supabase recovery link (implicit flow —
    // access_token/refresh_token in the URL hash fragment, client-only,
    // never reaches the server) landed here directly. Kept working for
    // backwards compatibility and for generating quick test links without
    // going through the email template.
    //
    // All setState calls are deferred into a microtask so React doesn't see
    // a synchronous setState-in-effect.
    Promise.resolve().then(async () => {
      const supabase = createClient();

      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();

      if (existingUser) {
        setReady(true);
        return;
      }

      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (!accessToken || !refreshToken || type !== "recovery") {
        setLinkError("This reset link is invalid or has expired — request a new one.");
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setLinkError("This reset link is invalid or has expired — request a new one.");
        return;
      }

      // Scrub the tokens out of the visible URL now that the session is set.
      window.history.replaceState(null, "", window.location.pathname);
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("password", password);

    const result = await updatePasswordFromRecovery(formData);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong — try requesting a new reset link.");
      return;
    }

    router.push(`/login?message=${encodeURIComponent("Password updated — log in with your new password.")}`);
  }

  if (linkError) {
    return (
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-sm px-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Reset Link Invalid</h1>
          <p className="mt-3 text-sm text-zinc-400">{linkError}</p>
        </div>
      </section>
    );
  }

  if (!ready) {
    return (
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-sm px-6 text-center text-sm text-zinc-400">Verifying your reset link…</div>
      </section>
    );
  }

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-sm px-6">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white">Set a New Password</h1>
        <p className="mt-3 text-center text-sm text-zinc-400">
          Choose a new password for your account.
        </p>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">New password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
            <span className="mt-2 block text-xs text-zinc-500">At least 8 characters.</span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              Confirm new password
            </span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Set New Password"}
          </button>
        </form>
      </div>
    </section>
  );
}
