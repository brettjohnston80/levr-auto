import { GetStartedButton } from "@/components/get-started-button";

export function CtaSection() {
  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Ready to put the leverage back in your hands?
        </h2>
        <GetStartedButton className="mt-8 inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400">
          Get Started
        </GetStartedButton>
      </div>
    </section>
  );
}
