"use client";

import {
  combinationId,
  groupIntoPackages,
  type ConfiguratorQuestions,
  type ConfiguratorSelection,
  type PrioritizedCombinations,
  type RealCombination,
} from "@/lib/configurator-matching";
import { ColorDot, RankingQuestion, Thumb, type RankableItem } from "@/components/ranking-question";

// The combinations step (combination-preferences Phase 3, 2026-09-17) --
// the union-scoped ranking upstream (trim, exterior colour, interior,
// seating) no longer pins down one exact car once colour/interior/feature
// answers validate against a ranked-trim UNION rather than a single trim:
// "LE #1, Ocean Gem #1, Cockpit Red leather #1" can describe a combination
// no real trim actually offers. This step lets the customer refine among
// the REAL (trim, colour, interior, seating) tuples their own rankings
// produce -- see computeRealCombinations/prioritizeCombinations in
// configurator-matching.ts (Phase 2) for the enumeration/ordering logic
// this component only ever renders, never recomputes.
//
// FEATURES NEVER FORK THIS LIST -- they attach as display-only pills per
// card, exactly per the standing constraint from Phase 1 planning. A
// combination's identity is (trim, colour, interior, seating) only.

interface FeaturePill {
  tone: "amber" | "gray";
  text: string;
}

/**
 * Cross-references the customer's global feature/package selections
 * (wanted / excluded, independent of any one combination) against THIS
 * combination's specific trim, to flag the three cases a customer needs to
 * know before ranking a combination:
 *
 *   - wanted, but neither standard nor obtainable here -> amber, this
 *     trim genuinely cannot be built with it.
 *   - excluded, but standard here -> amber, the trim includes it whether
 *     they want it or not.
 *   - obtainable here, and the customer never said anything about it ->
 *     muted, purely informational.
 *
 * A wanted feature/package that IS obtainable here (standalone/
 * package_only) gets no pill at all -- it's a real, addressable option on
 * this trim, not a conflict worth flagging on the combination card itself.
 *
 * Package-label granularity (2026-09-18, features-become-ranked-packages)
 * -- `selections` now carries package labels, not raw feature names, so
 * `obtainableNames` is grouped the same way via groupIntoPackages. This is
 * the ONLY change this function needed: `standardNames` (from
 * `featuresStandard`, untouched by grouping) still works correctly
 * unchanged, because a genuine multi-item package can never legitimately
 * BE 'standard' -- package_only existing at all means it's not included by
 * default, so the "excluded but standard" check only ever fires for a
 * standalone single-item package, where the selection value already
 * equals the raw feature name `standardNames` holds.
 */
function featurePillsFor(
  q: ConfiguratorQuestions,
  selections: ConfiguratorSelection[],
): FeaturePill[] {
  const standardNames = new Set(q.featuresStandard);
  const obtainableNames = new Set(groupIntoPackages(q.features).map((c) => c.name));
  const featureSelections = selections.filter((s) => s.category === "feature");
  const touchedNames = new Set(featureSelections.map((s) => s.selection));

  const pills: FeaturePill[] = [];
  for (const s of featureSelections) {
    if (!s.excluded) {
      if (!standardNames.has(s.selection) && !obtainableNames.has(s.selection)) {
        pills.push({ tone: "amber", text: `Doesn't include: ${s.selection}` });
      }
    } else if (standardNames.has(s.selection)) {
      pills.push({ tone: "amber", text: `Includes ${s.selection} (can't be removed on this trim)` });
    }
  }
  for (const name of obtainableNames) {
    if (!touchedNames.has(name)) {
      pills.push({ tone: "gray", text: `Also available: ${name}` });
    }
  }
  return pills;
}

function PillRow({ pills }: { pills: FeaturePill[] }) {
  if (pills.length === 0) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {pills.map((p, i) => (
        <span
          key={i}
          className={
            p.tone === "amber"
              ? "rounded-full border border-amber-500/40 bg-amber-500/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-amber-300"
              : "rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-medium text-zinc-500"
          }
        >
          {p.text}
        </span>
      ))}
    </span>
  );
}

