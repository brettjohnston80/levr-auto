import { formatDate } from "@/lib/dashboard-format";
import type { OfferMessage } from "@/lib/offer-messages-shared";

// Pure rendering, no hooks and no "use client": the /account/messages thread
// page renders it on the server, and the offer detail modal / agent views
// render it inside their own client trees. One component, so a message can't
// look different on the surfaces that show the same thread.
//
// `viewer` only changes how the OTHER side's label reads:
//  - customer: agent messages read "{first name} · LEVR agent", own are "You"
//  - agent:    customer messages read "Customer", agent ones show the name
export function OfferMessageList({
  messages,
  viewer,
}: {
  messages: OfferMessage[];
  viewer: "customer" | "agent";
}) {
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const mine = (viewer === "customer") === (m.authorType === "customer");
        const label =
          viewer === "customer" && m.authorType === "agent" ? `${m.authorLabel} · LEVR agent` : m.authorLabel;
        return (
          <li
            key={m.id}
            className={`rounded-xl border px-3 py-2 ${
              mine ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className={`font-semibold ${mine ? "text-emerald-300" : "text-zinc-200"}`}>{label}</span>
              <time dateTime={m.createdAt} className="text-zinc-500" suppressHydrationWarning>
                {formatDate(m.createdAt)}
              </time>
            </div>
            <p className="mt-1 text-sm break-words whitespace-pre-wrap text-zinc-200">{m.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
