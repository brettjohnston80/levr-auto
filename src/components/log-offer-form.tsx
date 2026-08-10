"use client";

import { useState, type FormEvent } from "react";
import { logQualifyingOffer } from "@/lib/outreach-actions";
import type { OutreachListing } from "@/lib/outreach-queue";

export function LogOfferForm({ searchId, listings }: { searchId: string; listings: OutreachListing[] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [dealerName, setDealerName] = useState("");
  const [dealerContact, setDealerContact] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [msrp, setMsrp] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  function handleListingSelect(id: string) {
    setSelectedListingId(id);
    const listing = listings.find((l) => l.id === id);
    if (listing) {
      setDealerName(listing.dealerName ?? "");
      setDealerContact(listing.dealerPhone ?? "");
      if (listing.priceCents != null) setOfferPrice((listing.priceCents / 100).toString());
      if (listing.msrpCents != null) setMsrp((listing.msrpCents / 100).toString());
    }
  }

  function resetForm() {
    setSelectedListingId("");
    setDealerName("");
    setDealerContact("");
    setOfferPrice("");
    setMsrp("");
    setNotes("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const formData = new FormData();
    formData.set("customer_search_id", searchId);
    formData.set("listing_id", selectedListingId);
    formData.set("dealer_name", dealerName);
    formData.set("dealer_contact", dealerContact);
    formData.set("offer_price", offerPrice);
    formData.set("msrp", msrp);
    formData.set("notes", notes);

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
      {listings.length > 0 && (
        <div>
          <label className="block text-xs text-zinc-400">Pre-fill from a known listing (optional)</label>
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
