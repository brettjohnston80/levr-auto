const ROWS = [
  {
    label: "Who talks to the dealer",
    usual: "You do — in person, on the phone, under pressure",
    levr: "We do — on your behalf, so you never have to",
  },
  {
    label: "Where you're shopping",
    usual: "Whatever's on the lot near you",
    levr: "Real, live inventory nationwide",
  },
  {
    label: "Who the dealer answers to",
    usual: "Their own sales incentives",
    levr: "Nothing — we never accept dealer compensation",
  },
  {
    label: "What it costs you",
    usual: "Markups and add-ons, often hidden in the numbers",
    levr: "One flat $699 fee, fully disclosed upfront",
  },
  {
    label: "If it doesn't work out",
    usual: "You walk away with nothing to show for your time",
    levr: "Your money back if we don't find an offer below Total SRP",
  },
  {
    label: "The pace",
    usual: "Same-day, same-lot pressure to decide",
    levr: "Review real offers on your own time — no one standing over your shoulder",
  },
];

export function ComparisonTable() {
  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          The usual way vs. the LEVR way
        </h2>

        {/* Desktop / tablet: three-column table */}
        <div className="mt-12 hidden overflow-hidden rounded-2xl border border-white/10 sm:block">
          <div className="grid grid-cols-[1.1fr_1fr_1fr]">
            <div className="bg-white/[0.03] px-6 py-4" />
            <div className="bg-white/[0.03] px-6 py-4 text-sm font-semibold text-zinc-400">
              The usual way
            </div>
            <div className="bg-emerald-500/10 px-6 py-4 text-sm font-semibold text-emerald-400">
              The LEVR way
            </div>
          </div>
          {ROWS.map((row) => (
            <div key={row.label} className="grid grid-cols-[1.1fr_1fr_1fr] border-t border-white/10">
              <div className="px-6 py-5 text-sm font-medium text-white">{row.label}</div>
              <div className="px-6 py-5 text-sm leading-relaxed text-zinc-400">{row.usual}</div>
              <div className="border-l border-emerald-500/20 bg-emerald-500/5 px-6 py-5 text-sm leading-relaxed text-zinc-200">
                {row.levr}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: stacked cards */}
        <div className="mt-10 space-y-4 sm:hidden">
          {ROWS.map((row) => (
            <div key={row.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{row.label}</p>
              <div className="mt-3 space-y-3">
                <div className="rounded-lg bg-white/[0.03] p-3">
                  <p className="text-[11px] font-semibold tracking-wide text-zinc-600 uppercase">
                    Usual way
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{row.usual}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-[11px] font-semibold tracking-wide text-emerald-400 uppercase">
                    The LEVR way
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-200">{row.levr}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
