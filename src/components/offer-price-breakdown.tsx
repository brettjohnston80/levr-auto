import { breakdownRows, removableAddonNotes, DELIVERY_NOTE, type BreakdownInput } from "@/lib/offer-breakdown";

/**
 * "How the price adds up" (plan 4.C): a vertical step chart in plain HTML/CSS, bars scaled to
 * the sticker, the discount in green. Used by the agent's Log Offer preview now and by the
 * customer's offer detail in Chunk 9, so both show the same thing.
 */
export function OfferPriceBreakdown({ input, tone = "dark" }: { input: BreakdownInput; tone?: "dark" | "light" }) {
  const rows = breakdownRows(input);
  const notes = removableAddonNotes(input);
  const money = (c: number) => `$${(Math.abs(c) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const text = tone === "dark" ? "text-zinc-200" : "text-zinc-800";
  const muted = tone === "dark" ? "text-zinc-400" : "text-zinc-500";
  const track = tone === "dark" ? "bg-white/5" : "bg-zinc-100";
  return (
    <div>
      <h3 className={`text-sm font-semibold ${text}`}>How the price adds up</h3>
      <ol className="mt-3 space-y-2">
        {rows.map((r) => {
          const isTotal = r.kind === "otd" || r.kind === "otd_with_delivery" || r.kind === "price";
          const sign = r.kind === "discount" ? "−" : ["sticker", "price", "otd", "otd_with_delivery"].includes(r.kind) ? "" : "+";
          const barColor =
            r.kind === "discount" ? "bg-emerald-500" : r.kind === "otd" || r.kind === "otd_with_delivery" ? "bg-sky-500" : isTotal ? "bg-zinc-400" : "bg-zinc-500/70";
          return (
            <li key={r.kind} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className={isTotal ? `font-semibold ${text}` : muted}>{r.label}</span>
                <span className={r.kind === "discount" ? "font-medium text-emerald-500" : isTotal ? `font-semibold ${text}` : text}>
                  {sign}
                  {money(r.amountCents)}
                  {r.percent != null && r.percent > 0 ? ` (${r.percent}%)` : ""}
                </span>
              </div>
              <div className={`mt-1 h-1.5 w-full rounded-full ${track}`}>
                <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.round(r.barFraction * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      {(notes.length > 0 || input.deliveryCents != null) && (
        <ul className={`mt-3 space-y-1 text-xs ${muted}`}>
          {input.deliveryCents != null && <li>{DELIVERY_NOTE}</li>}
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
