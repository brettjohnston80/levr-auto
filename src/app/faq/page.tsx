import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "FAQ — LEVR Auto",
  description: "Answers to common questions about how LEVR Auto works.",
};

type FaqItem = {
  q: string;
  a: string;
  extra?: ReactNode;
};

const FAQS: FaqItem[] = [
  {
    q: "What exactly does LEVR Auto do?",
    a: "You tell us the exact new vehicle you want, and we reach out to dealers nationwide on your behalf — negotiating every offer. You review what we bring you and decide what to do next, no obligation either way.",
  },
  {
    q: "Do you search for used or pre-owned vehicles?",
    a: "Not yet. Right now LEVR Auto only searches and negotiates new vehicles — used and pre-owned inventory isn't part of the service today.",
  },
  {
    q: "How much does it cost?",
    a: "A flat $699 fee, paid once you're ready to move forward. That's it — no hidden charges, no commission tacked onto your deal.",
  },
  {
    q: "Who pays for delivery, tax, and other fees?",
    a: "You do. Delivery, tax, title, and any dealer fees are part of the vehicle purchase and are paid directly by you, just like any car purchase. LEVR's only charge is our flat upfront service fee — we don't pay any fees ourselves anywhere in the process, and we don't take a commission or markup on your deal.",
  },
  {
    q: 'What do you mean by "Total Suggested Retail Price"?',
    a: 'Total Suggested Retail Price (Total SRP) is the full manufacturer-suggested price for your exact vehicle — the base price, plus any factory-installed options, plus the manufacturer\'s destination/delivery charge, all added together. This is the same "Total" figure printed on your vehicle\'s official window sticker, sometimes shown as a separate line from the base "Manufacturer\'s Suggested Retail Price." It doesn\'t include sales tax, title and registration fees, dealer documentation fees, or anything a dealer adds on their own. Our guarantee always compares a dealer\'s offer against this full number — so you\'re never left guessing which figure on the sticker actually counts.',
  },
  {
    q: "What if you can't get me a deal below Total SRP?",
    a: "You get your full $699 back, automatically, at the end of your 30-day guarantee window. No need to ask for it.",
  },
  {
    q: "Why not just use a cheaper subscription tool instead?",
    a: "Some tools can send messages to dealers for a few dollars a month — but sending a message isn't the same as getting you a result. LEVR Auto is done for you, start to finish: a real negotiation, real offers landing in your account, and a real person you can reach if something needs attention. And unlike a subscription, we put our fee on the line — if we can't bring you at least one real offer below Total SRP, you get your $699 back.",
  },
  {
    q: "Am I required to buy a car?",
    a: "No. You can review every offer we bring you and decide not to move forward with any of them — the fee still covers the work we did on your behalf.",
  },
  {
    q: "How long does the process take?",
    a: "You're guaranteed at least one real offer below Total SRP within 30 days. If you need more time to decide, your search stays open at no extra cost through day 60.",
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
    q: "Do I have to talk to anyone on the phone?",
    a: "Not if you don't want to. The entire process — telling us what you want, reviewing offers, accepting a deal — can be completed online from start to finish.",
  },
  {
    q: "Can I search for more than one car at a time?",
    a: "No — LEVR searches one make and model per engagement, for the flat $699 fee. Within that make/model, you can still be flexible on trim, color, and options at no extra cost. Want a different vehicle instead? Your agent can switch your search (see below).",
  },
  {
    q: "What if I change my mind about the car I want?",
    a: "You can switch to a different make/model for a $100 fee, which restarts your 30-day guarantee window on the new vehicle.",
  },
  {
    q: "Is LEVR Auto available in my state?",
    a: "We're rolling out carefully, state by state, to make sure we do this right everywhere we operate.",
  },
  {
    q: "Do dealers know I'm working with LEVR Auto?",
    a: "Yes — we reach out to dealers transparently on your behalf to request their best price on your exact vehicle.",
  },
  {
    q: "How do you make money — are you paid by dealers?",
    a: "No. We never accept compensation from dealers, ever. Our only revenue is the flat $699 fee you pay us — that's what lets us negotiate purely in your interest.",
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
              {item.extra}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
