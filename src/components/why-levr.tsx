const REASONS = [
  {
    title: "Nationwide reach",
    body: "Not just the dealers near you. If a better deal exists three states away, we'll find it.",
  },
  {
    title: "One flat fee, refundable if we don't deliver.",
    body: "You know the cost upfront — no surprises.",
  },
  {
    title: "No dealership pressure.",
    body: "No sales floor, no waiting around, no tactics.",
    bold: "We never accept compensation from dealers — our only revenue is the flat fee you pay us.",
  },
  {
    title: "You decide.",
    body: "We do the legwork; the choice is always yours.",
  },
];

export function WhyLevr() {
  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Why LEVR Auto
        </h2>
        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <div key={reason.title} className="flex gap-4">
              <span className="mt-1 h-2 w-2 flex-none rounded-full bg-emerald-500" />
              <div>
                <h3 className="text-lg font-semibold text-white">{reason.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{reason.body}</p>
                {reason.bold && (
                  <p className="mt-1 text-sm leading-relaxed font-semibold text-zinc-300">{reason.bold}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
