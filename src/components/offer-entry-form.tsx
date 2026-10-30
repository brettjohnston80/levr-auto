"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DealerInstalledTag } from "@/components/dealer-installed-tag";
import { OfferPriceBreakdown } from "@/components/offer-price-breakdown";
import { parseDealerOffer } from "@/lib/offer-parsing-actions";
import { attachOfferSheet, saveOfferDraft, sendOffer } from "@/lib/offer-submission-actions";
import { DRAFT_SAVED, OTD_MISSING_AT_SEND, SEND_REFUSALS, sentTo } from "@/lib/offer-entry-copy";
import { OFFER_ENTRY_DRAFT_COPY as D } from "@/lib/offer-entry-draft-copy";
import { checkOutTheDoorTotal, discountCents, discountPercent, outTheDoorSumCents, priceBelowSticker } from "@/lib/offer-pricing";
import { findStickerRange, stickerWarnings, type StickerRange } from "@/lib/sticker-check";
import { displayOptionName } from "@/lib/option-display";
import type { OfferPayload } from "@/lib/offer-submission";
import type { OfferWarning } from "@/lib/offer-warnings";
import { COLOUR_MARK, colourMatch, pickerListings, vinLast8 } from "@/lib/listing-picker";
import type { OutreachListing, OutreachSelection, OutreachTrimPreference } from "@/lib/outreach-queue";
import type { ManufacturerFee, OfferEntryOtherOffer } from "@/lib/offer-entry-context";

