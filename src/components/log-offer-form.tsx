"use client";

import { useState, type FormEvent } from "react";
import { logQualifyingOffer } from "@/lib/outreach-actions";
import { parseDealerOffer } from "@/lib/offer-parsing-actions";
import type { OutreachListing } from "@/lib/outreach-queue";

interface AddonLine {
  description: string;
  amount: string;
}

type ParseMode = "text" | "pdf";

// Listings can store ZIP+4 ("67202-1234"), which failed the 5-digit ZIP
// check and blocked the whole save (reproduced 2026-09-25). Keep the 5-digit
// ZIP; anything unrecognizable is left as-is so the agent sees the
// validation message rather than a silently wrong value.
function fiveDigitZip(zip: string | null): string {
  const trimmed = (zip ?? "").trim();
  const match = /^(\d{5})(?:-?\d{4})?$/.exec(trimmed);
  return match ? match[1] : trimmed;
}

export function LogOfferForm({ searchId, listings }: { searchId: string; listings: OutreachListing[] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [dealerName, setDealerName] = useState("");
  const [dealerContact, setDealerContact] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [msrp, setMsrp] = useState("");
  // Both optional -- feed the customer-facing offer card's photo/value
  // display. Pre-filled from a selected listing below when available, same
  // as dealerName/offerPrice/msrp already are; otherwise left for the
  // agent to type in if known, or left blank.
  const [vehicleTrim, setVehicleTrim] = useState("");
  const [vehicleExteriorColor, setVehicleExteriorColor] = useState("");
  // Also optional, copied onto the offer at log time and shown to the
  // customer in the offer detail view (address + distance, VIN, stock #).
  // Pre-filled from a selected listing; typed otherwise.
  const [dealerStreet, setDealerStreet] = useState("");
  const [dealerCity, setDealerCity] = useState("");
  const [dealerState, setDealerState] = useState("");
  const [dealerZip, setDealerZip] = useState("");
  const [vin, setVin] = useState("");
  const [stockNumber, setStockNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [addons, setAddons] = useState<AddonLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  // AI-parse step -- pre-fills the fields above, nothing persists until the
  // agent reviews/edits and clicks "Save offer" below. The PDF file (if
  // used) stays in this component's state through parsing and is sent again
  // on final submit -- it's never uploaded anywhere until the offer is
  // actually saved.
  const [parseMode, setParseMode] = useState<ParseMode>("text");
  const [rawText, setRawText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  function handleListingSelect(id: string) {
    setSelectedListingId(id);
    const listing = listings.find((l) => l.id === id);
    if (listing) {
      setDealerName(listing.dealerName ?? "");
      setDealerContact(listing.dealerPhone ?? "");
      if (listing.priceCents != null) setOfferPrice((listing.priceCents / 100).toString());
      if (listing.msrpCents != null) setMsrp((listing.msrpCents / 100).toString());
      if (listing.trim) setVehicleTrim(listing.trim);
      if (listing.color) setVehicleExteriorColor(listing.color);
      setDealerStreet(listing.dealerStreet ?? "");
      setDealerCity(listing.dealerCity ?? "");
      setDealerState(listing.dealerState ?? "");
      setDealerZip(fiveDigitZip(listing.dealerZip));
      setVin(listing.vin ?? "");
      setStockNumber(listing.stockNumber ?? "");
    }
  }

  function resetForm() {
    setSelectedListingId("");
    setDealerName("");
    setDealerContact("");
    setOfferPrice("");
    setMsrp("");
    setVehicleTrim("");
    setVehicleExteriorColor("");
    setDealerStreet("");
    setDealerCity("");
    setDealerState("");
    setDealerZip("");
    setVin("");
    setStockNumber("");
    setNotes("");
    setAddons([]);
    setRawText("");
    setPdfFile(null);
    setParseError(null);
  }

  async function handleParse() {
    setParsing(true);
    setParseError(null);

    const fd = new FormData();
    if (parseMode === "pdf" && pdfFile) {
      fd.set("pdf", pdfFile);
    } else {
      fd.set("raw_text", rawText);
    }

    const res = await parseDealerOffer(fd);
    setParsing(false);

    if (!res.ok) {
      setParseError(res.error);
      return;
    }

    const { parsed } = res;
    if (parsed.dealerName) setDealerName(parsed.dealerName);
    if (parsed.dealerContact) setDealerContact(parsed.dealerContact);
    if (parsed.offerPriceCents != null) setOfferPrice((parsed.offerPriceCents / 100).toString());
    if (parsed.addons.length > 0) {
      setAddons(parsed.addons.map((a) => ({ description: a.description, amount: (a.amountCents / 100).toString() })));
    }
  }

  function updateAddon(index: number, field: keyof AddonLine, value: string) {
    setAddons((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function removeAddon(index: number) {
    setAddons((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const addonsPayload = addons
      .filter((a) => a.description.trim() && a.amount)
      .map((a) => ({ description: a.description.trim(), amountCents: Math.round(parseFloat(a.amount) * 100) }));

    const formData = new FormData();
    formData.set("customer_search_id", searchId);
    formData.set("listing_id", selectedListingId);
    formData.set("dealer_name", dealerName);
    formData.set("dealer_contact", dealerContact);
    formData.set("offer_price", offerPrice);
    formData.set("msrp", msrp);
    formData.set("vehicle_trim", vehicleTrim);
    formData.set("vehicle_exterior_color", vehicleExteriorColor);
    formData.set("dealer_street", dealerStreet);
    formData.set("dealer_city", dealerCity);
    formData.set("dealer_state", dealerState);
    formData.set("dealer_zip", dealerZip);
    formData.set("vin", vin);
    formData.set("stock_number", stockNumber);
    formData.set("notes", notes);
    formData.set("addons_json", JSON.stringify(addonsPayload));
    if (parseMode === "pdf" && pdfFile) {
      formData.set("offer_sheet_pdf", pdfFile);
    }

    const res = await logQualifyingOffer(formData);
    setResult(res);
    setSubmitting(false);

    if (res.ok) {
      resetForm();
      setExpanded(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5"
      >
        + Log an offer
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
        <p className="text-xs font-semibold text-zinc-300">Parse a dealer reply with AI (optional)</p>
        <div className="mt-2 flex gap-3 text-xs text-zinc-400">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={parseMode === "text"}
              onChange={() => setParseMode("text")}
            />
            Paste text
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={parseMode === "pdf"}
              onChange={() => setParseMode("pdf")}
            />
            Upload PDF
          </label>
        </div>

        {parseMode === "text" ? (
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={4}
            placeholder="Paste the dealer's email reply or your call notes…"
            className="mt-2 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        ) : (
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="mt-2 w-full text-sm text-zinc-300"
          />
        )}

        <button
          type="button"
          onClick={handleParse}
          disabled={parsing || (parseMode === "text" ? !rawText.trim() : !pdfFile)}
          className="mt-2 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
        >
          {parsing ? "Parsing…" : "Parse with AI"}
        </button>
        {parseError && <p className="mt-2 text-xs text-red-400">{parseError}</p>}
        <p className="mt-2 text-xs text-zinc-500">
          Only pre-fills the fields below — review and edit before saving. MSRP is never parsed; enter it
          yourself.
        </p>
      </div>

      {listings.length > 0 && (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
          <label className="block text-xs font-semibold text-zinc-200">Link the dealer&apos;s listing (recommended)</label>
          <p className="mt-0.5 text-xs text-zinc-500">
            Pre-fills the dealer, price, address, VIN and stock number, and is the only way the customer&apos;s
            offer detail can show real photos of this exact car.
          </p>
          <select
            value={selectedListingId}
            onChange={(e) => handleListingSelect(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            <option value="">— none —</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.year} {l.trim ?? ""} {l.color ?? ""} — {l.dealerName ?? "unknown dealer"} —{" "}
                {l.priceCents != null ? `$${(l.priceCents / 100).toLocaleString()}` : "no price"}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400">Dealer name *</label>
          <input
            required
            value={dealerName}
            onChange={(e) => setDealerName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400">Dealer contact</label>
          <input
            value={dealerContact}
            onChange={(e) => setDealerContact(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400">Offer price ($) *</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400">MSRP ($) *</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={msrp}
            onChange={(e) => setMsrp(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400">Vehicle trim (optional)</label>
          <input
            value={vehicleTrim}
            onChange={(e) => setVehicleTrim(e.target.value)}
            placeholder="e.g. XSE"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400">Exterior color (optional)</label>
          <input
            value={vehicleExteriorColor}
            onChange={(e) => setVehicleExteriorColor(e.target.value)}
            placeholder="e.g. Supersonic Red"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Trim/color feed the customer&apos;s offer card (a real photo when we have one for this
        make/model/color, otherwise a placeholder) — leave blank if not confirmed with the dealer yet.
      </p>

      <div>
        <p className="text-xs text-zinc-400">
          Dealer address, VIN &amp; stock # (optional — shown to the customer in the offer detail, with distance
          from their ZIP)
        </p>
        <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input
            value={dealerStreet}
            onChange={(e) => setDealerStreet(e.target.value)}
            placeholder="Street"
            className="col-span-2 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
          <input
            value={dealerCity}
            onChange={(e) => setDealerCity(e.target.value)}
            placeholder="City"
            className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
          <div className="flex gap-2">
            <input
              value={dealerState}
              onChange={(e) => setDealerState(e.target.value)}
              placeholder="ST"
              maxLength={2}
              className="w-14 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <input
              value={dealerZip}
              onChange={(e) => setDealerZip(e.target.value)}
              placeholder="ZIP"
              inputMode="numeric"
              pattern="[0-9]{5}"
              title="5-digit ZIP"
              maxLength={5}
              className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            placeholder="VIN"
            className="col-span-2 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
          <input
            value={stockNumber}
            onChange={(e) => setStockNumber(e.target.value)}
            placeholder="Stock #"
            className="col-span-2 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs text-zinc-400">Itemized add-ons (optional)</label>
          <button
            type="button"
            onClick={() => setAddons((prev) => [...prev, { description: "", amount: "" }])}
            className="text-xs text-emerald-400 underline hover:text-emerald-300"
          >
            + Add line
          </button>
        </div>
        {addons.map((a, i) => (
          <div key={i} className="mt-2 flex gap-2">
            <input
              placeholder="Description"
              value={a.description}
              onChange={(e) => updateAddon(i, "description", e.target.value)}
              className="flex-1 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="$0.00"
              value={a.amount}
              onChange={(e) => updateAddon(i, "amount", e.target.value)}
              className="w-28 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => removeAddon(i)}
              className="rounded-md border border-white/10 px-2 text-xs text-zinc-400 hover:bg-white/5"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs text-zinc-400">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        />
      </div>

      {result?.error && <p className="text-sm text-red-400">{result.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save offer"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
