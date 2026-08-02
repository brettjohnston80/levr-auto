import { GetStartedButton } from "@/components/get-started-button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(16,185,129,0.25),transparent_60%)]"
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center sm:py-36">
        <span className="mb-6 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium tracking-wide text-emerald-400 uppercase">
          Nationwide dealer negotiation, done for you
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          Car buying, with the leverage on your side.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-400 sm:text-xl">
          Tell us the exact car you want. We&apos;ll search every dealer in the country and
          negotiate your price — so you never have to haggle.
        </p>
        <GetStartedButton className="mt-10 inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400">
          Get Started
        </GetStartedButton>
      </div>
    </section>
  );
}
