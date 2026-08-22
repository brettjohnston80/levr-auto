"use client";

import { useState, type FormEvent } from "react";
import { signup } from "@/lib/auth-actions";

// Extracted from /signup so a client-side password-confirmation check can
// run before the native form submission -- the signup Server Action itself
// is untouched, still wired via action={signup}, still owns all of its
// existing server-side redirect/error handling.
export function SignupForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (password !== confirmPassword) {
      e.preventDefault();
      setMismatchError("Passwords don't match.");
      return;
    }
    setMismatchError(null);
  }

  return (
    <form action={signup} onSubmit={handleSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
        />
        <span className="mt-2 block text-xs text-zinc-500">At least 8 characters.</span>
      </label>
      <label className="block">
        <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Confirm password</span>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
        />
      </label>

      {mismatchError && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {mismatchError}
        </p>
      )}

      <label className="block">
        <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
          Phone number <span className="text-zinc-500 normal-case">(optional)</span>
        </span>
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
      >
        Sign Up
      </button>
    </form>
  );
}
