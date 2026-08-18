// Purchased celebratory copy locked by Brett, 2026-08-17 -- do not revise
// without re-opening. Renders in place of the normal offer-tracking UI on
// SearchCard once search_status = 'purchased' (agent-marked during
// deal-close, see mark-purchased-button.tsx). No video links -- confirmed
// out of scope, no real Matchmaker review-video data exists anywhere to
// show (see plan.md).
export function PurchasedCelebration({
  make,
  model,
  trim,
}: {
  make: string;
  model: string;
  trim: string | null;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
      <p className="text-lg font-semibold text-white">Congratulations on your new {make} {model}!</p>
      <p className="mt-3 text-sm text-zinc-300">
        This search is complete — your {make} {model}
        {trim ? `, ${trim}` : ""} is officially yours. Thanks for letting LEVR Auto handle the
        negotiating.
      </p>
      <p className="mt-3 text-sm text-zinc-400">
        Looking for another car down the road? Log back in anytime to start a fresh search.
      </p>
    </div>
  );
}
