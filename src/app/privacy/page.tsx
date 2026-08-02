import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — LEVR Auto",
};

export default function PrivacyPage() {
  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-6 text-zinc-400">
          Final privacy language is pending attorney review and will be published here before
          launch.
        </p>
      </div>
    </section>
  );
}
