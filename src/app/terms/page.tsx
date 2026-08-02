import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — LEVR Auto",
};

export default function TermsPage() {
  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Terms of Service</h1>
        <p className="mt-6 text-zinc-400">
          Final terms are pending attorney review and will be published here before launch.
        </p>
      </div>
    </section>
  );
}