// ---- helpers --------------------------------------------------------------------------------

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
function toCents(v: string): number | null {
  const t = v.replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
const fromCents = (c: number | null | undefined) => (c == null ? "" : String(c / 100));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function fiveDigitZip(zip: string | null): string {
  const m = /^(\d{5})(?:-?\d{4})?$/.exec((zip ?? "").trim());
  return m ? m[1] : (zip ?? "").trim();
}

interface AddonRow { description: string; amount: string; didntAsk: boolean; removable: boolean }
interface OtherFeeRow { label: string; amount: string }
interface ExtraRow { name: string; price: string; install: "" | "factory" | "dealer" | "port" }
type Tick = "on" | "off" | null;

const WARNING_TEXT = (w: OfferWarning, dateFmt: (iso: string) => string): string => {
  switch (w.code) {
    case "above_sticker":
      return `The negotiated price (${money(w.priceCents)}) isn't below the sticker (${money(w.stickerCents)}). It won't count toward the guarantee. Send it anyway?`;
    case "duplicate_vin":
      return `This VIN is already on an offer for this search (${w.dealerName}, ${dateFmt(w.createdAt)}). Send another offer for the same car?`;
    case "duplicate_dealer":
      return `${w.dealerName} already has an open offer on this search. Send another one?`;
    case "inactive_search":
      return `This search is ${w.searchStatus}. Send an offer to it anyway?`;
  }
};

const input = "mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white";
const label = "block text-xs text-zinc-400";
const card = "rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5";

// ---- component ------------------------------------------------------------------------------

export function OfferEntryForm(props: {
  searchId: string;
  title: string;
  customerFirstName: string | null;
  makeModel: string;
  listings: OutreachListing[];
  /** The search's committed model year: the picker shows only that year's listings. */
  modelYear: number | null;
  stickerRanges: StickerRange[];
  selections: OutreachSelection[];
  trimPreferences: OutreachTrimPreference[];
  searchTrim: string | null;
  otherOffers: OfferEntryOtherOffer[];
  drafts: { id: string; dealerName: string | null; updatedAt: string; source: string }[];
  manufacturerFee: ManufacturerFee | null;
  initial: { submissionId: string; payload: Partial<OfferPayload> } | null;
}) {
  const router = useRouter();
  const p = props.initial?.payload ?? {};

  const wantedOptions = useMemo(
    () =>
      props.selections
        .filter((s) => s.category === "feature" && !s.excluded && s.rankPosition != null)
        .sort((a, b) => (a.rankPosition ?? 0) - (b.rankPosition ?? 0)),
    [props.selections],
  );
  const rankedOf = (cat: string) =>
    props.selections.filter((s) => s.category === cat && !s.excluded && s.rankPosition != null)
      .sort((a, b) => (a.rankPosition ?? 0) - (b.rankPosition ?? 0));
  const exteriorPicks = rankedOf("exterior_color").map((s) => norm(displayOptionName(s.selection)));
  const interiorPicks = rankedOf("interior").map((s) => norm(displayOptionName(s.selection)));
  const dealerInstalledWanted = props.selections
    .filter((s) => s.dealerInstalled && !s.excluded)
    .map((s) => norm(displayOptionName(s.selection)))
    .filter(Boolean);
  const matchesDealerInstalled = (d: string) => {
    const n = norm(d);
    return n.length > 0 && dealerInstalledWanted.some((w) => n.includes(w) || w.includes(n));
  };
  const rankedTrims = props.trimPreferences.filter((t) => !t.excluded && t.rankPosition != null)
    .sort((a, b) => (a.rankPosition ?? 0) - (b.rankPosition ?? 0)).map((t) => t.trim);
  const trimLabel = rankedTrims.length > 0 ? rankedTrims.join(" / ") : props.searchTrim ?? "any trim";

  // Step 1: paste
  const [parseMode, setParseMode] = useState<"text" | "pdf">("text");
  const [rawText, setRawText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 2: the car
  const [listingId, setListingId] = useState(p.listing_id ?? "");
  const [allTrims, setAllTrims] = useState(false);
  const [dealerName, setDealerName] = useState(p.dealer_name ?? "");
  const [dealerStreet, setDealerStreet] = useState(p.dealer_street ?? "");
  const [dealerCity, setDealerCity] = useState(p.dealer_city ?? "");
  const [dealerState, setDealerState] = useState(p.dealer_state ?? "");
  const [dealerZip, setDealerZip] = useState(p.dealer_zip ?? "");
  const [vin, setVin] = useState(p.vin ?? "");
  const [stock, setStock] = useState(p.stock_number ?? "");
  const [trim, setTrim] = useState(p.vehicle_trim ?? "");
  const [exterior, setExterior] = useState(p.vehicle_exterior_color ?? "");
  const [interior, setInterior] = useState(p.vehicle_interior_color ?? "");

  // Step 3: options
  const [ticks, setTicks] = useState<Record<string, Tick>>(() => {
    const out: Record<string, Tick> = {};
    for (const o of p.options ?? []) if (o.search_option_selection_id) out[o.search_option_selection_id] = o.on_the_car ? "on" : "off";
    return out;
  });
  const [extras, setExtras] = useState<ExtraRow[]>(
    (p.options ?? []).filter((o) => !o.customer_asked_for).map((o) => ({ name: o.name, price: fromCents(o.sticker_price_cents), install: o.install_kind ?? "" })),
  );
  const [trimMatch, setTrimMatch] = useState(p.trim_match_confirmed ?? false);

  // Step 4: price
  const [sticker, setSticker] = useState(fromCents(p.msrp_cents));
  const [price, setPrice] = useState(fromCents(p.offer_price_cents));
  const feeOf = (k: string) => fromCents(p.fees?.find((f) => f.kind === k)?.amount_cents);
  const [docFee, setDocFee] = useState(feeOf("doc_fee"));
  const [salesTax, setSalesTax] = useState(feeOf("sales_tax"));
  const [titleReg, setTitleReg] = useState(feeOf("title_registration"));
  const [otherFees, setOtherFees] = useState<OtherFeeRow[]>(() => {
    const saved = (p.fees ?? []).filter((f) => f.kind === "other").map((f) => ({ label: f.label ?? "", amount: fromCents(f.amount_cents) }));
    if (saved.length > 0 || props.initial) return saved;
    return props.manufacturerFee ? [{ label: props.manufacturerFee.fee, amount: String(props.manufacturerFee.amount) }] : [];
  });
  const [noOtherFees, setNoOtherFees] = useState(p.other_fees_none_confirmed ?? false);
  const [addons, setAddons] = useState<AddonRow[]>(
    (p.addons ?? []).map((a) => ({ description: a.description, amount: fromCents(a.amount_cents), didntAsk: !a.customer_wanted, removable: !!a.dealer_says_removable })),
  );
  const [noAddons, setNoAddons] = useState(p.addons_none_confirmed ?? false);
  const [otd, setOtd] = useState(fromCents(p.otd_total_cents));
  const [deliveryMode, setDeliveryMode] = useState<"" | "fee" | "requested" | "unavailable">(
    p.delivery_estimate_status === "provided" ? "fee" : (p.delivery_estimate_status ?? ""),
  );
  const [deliveryFee, setDeliveryFee] = useState(fromCents(p.delivery_estimate_cents));
  const [deliveryNote, setDeliveryNote] = useState(p.delivery_estimate_note ?? "");

  // Step 5: terms
  const [goodUntil, setGoodUntil] = useState(p.good_until ?? "");
  const [dealerContact, setDealerContact] = useState(p.dealer_contact ?? "");
  const [noteToCustomer, setNoteToCustomer] = useState(p.note_to_customer ?? "");
  const [agentNotes, setAgentNotes] = useState(p.notes ?? "");

  // Save / send
  const [submissionId, setSubmissionId] = useState<string | null>(props.initial?.submissionId ?? null);
  const [busy, setBusy] = useState<null | "save" | "send">(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [warnings, setWarnings] = useState<OfferWarning[]>([]);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [sent, setSent] = useState<{ firstName: string | null; otdMissing: boolean; sheetError: string | null } | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const stickerCents = toCents(sticker);
  const priceCents = toCents(price);
  const listing = props.listings.find((l) => l.id === listingId) ?? null;

  function pickListing(id: string) {
    setListingId(id);
    const l = props.listings.find((x) => x.id === id);
    if (!l) return;
    setDealerName(l.dealerName ?? "");
    setDealerContact(l.dealerPhone ?? "");
    if (l.priceCents != null) setPrice(String(l.priceCents / 100));
    if (l.msrpCents != null) setSticker(String(l.msrpCents / 100));
    if (l.trim) setTrim(l.trim);
    if (l.color) setExterior(l.color);
    if (l.interiorColor) setInterior(l.interiorColor);
    setDealerStreet(l.dealerStreet ?? "");
    setDealerCity(l.dealerCity ?? "");
    setDealerState(l.dealerState ?? "");
    setDealerZip(fiveDigitZip(l.dealerZip));
    setVin(l.vin ?? "");
    setStock(l.stockNumber ?? "");
  }

  async function parse() {
    setParsing(true);
    setParseError(null);
    const fd = new FormData();
    if (parseMode === "pdf" && pdfFile) fd.set("pdf", pdfFile);
    else fd.set("raw_text", rawText);
    const res = await parseDealerOffer(fd);
    setParsing(false);
    if (!res.ok) return setParseError(res.error);
    const x = res.parsed;
    if (x.dealerName) setDealerName(x.dealerName);
    if (x.dealerContact) setDealerContact(x.dealerContact);
    if (x.offerPriceCents != null) setPrice(String(x.offerPriceCents / 100));
    if (x.addons.length > 0) {
      setAddons(x.addons.map((a) => ({ description: a.description, amount: String(a.amountCents / 100), didntAsk: !matchesDealerInstalled(a.description), removable: false })));
      setNoAddons(false);
    }
  }

  // The payload in the shape the server reads (send_offer_submission).
  function buildPayload(): OfferPayload {
    const fees: OfferPayload["fees"] = [];
    for (const [kind, v] of [["doc_fee", docFee], ["sales_tax", salesTax], ["title_registration", titleReg]] as const) {
      const c = toCents(v);
      if (c != null) fees.push({ kind, amount_cents: c });
    }
    for (const f of otherFees) {
      const c = toCents(f.amount);
      if (f.label.trim() || c != null) fees.push({ kind: "other", label: f.label.trim(), amount_cents: c ?? 0 });
    }
    const options: OfferPayload["options"] = [
      ...wantedOptions
        .filter((o) => ticks[o.id])
        .map((o) => ({ name: o.selection, search_option_selection_id: o.id, customer_asked_for: true, on_the_car: ticks[o.id] === "on" })),
      ...extras
        .filter((e) => e.name.trim())
        .map((e) => ({ name: e.name.trim(), customer_asked_for: false, on_the_car: true, sticker_price_cents: toCents(e.price), install_kind: e.install || null })),
    ];
    const otdCents = toCents(otd);
    return {
      dealer_name: dealerName.trim(),
      dealer_contact: dealerContact.trim() || null,
      listing_id: listingId || null,
      dealer_street: dealerStreet.trim() || null,
      dealer_city: dealerCity.trim() || null,
      dealer_state: dealerState.trim().toUpperCase() || null,
      dealer_zip: dealerZip.trim() || null,
      vin: vin.trim() || null,
      stock_number: stock.trim() || null,
      vehicle_trim: trim.trim() || null,
      vehicle_exterior_color: exterior.trim() || null,
      vehicle_interior_color: interior.trim() || null,
      offer_price_cents: priceCents ?? 0,
      msrp_cents: stickerCents ?? 0,
      notes: agentNotes.trim() || null,
      good_until: goodUntil || null,
      note_to_customer: noteToCustomer.trim() || null,
      delivery_estimate_status: deliveryMode === "fee" ? "provided" : deliveryMode || null,
      delivery_estimate_cents: deliveryMode === "fee" ? toCents(deliveryFee) : null,
      delivery_estimate_note: deliveryMode === "fee" || deliveryMode === "unavailable" ? deliveryNote.trim() || null : null,
      otd_source: otdCents != null ? "dealer_quote" : null,
      otd_total_cents: otdCents,
      addons: addons
        .filter((a) => a.description.trim() || a.amount)
        .map((a) => ({ description: a.description.trim(), amount_cents: toCents(a.amount) ?? 0, customer_wanted: !a.didntAsk, dealer_says_removable: a.removable })),
      addons_none_confirmed: noAddons,
      fees,
      other_fees_none_confirmed: noOtherFees,
      options,
      trim_match_confirmed: trimMatch,
      tax_paid_at_registration: false,
      warnings_confirmed: confirmed,
    };
  }

  const payload = buildPayload();
  const lines = {
    priceCents: payload.offer_price_cents,
    addons: payload.addons.map((a) => ({ amountCents: a.amount_cents })),
    fees: payload.fees.map((f) => ({ kind: f.kind, amountCents: f.amount_cents })),
  };
  const linesSum = outTheDoorSumCents(lines);
  const otdCheck = payload.otd_total_cents != null ? checkOutTheDoorTotal(lines, payload.otd_total_cents) : null;

  async function save() {
    setBusy("save");
    setMessage(null);
    const res = await saveOfferDraft(props.searchId, submissionId, payload);
    setBusy(null);
    if (!res.ok) return setMessage({ tone: "error", text: SEND_REFUSALS[res.code] ?? SEND_REFUSALS.send_failed });
    setSubmissionId(res.submissionId);
    router.replace(`/internal/outreach/${props.searchId}/offer?submission=${res.submissionId}`, { scroll: false });
    setMessage({ tone: "ok", text: DRAFT_SAVED });
  }

  async function send() {
    setClientError(null);
    setMessage(null);
    const unticked = wantedOptions.filter((o) => !ticks[o.id]);
    if (unticked.length > 0) return setClientError(D.tickEveryOption);
    setBusy("send");
    const res = await sendOffer(props.searchId, submissionId, payload);
    setBusy(null);
    if (!res.ok) {
      if (res.code === "warnings_unconfirmed" && res.warnings) setWarnings(res.warnings);
      return setMessage({ tone: "error", text: SEND_REFUSALS[res.code] ?? SEND_REFUSALS.send_failed });
    }
    let sheetError: string | null = null;
    if (parseMode === "pdf" && pdfFile) {
      const fd = new FormData();
      fd.set("offer_id", res.offerId);
      fd.set("pdf", pdfFile);
      const up = await attachOfferSheet(fd);
      if (!up.ok) sheetError = up.error;
    }
    setSent({ firstName: res.customerFirstName, otdMissing: res.otdMissing, sheetError });
    setWarnings([]);
  }

  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const stickerNotes = stickerWarnings(stickerCents, listing?.msrpCents ?? null, findStickerRange(props.stickerRanges, trim));
  const below = stickerCents != null && priceCents != null ? priceBelowSticker(stickerCents, priceCents) : null;

  if (sent) {
    return (
      <div className={`${card} max-w-2xl`}>
        <p className="text-base font-semibold text-emerald-400">{sentTo(sent.firstName)}</p>
        {sent.otdMissing && <p className="mt-2 text-sm text-zinc-300">{OTD_MISSING_AT_SEND}</p>}
        {sent.sheetError && <p className="mt-2 text-sm text-amber-400">{sent.sheetError}</p>}
        <Link href="/internal/outreach" className="mt-4 inline-block text-sm text-emerald-400 underline">
          {D.backToOutreach}
        </Link>
      </div>
    );
  }

  const pickMark = (value: string, picks: string[]) => <ColourMark colour={value} picks={picks} className="ml-2 text-xs" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/internal/outreach" className="text-xs text-zinc-400 underline hover:text-zinc-200">
            {D.backToOutreach}
          </Link>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">I&apos;m entering it</span>
        </div>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">{props.title}</h1>

        {props.drafts.length > 0 && (
          <div className={card}>
            <p className="text-xs font-semibold text-zinc-300">{D.draftsHeading}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {props.drafts.map((d) => (
                <li key={d.id}>
                  <Link href={`/internal/outreach/${props.searchId}/offer?submission=${d.id}`} className={`underline ${d.id === submissionId ? "text-white" : "text-zinc-400"}`}>
                    {d.dealerName ?? D.noDealerYet}
                  </Link>
                  <span className="text-zinc-500"> · {D.savedAt(dateFmt(d.updatedAt))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 1 Paste the quote */}
        <section className={card}>
          <h2 className="text-sm font-semibold text-white">1 Paste the quote</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Paste the dealer&apos;s email or call notes, or attach their quote. AI fills in what it can — check anything marked.
          </p>
          <div className="mt-2 flex gap-4 text-xs text-zinc-300">
            <label className="flex items-center gap-1.5"><input type="radio" checked={parseMode === "text"} onChange={() => setParseMode("text")} />{D.pasteText}</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={parseMode === "pdf"} onChange={() => setParseMode("pdf")} />Attach quote</label>
          </div>
          {parseMode === "text" ? (
            <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={4} className={input} />
          ) : (
            <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} className="mt-2 w-full text-sm text-zinc-300" />
          )}
          <button type="button" onClick={parse} disabled={parsing || (parseMode === "text" ? !rawText.trim() : !pdfFile)}
            className="mt-2 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50">
            {parsing ? "Parsing…" : "Parse with AI"}
          </button>
          {parseError && <p className="mt-2 text-xs text-red-400">{parseError}</p>}
          <p className="mt-2 text-xs text-zinc-500">Total SRP is never parsed; enter it yourself.</p>
        </section>

        {/* 2 Pick the car */}
        <section className={card}>
          <h2 className="text-sm font-semibold text-white">2 Pick the car</h2>
          {props.listings.length > 0 && (() => {
            const rows = pickerListings(props.listings, { modelYear: props.modelYear, customerTrims: rankedTrims, allTrims });
            const mark = (c: string | null, picks: string[]) => <ColourMark colour={c} picks={picks} />;
            return (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  {([false, true] as const).map((all) => (
                    <button key={String(all)} type="button" aria-pressed={allTrims === all} onClick={() => setAllTrims(all)}
                      className={`rounded-full px-3 py-1 ${allTrims === all ? "bg-white/10 font-semibold text-white" : "border border-white/10 text-zinc-400 hover:text-white"}`}>
                      {all ? "All trims" : "Your customer's trims"}
                    </button>
                  ))}
                  <button type="button" onClick={() => setListingId("")}
                    className={`rounded-full px-3 py-1 ${listingId === "" ? "bg-white/10 font-semibold text-white" : "border border-white/10 text-zinc-400 hover:text-white"}`}>
                    Not listed — enter VIN by hand
                  </button>
                </div>
                <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-white/10">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="sticky top-0 bg-zinc-900 text-zinc-400">
                      <tr>
                        {["", "Dealer", "Miles", "Exterior", "Interior", "Stock #", "VIN (last 8)", "Listed price"].map((h) => (
                          <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((l) => (
                        <tr key={l.id} onClick={() => pickListing(l.id)}
                          className={`cursor-pointer border-t border-white/5 ${listingId === l.id ? "bg-emerald-500/10" : "hover:bg-white/5"}`}>
                          <td className="px-2 py-1.5">
                            <input type="radio" name="listing" checked={listingId === l.id} onChange={() => pickListing(l.id)} aria-label={`${l.dealerName ?? ""} ${vinLast8(l.vin)}`} />
                          </td>
                          <td className="px-2 py-1.5 text-zinc-200">{l.dealerName ?? "—"}{!allTrims ? "" : l.trim ? <span className="block text-zinc-500">{l.trim}</span> : null}</td>
                          <td className="px-2 py-1.5 text-zinc-300">{l.miles != null ? Math.round(l.miles) : "—"}</td>
                          <td className="px-2 py-1.5 text-zinc-300">{l.color ?? "—"}{mark(l.color, exteriorPicks)}</td>
                          <td className="px-2 py-1.5 text-zinc-300">{l.interiorColor ?? "—"}{mark(l.interiorColor, interiorPicks)}</td>
                          <td className="px-2 py-1.5 text-zinc-300">{l.stockNumber ?? "—"}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-300">{vinLast8(l.vin)}</td>
                          <td className="px-2 py-1.5 text-zinc-200">{l.priceCents != null ? money(l.priceCents) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Dealership</label><input value={dealerName} onChange={(e) => setDealerName(e.target.value)} className={input} /></div>
            <div className="grid grid-cols-[1fr_4rem_6rem] gap-2">
              <div><label className={label}>City</label><input value={dealerCity} onChange={(e) => setDealerCity(e.target.value)} className={input} /></div>
              <div><label className={label}>ST</label><input value={dealerState} maxLength={2} onChange={(e) => setDealerState(e.target.value)} className={input} /></div>
              <div><label className={label}>ZIP</label><input value={dealerZip} maxLength={5} inputMode="numeric" onChange={(e) => setDealerZip(e.target.value)} className={input} /></div>
            </div>
            <div><label className={label}>Street</label><input value={dealerStreet} onChange={(e) => setDealerStreet(e.target.value)} className={input} /></div>
            <div><label className={label}>VIN</label><input value={vin} onChange={(e) => setVin(e.target.value)} className={`${input} font-mono`} /></div>
            <div><label className={label}>Stock #</label><input value={stock} onChange={(e) => setStock(e.target.value)} className={input} /></div>
            <div><label className={label}>{D.trimField}</label><input value={trim} onChange={(e) => setTrim(e.target.value)} className={input} /></div>
            <div><label className={label}>Exterior{pickMark(exterior, exteriorPicks)}</label><input value={exterior} onChange={(e) => setExterior(e.target.value)} className={input} /></div>
            <div><label className={label}>Interior{pickMark(interior, interiorPicks)}</label><input value={interior} onChange={(e) => setInterior(e.target.value)} className={input} /></div>
          </div>
        </section>

        {/* 3 Options on this car */}
        <section className={card}>
          <h2 className="text-sm font-semibold text-white">3 Options on this car</h2>
          <h3 className="mt-3 text-xs font-semibold text-zinc-300">What the customer wants</h3>
          {wantedOptions.length === 0 ? (
            <p className="mt-1 text-xs text-zinc-500">{D.noWantedOptions}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {wantedOptions.map((o) => (
                <li key={o.id} className="flex flex-col gap-2 rounded-md border border-white/5 p-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-zinc-200">
                    {o.rankPosition}. {displayOptionName(o.selection)} {o.dealerInstalled && <DealerInstalledTag />}
                  </span>
                  <span className="flex gap-2">
                    {(["on", "off"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setTicks((x) => ({ ...x, [o.id]: x[o.id] === t ? null : t }))}
                        className={`min-h-9 rounded-md border px-3 text-xs ${ticks[o.id] === t ? (t === "on" ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-amber-500 bg-amber-500/15 text-amber-300") : "border-white/10 text-zinc-400"}`}>
                        {t === "on" ? "On the car" : "Not on the car"}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-4 text-xs font-semibold text-zinc-300">Also on the sticker</h3>
          {extras.map((e, i) => (
            <div key={i} className="mt-2 grid grid-cols-[1fr_6rem] gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
              <input value={e.name} placeholder={D.optionName} onChange={(ev) => setExtras((x) => x.map((r, j) => (j === i ? { ...r, name: ev.target.value } : r)))} className={input} />
              <input value={e.price} placeholder="$" inputMode="decimal" onChange={(ev) => setExtras((x) => x.map((r, j) => (j === i ? { ...r, price: ev.target.value } : r)))} className={input} />
              <select value={e.install} onChange={(ev) => setExtras((x) => x.map((r, j) => (j === i ? { ...r, install: ev.target.value as ExtraRow["install"] } : r)))} className={input}>
                <option value="">{D.installUnknown}</option>
                <option value="factory">{D.installFactory}</option>
                <option value="dealer">Dealer-installed</option>
                <option value="port">{D.installPort}</option>
              </select>
              <span className="flex items-center gap-2 text-xs text-zinc-500">
                Not asked for
                <button type="button" onClick={() => setExtras((x) => x.filter((_, j) => j !== i))} className="rounded border border-white/10 px-2 py-1 text-zinc-400">{D.remove}</button>
              </span>
            </div>
          ))}
          <button type="button" onClick={() => setExtras((x) => [...x, { name: "", price: "", install: "" }])} className="mt-2 text-xs text-emerald-400 underline">
            + Add a sticker option
          </button>
          <label className="mt-4 flex items-start gap-2 text-sm text-zinc-200">
            <input type="checkbox" checked={trimMatch} onChange={(e) => setTrimMatch(e.target.checked)} className="mt-1" />
            Trim matches what the customer chose ({trimLabel})
          </label>
        </section>

        {/* 4 Price */}
        <section className={card}>
          <h2 className="text-sm font-semibold text-white">4 Price</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 p-3">
              <p className="text-xs text-zinc-400">Sticker</p>
              <input value={sticker} onChange={(e) => setSticker(e.target.value)} inputMode="decimal" className={input} aria-label="Sticker" />
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <p className="text-xs text-zinc-400">Negotiated</p>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={input} aria-label="Negotiated" />
              {stickerCents != null && priceCents != null && discountCents(stickerCents, priceCents) > 0 && (
                <p className="mt-1 text-xs text-emerald-400">
                  {money(discountCents(stickerCents, priceCents))} below sticker ({discountPercent(stickerCents, priceCents)}%)
                </p>
              )}
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <p className="text-xs text-zinc-400">Out-the-door</p>
              <input value={otd} onChange={(e) => setOtd(e.target.value)} inputMode="decimal" className={input} aria-label="Out-the-door" />
              <p className="mt-1 text-xs text-zinc-500">{payload.otd_total_cents != null ? "Dealer's quote" : "Not recorded yet"}</p>
            </div>
          </div>
          {stickerNotes.map((w) => <p key={w.kind} className="mt-2 text-xs text-amber-400">{w.message}</p>)}
          {below != null && (
            <p className={`mt-3 text-sm ${below && trimMatch ? "text-emerald-400" : "text-amber-400"}`}>
              {!trimMatch
                ? "Confirm the trim matches before sending."
                : below
                  ? `Counts toward the guarantee: the trim matches and the negotiated price is ${money(discountCents(stickerCents!, priceCents!))} below this car's sticker.`
                  : "Doesn't count toward the guarantee: the negotiated price isn't below this car's sticker."}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><label className={label}>Doc fee</label><input value={docFee} onChange={(e) => setDocFee(e.target.value)} inputMode="decimal" className={input} /></div>
            <div><label className={label}>Sales tax</label><input value={salesTax} onChange={(e) => setSalesTax(e.target.value)} inputMode="decimal" className={input} /></div>
            <div><label className={label}>Title &amp; registration</label><input value={titleReg} onChange={(e) => setTitleReg(e.target.value)} inputMode="decimal" className={input} /></div>
          </div>

          <h3 className="mt-4 text-xs font-semibold text-zinc-300">{D.addonsHeading}</h3>
          {addons.map((a, i) => (
            <div key={i} className="mt-2 rounded-md border border-white/5 p-2">
              <div className="grid grid-cols-[1fr_6rem_auto] gap-2">
                <input value={a.description} placeholder={D.addonName} onChange={(e) => setAddons((x) => x.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))} className={input} />
                <input value={a.amount} placeholder="$" inputMode="decimal" onChange={(e) => setAddons((x) => x.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))} className={input} />
                <button type="button" onClick={() => setAddons((x) => x.filter((_, j) => j !== i))} className="mt-1 rounded border border-white/10 px-2 text-xs text-zinc-400">{D.remove}</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-300">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={a.didntAsk} onChange={(e) => setAddons((x) => x.map((r, j) => (j === i ? { ...r, didntAsk: e.target.checked } : r)))} />Customer didn&apos;t ask for this</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={a.removable} onChange={(e) => setAddons((x) => x.map((r, j) => (j === i ? { ...r, removable: e.target.checked } : r)))} />Dealer says it can be removed</label>
                {matchesDealerInstalled(a.description) && <DealerInstalledTag />}
              </div>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
            <button type="button" onClick={() => { setAddons((x) => [...x, { description: "", amount: "", didntAsk: true, removable: false }]); setNoAddons(false); }} className="text-emerald-400 underline">{D.addAddon}</button>
            <label className="flex items-center gap-1.5 text-zinc-300"><input type="checkbox" checked={noAddons} disabled={addons.length > 0} onChange={(e) => setNoAddons(e.target.checked)} />No add-ons</label>
          </div>

          <h3 className="mt-4 text-xs font-semibold text-zinc-300">Other fees</h3>
          {props.manufacturerFee && otherFees.some((f) => f.label === props.manufacturerFee!.fee) && (
            <p className="mt-1 text-xs text-zinc-500">{D.manufacturerFeePrefilled(props.manufacturerFee)}</p>
          )}
          {otherFees.map((f, i) => (
            <div key={i} className="mt-2 grid grid-cols-[1fr_6rem_auto] gap-2">
              <input value={f.label} placeholder={D.feeName} onChange={(e) => setOtherFees((x) => x.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} className={input} />
              <input value={f.amount} placeholder="$" inputMode="decimal" onChange={(e) => setOtherFees((x) => x.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))} className={input} />
              <button type="button" onClick={() => setOtherFees((x) => x.filter((_, j) => j !== i))} className="mt-1 rounded border border-white/10 px-2 text-xs text-zinc-400">{D.remove}</button>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
            <button type="button" onClick={() => { setOtherFees((x) => [...x, { label: "", amount: "" }]); setNoOtherFees(false); }} className="text-emerald-400 underline">{D.addFee}</button>
            <label className="flex items-center gap-1.5 text-zinc-300"><input type="checkbox" checked={noOtherFees} disabled={otherFees.length > 0} onChange={(e) => setNoOtherFees(e.target.checked)} />No other fees</label>
          </div>

          <p className="mt-4 text-sm text-zinc-300">{D.linesAddUp(money(linesSum))}</p>
          {otdCheck && !otdCheck.ok && (
            <p className="mt-1 text-xs text-amber-400">{D.linesMismatch(money(linesSum), money(payload.otd_total_cents!))}</p>
          )}

          <fieldset className="mt-4 rounded-md border border-white/10 p-3">
            <legend className="px-1 text-xs text-zinc-400">Delivery estimate</legend>
            <p className="text-xs text-zinc-500">Required when the dealer is beyond the customer&apos;s pickup range or they prefer delivery; optional otherwise.</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-300">
              {([["", "None"], ["fee", "Dealer's delivery fee"], ["requested", "Requested from dealer"], ["unavailable", "Dealer doesn't deliver"]] as const).map(([v, l]) => (
                <label key={v} className="flex min-h-9 items-center gap-1.5"><input type="radio" checked={deliveryMode === v} onChange={() => setDeliveryMode(v)} />{l}</label>
              ))}
            </div>
            {deliveryMode === "fee" && <input value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="$0.00 (0 = free delivery)" inputMode="decimal" className={`${input} max-w-xs`} />}
            {(deliveryMode === "fee" || deliveryMode === "unavailable") && (
              <input value={deliveryNote} maxLength={500} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="Note for the customer (optional)" className={input} />
            )}
          </fieldset>
        </section>

        {/* 5 Terms */}
        <section className={card}>
          <h2 className="text-sm font-semibold text-white">5 Terms</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Good until</label><input type="date" value={goodUntil} onChange={(e) => setGoodUntil(e.target.value)} className={input} /></div>
            <div><label className={label}>Dealer contact</label><input value={dealerContact} onChange={(e) => setDealerContact(e.target.value)} className={input} /></div>
          </div>
          <label className={`${label} mt-3`}>Note to the customer (optional)</label>
          <textarea value={noteToCustomer} maxLength={1000} onChange={(e) => setNoteToCustomer(e.target.value)} rows={2} className={input} />
          <p className="mt-1 text-xs text-zinc-500">Shown on the customer&apos;s offer.</p>
          <label className={`${label} mt-3`}>{D.agentNotes}</label>
          <textarea value={agentNotes} onChange={(e) => setAgentNotes(e.target.value)} rows={2} className={input} />
        </section>

        {warnings.length > 0 && (
          <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <ul className="space-y-3">
              {warnings.map((w) => (
                <li key={w.code} className="text-sm text-amber-200">
                  <p>{WARNING_TEXT(w, dateFmt)}</p>
                  <label className="mt-1 flex items-center gap-2 text-xs text-zinc-200">
                    <input type="checkbox" checked={confirmed.includes(w.code)} onChange={(e) => setConfirmed((c) => (e.target.checked ? [...c, w.code] : c.filter((x) => x !== w.code)))} />
                    Yes, send it
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(message || clientError) && (
          <p className={`text-sm ${message?.tone === "ok" && !clientError ? "text-emerald-400" : "text-red-400"}`}>{clientError ?? message?.text}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={save} disabled={busy !== null} className="min-h-11 rounded-lg border border-white/20 px-5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50">
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={send} disabled={busy !== null} className="min-h-11 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 disabled:opacity-50">
            {busy === "send" ? "Sending…" : "Send to customer"}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">What the customer will see</h2>
          <div className="mt-3">
            <OfferPriceBreakdown
              input={{
                stickerCents: stickerCents ?? 0,
                priceCents: priceCents ?? 0,
                addons: payload.addons.map((a) => ({ description: a.description, amountCents: a.amount_cents, dealerSaysRemovable: a.dealer_says_removable })),
                fees: payload.fees.map((f) => ({ kind: f.kind, label: f.label, amountCents: f.amount_cents })),
                deliveryCents: payload.delivery_estimate_status === "provided" ? payload.delivery_estimate_cents ?? null : null,
                otd: payload.otd_total_cents != null ? { totalCents: payload.otd_total_cents, source: "dealer_quote" } : null,
              }}
            />
            {payload.otd_total_cents == null && <p className="mt-2 text-xs text-zinc-400">Out-the-door quote requested</p>}
          </div>
        </div>
        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">What the customer wants</h2>
          <dl className="mt-2 space-y-2 text-sm">
            <div><dt className="text-xs text-zinc-500">{D.sidebarTrims}</dt><dd className="text-zinc-200">{trimLabel}</dd></div>
            {(["exterior_color", "interior", "feature"] as const).map((cat) => {
              const list = rankedOf(cat);
              if (list.length === 0) return null;
              return (
                <div key={cat}>
                  <dt className="text-xs text-zinc-500">{D.sidebarCategory[cat]}</dt>
                  <dd className="text-zinc-200">{list.map((s) => displayOptionName(s.selection)).join(" · ")}</dd>
                </div>
              );
            })}
          </dl>
        </div>
        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Other offers on this search</h2>
          {props.otherOffers.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">{D.noOtherOffers}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
              {props.otherOffers.map((o) => (
                <li key={o.id}>
                  {o.dealerName} · {D.status[o.status] ?? o.status} · {o.otdTotalCents != null ? `Out-the-door ${money(o.otdTotalCents)}` : o.otdRequested ? "Out-the-door requested" : D.noOtdLine}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

/** ✓ / Check: listed as {colour} / not their pick (Brett, 2026-10-30), on the picker and step 2. */
function ColourMark({ colour, picks, className = "ml-1" }: { colour: string | null; picks: string[]; className?: string }) {
  const m = colourMatch(colour, picks);
  if (!m || !colour) return null;
  if (m === "match") return <span className={`${className} text-emerald-400`}>{COLOUR_MARK.match}</span>;
  if (m === "check") return <span className={`${className} text-amber-400`}>{COLOUR_MARK.check(colour.trim())}</span>;
  return <span className={`${className} text-zinc-400`}>{COLOUR_MARK.notPick}</span>;
}
