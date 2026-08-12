import type { Metadata } from "next";
import Link from "next/link";
import { signup } from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Sign Up — LEVR Auto",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-sm px-6">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white">Sign Up</h1>
        <p className="mt-3 text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 transition-colors hover:text-emerald-300">
            Log in
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

        <form action={signup} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              Full name <span className="text-zinc-500 normal-case">(optional)</span>
            </span>
            <input
              type="text"
              name="fullName"
              autoComplete="name"
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </label>
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
              minLength={6}
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
            <span className="mt-2 block text-xs text-zinc-500">At least 6 characters.</span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              How should we update you?
            </span>
            <select
              name="communicationChannel"
              defaultValue="email"
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            >
              <option value="email">Email</option>
              <option value="text">Text message</option>
              <option value="agent_callback">A personal agent will call me</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              How often?
            </span>
            <select
              name="communicationFrequency"
              defaultValue="real_time"
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-black/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            >
              <option value="real_time">As soon as it happens</option>
              <option value="daily_digest">Once-a-day digest</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              Phone number{" "}
              <span className="text-zinc-500 normal-case">
                (required for text or agent-callback updates)
              </span>
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
      </div>
    </section>
  );
}
