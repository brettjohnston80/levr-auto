const STEPS = [
  {
    number: "01",
    title: "Tell us exactly what you want",
    body: "Make, model, trim, color, options. You decide the car; we do the rest.",
  },
  {
    number: "02",
    title: "We search nationwide",
    body: "We reach out to dealers with matching inventory on your behalf.",
  },
  {
    number: "03",
    title: "Real offers land in your account",
    body: "As they come in — no waiting around, no sales calls to you.",
  },
  {
    number: "04",
    title: "You pick the one you like — or none at all",
    body: "Either way, you're covered by our guarantee.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          How It Works
        </h2>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <span className="text-sm font-semibold text-emerald-400">{step.number}</span>
              <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
