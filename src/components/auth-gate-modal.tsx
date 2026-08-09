"use client";

import { useState } from "react";
import { loginInline, signupInline } from "@/lib/auth-actions";

type Mode = "login" | "signup";

export function AuthGateModal({
  open,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupComplete, setSignupComplete] = useState(false);

  if (!open) return null;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "login") {
      const result = await loginInline(email, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onAuthenticated();
    } else {
      const result = await signupInline(email, password, fullName || undefined);
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setSignupComplete(true);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 px-6 py-12 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {signupComplete ? (
          <div className="text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">
              ✓
            </span>
            <h2 className="mt-6 text-xl font-semibold text-white">Check your email</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              We sent a confirmation link to <span className="text-zinc-200">{email}</span>. Your
              search is saved — confirm your account and come back to this page to finish.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-8 rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Got it
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-center text-xl font-semibold text-white">
              {mode === "login" ? "Log in to continue" : "Create an account to continue"}
            </h2>
            <p className="mt-2 text-center text-sm text-zinc-400">
              Your search is saved — just need an account to keep it under.
            </p>

            <div className="mt-6 flex justify-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  mode === "login" ? "bg-emerald-500 text-zinc-950" : "text-zinc-400"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  mode === "signup" ? "bg-emerald-500 text-zinc-950" : "text-zinc-400"
                }`}
              >
                Sign Up
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <label className="block">
                  <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                    Full name <span className="text-zinc-500 normal-case">(optional)</span>
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </label>
              )}
              <label className="block">
                <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                  Password
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {loading ? "Please wait…" : mode === "login" ? "Log In" : "Sign Up"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
