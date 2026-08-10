import type { Metadata } from "next";
import Link from "next/link";
import { login } from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Log In — LEVR Auto",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-sm px-6">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white">Log In</h1>
        <p className="mt-3 text-center text-sm text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-emerald-400 transition-colors hover:text-emerald-300">
            Sign up
          </Link>
        </p>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {message}
          </p>
        )}

        <form action={login} className="mt-8 space-y-4">
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
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Password</span>
              <Link
                href="/forgot-password"
                className="text-xs text-emerald-400 transition-colors hover:text-emerald-300"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            Log In
          </button>
        </form>
      </div>
    </section>
  );
}
