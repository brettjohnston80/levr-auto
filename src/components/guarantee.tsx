const TIMELINE = [
  {
    day: "Day 0",
    title: "You tell us the car",
    body: "Make, model, trim, color — we get to work right away.",
  },
  {
    day: "Day 30",
    title: "Offer guaranteed",
    body: "At least one real offer below MSRP, or your $699 back.",
  },
  {
    day: "Day 60",
    title: "Still deciding? Still free.",
    body: "Your search stays open at no extra cost while you choose.",
  },
];

export function Guarantee() {
  return (
    <section className="bg-emerald-500 py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          We guarantee it. Literally.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-zinc-900/80">
          If we can&apos;t bring you at least one real offer below MSRP — the full sticker
          price, before tax, title, and fees — within 30 days, you get your $699 back. No
          questions asked. And you&apos;re never obligated to buy anything, even if we do find
          you a great deal.
        </p>

        <div className="relative mt-14">
          <div className="absolute top-[9px] right-[16.67%] left-[16.67%] h-1 rounded-full bg-zinc-950/15" />
          <div
            className="absolute top-[9px] left-[16.67%] h-1 rounded-full bg-zinc-950"
            style={{ width: "33.33%" }}
          />
          <div className="relative grid grid-cols-3 gap-2">
            {TIMELINE.map((step) => (
              <div key={step.day} className="flex flex-col items-center">
                <span className="h-4 w-4 rounded-full bg-zinc-950 ring-4 ring-emerald-500" />
                <span className="mt-3 text-sm font-bold text-zinc-950">{step.day}</span>
                <span className="mt-0.5 text-sm font-semibold text-zinc-900">{step.title}</span>
                <span className="mt-1 max-w-[10rem] text-xs leading-relaxed text-zinc-900/70">
                  {step.body}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
