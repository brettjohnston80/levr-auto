"use client";

import { useState } from "react";
import { StarRating } from "@/components/star-rating";
import { submitPostDealSurvey } from "@/lib/survey-actions";

const DEALERSHIP_CRITERIA = [
  {
    key: "availability",
    label: "Availability follow-through",
    anchors: { 1: "Terms changed last minute", 3: "Minor changes, not communicated", 5: "Exactly as negotiated" },
  },
  {
    key: "responsiveness",
    label: "Responsiveness during closing",
    anchors: { 1: "Slow, needed repeated follow-up", 3: "Some delay, not unreasonable", 5: "Prompt, easy responses" },
  },
  {
    key: "transparency",
    label: "Transparency on final numbers",
    anchors: { 1: "Surprise fees added", 3: "Minor discrepancy, resolved", 5: "Matched exactly, no surprises" },
  },
  {
    key: "financePressure",
    label: "Finance office experience",
    anchors: { 1: "Heavy, repeated pressure", 3: "Some upsell, backed off", 5: "No pressure" },
  },
  {
    key: "professionalism",
    label: "Overall professionalism",
    anchors: { 1: "Rude or dismissive", 3: "Mostly fine, a few rough moments", 5: "Consistently professional" },
  },
] as const;

type CriterionKey = (typeof DEALERSHIP_CRITERIA)[number]["key"];

export function PostDealSurveyForm({
  surveyId,
  vehicleLabel,
  dealerName,
}: {
  surveyId: string;
  vehicleLabel: string;
  dealerName: string;
}) {
  const [dealershipRatings, setDealershipRatings] = useState<Record<CriterionKey, number | null>>({
    availability: null,
    responsiveness: null,
    transparency: null,
    financePressure: null,
    professionalism: null,
  });
  const [agentRecommend, setAgentRecommend] = useState<boolean | null>(null);
  const [agentComment, setAgentComment] = useState("");
  const [levrOverallRating, setLevrOverallRating] = useState<number | null>(null);
  const [levrOverallComment, setLevrOverallComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const allDealershipRated = DEALERSHIP_CRITERIA.every((c) => dealershipRatings[c.key] !== null);
  const canSubmit = allDealershipRated && agentRecommend !== null && levrOverallRating !== null;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const result = await submitPostDealSurvey({
      surveyId,
      dealershipAvailabilityRating: dealershipRatings.availability!,
      dealershipResponsivenessRating: dealershipRatings.responsiveness!,
      dealershipTransparencyRating: dealershipRatings.transparency!,
      dealershipFinancePressureRating: dealershipRatings.financePressure!,
      dealershipProfessionalismRating: dealershipRatings.professionalism!,
      agentRecommend: agentRecommend!,
      agentComment,
      levrOverallRating: levrOverallRating!,
      levrOverallComment,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-10 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">
          ✓
        </span>
        <h1 className="mt-6 text-2xl font-semibold text-white">Thanks for the feedback.</h1>
        <p className="mt-3 text-sm text-zinc-400">It genuinely helps us do right by the next customer.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">How was your experience?</h1>
      <p className="mt-2 text-sm text-zinc-400">
        On your {vehicleLabel} purchase with {dealerName}.
      </p>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Dealership experience</h2>
        <div className="mt-6 space-y-6">
          {DEALERSHIP_CRITERIA.map((c) => (
            <div key={c.key}>
              <p className="text-sm font-medium text-white">{c.label}</p>
              <div className="mt-2">
                <StarRating
                  value={dealershipRatings[c.key]}
                  onChange={(v) => setDealershipRatings((prev) => ({ ...prev, [c.key]: v }))}
                  anchors={c.anchors}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Your LEVR agent</h2>
        <p className="mt-1 text-xs text-zinc-500">Internal only — never shared with the dealership.</p>
        <p className="mt-4 text-sm font-medium text-white">Would you recommend your LEVR agent to a friend?</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setAgentRecommend(true)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              agentRecommend === true ? "bg-emerald-500 text-zinc-950" : "border border-white/15 text-zinc-300 hover:bg-white/5"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setAgentRecommend(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              agentRecommend === false ? "bg-emerald-500 text-zinc-950" : "border border-white/15 text-zinc-300 hover:bg-white/5"
            }`}
          >
            No
          </button>
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Comment (optional)</span>
          <textarea
            value={agentComment}
            onChange={(e) => setAgentComment(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">LEVR Auto overall</h2>
        <div className="mt-4">
          <StarRating value={levrOverallRating} onChange={setLevrOverallRating} />
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Comment (optional)</span>
          <textarea
            value={levrOverallComment}
            onChange={(e) => setLevrOverallComment(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="mt-8 w-full rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
      {!canSubmit && <p className="mt-3 text-center text-xs text-zinc-500">Answer everything above to submit.</p>}
    </div>
  );
}
