import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/signup-form";

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

        <SignupForm />
      </div>
    </section>
  );
}
