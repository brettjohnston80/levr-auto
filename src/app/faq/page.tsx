import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ — LEVR Auto",
  description: "Answers to common questions about how LEVR Auto works.",
};

const FAQS = [
  {
    q: "What exactly does LEVR Auto do?",
    a: "You tell us the exact car you want, and we search dealer inventory nationwide and negotiate on your behalf. You review the offers we bring back and decide what to do next — no obligation either way.",
  },
  {
    q: "How much does it cost?",
    a: "A flat $500 fee, paid once you're ready to move forward. That's it — no hidden charges, no commission tacked onto your deal.",
  },
  {
    q: "What if you can't get me a deal below MSRP?",
    a: "You get your full $500 back, automatically, at the end of your negotiation window. No need to ask for it.",
  },
  {
    q: "Am I required to buy a car?",
    a: "No. You can review every offer we bring you and decide not to move forward with any of them — the fee still covers the work we did on your behalf.",
  },
  {
    q: "How long does the process take?",
    a: "Your negotiation window is [30/60] days from when you get started. Offers can come in anytime during that window.",
  },
  {
    q: "Will I have to negotiate with a dealer myself?",
    a: "No — that's the whole point. We handle the back-and-forth so you don't have to.",
  },
  {
    q: "What happens after I accept an offer?",
    a: "We connect you directly with the dealer and help walk through the paperwork, so the process is as close to fully virtual as possible.",
  },
  {
    q: "Can I search for more than one car at a time?",
    a: "Yes. Searching one make and model is $500. Adding a second at the same time is $600 total, and a third is $700 — that's the max. Within whichever make/model you choose, you can still be flexible on trim, color, and options at no extra cost.",
  },
  {
    q: "What if I change my mind about the car I want?",
    a: "You can switch to a different make/model for a $100 fee, which restarts your negotiation window on the new vehicle.",
  },
  {
    q: "Is LEVR Auto available in my state?",
    a: "We're rolling out carefully, state by state, to make sure we do this right everywhere we operate.",
  },
  {
    q: "Do dealers know I'm working with LEVR Auto?",
    a: "Yes — we reach out to dealers transparently on your behalf to request their best price on your exact vehicle.",
  },
];

export default function FaqPage() {
  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <div className="mt-14 divide-y divide-white/10 border-t border-white/10">
          {FAQS.map((item) => (
            <div key={item.q} className="py-6">
              <h2 className="text-base font-semibold text-white">{item.q}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
