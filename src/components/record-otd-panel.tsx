"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordOfferOtd } from "@/lib/offer-submission-actions";
import { SEND_REFUSALS } from "@/lib/offer-entry-copy";
import { OFFER_ENTRY_DRAFT_COPY as D, RECORD_OTD_COPY as R } from "@/lib/offer-entry-draft-copy";
import { checkOutTheDoorTotal, outTheDoorSumCents } from "@/lib/offer-pricing";
import type { OfferPayload } from "@/lib/offer-submission";

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
function toCents(v: string): number | null {
  const t = v.replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
const input = "mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white";

/**
 * Record the dealer's out-the-door quote on an offer sent without one (offer entry, Chunk 9).
 * Only fee lines and the total; the price and sticker are fixed on a sent offer.
 */
export function RecordOtdPanel(props: {
  offerId: string;
  offerPriceCents: number;
  addonsCents: number[];
  taxPaidAtRegistration: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [docFee, setDocFee] = useState("");
  const [salesTax, setSalesTax] = useState("");
  const [titleReg, setTitleReg] = useState("");
  const [other, setOther] = useState<{ label: string; amount: string }[]>([]);
  const [noOther, setNoOther] = useState(false);
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const fees: OfferPayload["fees"] = [];
  for (const [kind, v] of [["doc_fee", docFee], ["sales_tax", salesTax], ["title_registration", titleReg]] as const) {
    const c = toCents(v);
    if (c != null) fees.push({ kind, amount_cents: c });
  }
  for (const o of other) if (o.label.trim() || o.amount) fees.push({ kind: "other", label: o.label.trim(), amount_cents: toCents(o.amount) ?? 0 });
  const lines = {
    priceCents: props.offerPriceCents,
    addons: props.addonsCents.map((amountCents) => ({ amountCents })),
    fees: fees.map((f) => ({ kind: f.kind, amountCents: f.amount_cents, paidAtRegistration: f.kind === "sales_tax" && props.taxPaidAtRegistration })),
  };
  const sum = outTheDoorSumCents(lines);
  const totalCents = toCents(total);
  const mismatch = totalCents != null && !checkOutTheDoorTotal(lines, totalCents).ok;

  async function record() {
    if (totalCents == null) return;
    setBusy(true);
    setMessage(null);
    const res = await recordOfferOtd(props.offerId, fees, totalCents, noOther);
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: R.refusals[res.code] ?? SEND_REFUSALS[res.code] ?? SEND_REFUSALS.send_failed });
    setMessage({ ok: true, text: R.recorded(res.customerFirstName) });
    router.refresh();
  }

  return (
    <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-xs text-amber-200">{R.waiting}</p>
      {message?.ok ? (
        <p className="mt-2 text-sm text-emerald-400">{message.text}</p>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5">
          Record out-the-door
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-zinc-500">The price and sticker can&apos;t change on a sent offer. Log a new offer instead.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-zinc-400">Doc fee<input value={docFee} onChange={(e) => setDocFee(e.target.value)} inputMode="decimal" className={input} /></label>
            <label className="text-xs text-zinc-400">Sales tax<input value={salesTax} onChange={(e) => setSalesTax(e.target.value)} inputMode="decimal" className={input} /></label>
            <label className="text-xs text-zinc-400">Title &amp; registration<input value={titleReg} onChange={(e) => setTitleReg(e.target.value)} inputMode="decimal" className={input} /></label>
          </div>
          <p className="text-xs font-semibold text-zinc-300">Other fees</p>
          {other.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2">
              <input value={o.label} placeholder={D.feeName} onChange={(e) => setOther((x) => x.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} className={input} />
              <input value={o.amount} placeholder="$" inputMode="decimal" onChange={(e) => setOther((x) => x.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))} className={input} />
              <button type="button" onClick={() => setOther((x) => x.filter((_, j) => j !== i))} className="mt-1 rounded border border-white/10 px-2 text-xs text-zinc-400">{D.remove}</button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button type="button" onClick={() => { setOther((x) => [...x, { label: "", amount: "" }]); setNoOther(false); }} className="text-emerald-400 underline">{D.addFee}</button>
            <label className="flex items-center gap-1.5 text-zinc-300"><input type="checkbox" checked={noOther} disabled={other.length > 0} onChange={(e) => setNoOther(e.target.checked)} />No other fees</label>
          </div>
          <label className="block text-xs text-zinc-400">{R.totalLabel}<input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" className={`${input} max-w-xs`} aria-label={R.totalLabel} /></label>
          <p className="text-sm text-zinc-300">{D.linesAddUp(money(sum))}</p>
          {mismatch && <p className="text-xs text-amber-400">{D.linesMismatch(money(sum), money(totalCents!))}</p>}
          {message && !message.ok && <p className="text-sm text-red-400">{message.text}</p>}
          <button type="button" onClick={record} disabled={busy || totalCents == null}
            className="min-h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 disabled:opacity-50">
            {busy ? "Saving…" : "Record out-the-door"}
          </button>
        </div>
      )}
    </div>
  );
}
