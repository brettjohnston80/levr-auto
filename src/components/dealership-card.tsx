"use client";

import { useState } from "react";
import type { ConfirmedDealership, DealershipSalesperson } from "@/lib/dealership-queue";
import { SalespersonForm } from "@/components/salesperson-form";
import { SalespersonRow } from "@/components/salesperson-row";

export function DealershipCard({ dealership }: { dealership: ConfirmedDealership }) {
  // Lifted local copy so add/edit/remove reflect immediately without a page
  // reload -- dealership.salespeople itself only refreshes on next
  // navigation, since revalidatePath alone doesn't re-render an already-
  // mounted client tree.
  const [salespeople, setSalespeople] = useState<DealershipSalesperson[]>(dealership.salespeople);
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-white">{dealership.name}</p>
          <p className="text-sm text-zinc-500">
            {[dealership.city, dealership.state].filter(Boolean).join(", ") || "No city/state on file"}
          </p>
        </div>
        <span className="text-xs text-zinc-400">
          {dealership.listingCount} listing{dealership.listingCount === 1 ? "" : "s"}
        </span>
      </div>

      {dealership.aliases.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Known as</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {dealership.aliases.map((a) => (
              <span key={a.id} className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-400">
                {a.dealerName}
                {a.confirmedVia === "system" && <span className="ml-1 text-emerald-400">· Auto-matched</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Salespeople</p>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded border border-white/15 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/5"
            >
              Add salesperson
            </button>
          )}
        </div>

        {salespeople.length === 0 && !adding && <p className="mt-2 text-sm text-zinc-500">No salespeople on file.</p>}

        <div className="mt-2 space-y-2">
          {salespeople.map((s) => (
            <SalespersonRow
              key={s.id}
              dealershipId={dealership.id}
              salesperson={s}
              onUpdated={(updated) => setSalespeople((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
              onRemoved={(id) => setSalespeople((prev) => prev.filter((p) => p.id !== id))}
            />
          ))}
        </div>

        {adding && (
          <div className="mt-2">
            <SalespersonForm
              dealershipId={dealership.id}
              onSaved={(created) => {
                setSalespeople((prev) => [...prev, created]);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