/**
 * One combination, as a RankableItem. The exterior colour's photo/swatch
 * ride in the item's own imageUrl/swatch slot -- rendered automatically by
 * RankingQuestion, identical to every other ranked category. The interior
 * gets a SECOND swatch/photo pair, via the same exported Thumb/ColorDot,
 * rendered explicitly in `detail` since RankableItem only has one built-in
 * icon slot.
 */
function toItem(
  combo: RealCombination,
  configuratorQuestions: Record<string, ConfiguratorQuestions>,
  selections: ConfiguratorSelection[],
): RankableItem {
  const q = configuratorQuestions[combo.trimId];
  const colorChoice = combo.exteriorColor
    ? (q?.exteriorColorRaw.find((c) => c.name === combo.exteriorColor) ?? null)
    : null;
  const interiorChoice = combo.interior
    ? (q?.interiorRaw.find((c) => c.name === combo.interior) ?? null)
    : null;

  const colorLabel = combo.exteriorColor ?? "No preference";
  const interiorLabel = combo.interior ?? "No preference";
  // Seating shown only when it's a genuine value -- null means the
  // category was never a real question across the ranked union (an
  // implicit "no preference" placeholder, not something worth printing on
  // every single card when it never varies).
  const label = `${combo.trim} — ${colorLabel} / ${interiorLabel}${combo.seating ? ` / ${combo.seating}` : ""}`;

  const pills = q ? featurePillsFor(q, selections) : [];
  const hasInteriorSwatch = !!(interiorChoice?.imageUrl || interiorChoice?.swatch);

  return {
    id: combinationId(combo),
    label,
    imageUrl: colorChoice?.imageUrl ?? null,
    swatch: colorChoice?.swatch ?? null,
    detail: (
      <>
        {hasInteriorSwatch && (
          <span className="mt-1 flex items-center gap-1.5">
            <Thumb item={{ id: "interior", label: "", imageUrl: interiorChoice?.imageUrl ?? null }} />
            <ColorDot item={{ id: "interior", label: "", swatch: interiorChoice?.swatch ?? null }} />
            <span className="text-[11px] text-zinc-500">interior</span>
          </span>
        )}
        <PillRow pills={pills} />
      </>
    ),
  };
}

export function CombinationsQuestion({
  prioritized,
  ranked,
  excluded,
  onChange,
  configuratorQuestions,
  selections,
  showAll,
  onShowMore,
}: {
  prioritized: PrioritizedCombinations;
  /** Combination ids, in the customer's order. */
  ranked: string[];
  /** Combination ids the customer refused. */
  excluded: string[];
  onChange: (ranked: string[], excluded: string[]) => void;
  configuratorQuestions: Record<string, ConfiguratorQuestions>;
  selections: ConfiguratorSelection[];
  /** Whether the display cap has been lifted from 5 to the full (<=10)
   *  prioritized set -- lives in the parent so it survives this
   *  component re-rendering, same as every other piece of step state. */
  showAll: boolean;
  onShowMore: () => void;
}) {
  const visibleCount = showAll
    ? prioritized.visible.length
    : Math.min(prioritized.initialCount, prioritized.visible.length);
  const shown = prioritized.visible.slice(0, visibleCount);
  const items = shown.map((c) => toItem(c, configuratorQuestions, selections));

  const moreToReveal = prioritized.visible.length - visibleCount;
  const cappedBeyondDisplay = prioritized.totalReal - prioritized.visible.length;

  return (
    <div>
      <RankingQuestion
        title="Which combinations work for you?"
        subtitle="These are the real cars your rankings actually produce -- trim, color and interior together. Rank the ones you'd take, or exclude any you wouldn't."
        items={items}
        ranked={ranked}
        excluded={excluded}
        onChange={onChange}
      />
      {!showAll && moreToReveal > 0 && (
        <button
          type="button"
          onClick={onShowMore}
          className="mt-4 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
        >
          Show more ({moreToReveal} more of {prioritized.totalReal})
        </button>
      )}
      {showAll && cappedBeyondDisplay > 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          Showing your top {prioritized.visible.length} of {prioritized.totalReal} real combinations.
        </p>
      )}
    </div>
  );
}
