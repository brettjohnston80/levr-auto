"use client";

import {
  combinationId,
  groupIntoPackages,
  type ConfiguratorChoice,
  type ConfiguratorQuestions,
  type ConfiguratorSelection,
  type PrioritizedCombinations,
  type RealCombination,
} from "@/lib/configurator-matching";
import type { TrimOption } from "@/lib/finalize-trims";
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
 *
 * `trimLabel` names the specific trim this card is for (2026-09-20) --
 * every combination card is already exactly one trim, so a customer
 * comparing several cards side by side needs the amber "wanted but
 * missing" pill to say WHICH trim lacks it, not a bare feature name with
 * no context. Pure wording -- `q` was already this card's own trim's
 * ConfiguratorQuestions, the pill just never said so.
 */
function featurePillsFor(
  q: ConfiguratorQuestions,
  selections: ConfiguratorSelection[],
  trimLabel: string,
): FeaturePill[] {
  const standardNames = new Set(q.featuresStandard);
  const obtainableNames = new Set(groupIntoPackages(q.features).map((c) => c.name));
  const featureSelections = selections.filter((s) => s.category === "feature");
  const touchedNames = new Set(featureSelections.map((s) => s.selection));

  const pills: FeaturePill[] = [];
  for (const s of featureSelections) {
    if (!s.excluded) {
      if (!standardNames.has(s.selection) && !obtainableNames.has(s.selection)) {
        pills.push({ tone: "amber", text: `${s.selection} not available on ${trimLabel}` });
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

function formatCents(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/**
 * Real extra cost of ONE choice, in cents -- 0 for standard/included/free,
 * else the real researched number. Deliberately a small local twin of
 * trim-comparison.ts's priceCellFor (same three-way availability branch),
 * not a shared import: that function returns a DISPLAY cell (text+tone)
 * for a table, this one returns a number to SUM -- forcing both through
 * one shape would need an awkward unwrap on one side or the other for a
 * six-line branch that's cheap to keep in sync by eye.
 */
function extraCostCentsFor(choice: ConfiguratorChoice | null | undefined): number {
  if (!choice) return 0;
  if (choice.availability === "standard") return 0;
  if (choice.availability === "package_only") return choice.packagePriceCents ?? 0;
  if (choice.priceIsIncluded) return 0;
  return choice.priceCents ?? 0;
}

/**
 * A real, honest ESTIMATE (2026-09-20) -- anchored to this trim's
 * cheapest real synced listing (TrimOption.minPriceCents), since finalize
 * has no single VIN to price exactly; real dealer pricing varies per
 * unit. Adds the combination's own colour and interior extra cost
 * (0 for a standard/included choice, same rule priceCellFor already
 * uses), plus every feature/package the customer WANTS (not excluded)
 * that this specific trim can actually build -- the same
 * obtainable-and-wanted set featurePillsFor's own "no pill" case already
 * represents silently, now given a real dollar value instead of nothing.
 * A wanted-but-not-obtainable-here feature (the amber pill) contributes
 * nothing -- it isn't a real cost on THIS trim. Returns null only when
 * the trim itself has no real inventory price at all, never a silent $0.
 */
function estimatedPriceCentsFor(
  combo: RealCombination,
  trimOption: TrimOption | undefined,
  q: ConfiguratorQuestions | undefined,
  selections: ConfiguratorSelection[],
): number | null {
  if (!trimOption || trimOption.minPriceCents == null) return null;

  const colorChoice = combo.exteriorColor
    ? (q?.exteriorColorRaw.find((c) => c.name === combo.exteriorColor) ?? null)
    : null;
  const interiorChoice = combo.interior
    ? (q?.interiorRaw.find((c) => c.name === combo.interior) ?? null)
    : null;

  let total = trimOption.minPriceCents + extraCostCentsFor(colorChoice) + extraCostCentsFor(interiorChoice);

  if (q) {
    const obtainableByName = new Map(groupIntoPackages(q.features).map((c) => [c.name, c]));
    for (const s of selections) {
      if (s.category !== "feature" || s.excluded) continue;
      total += extraCostCentsFor(obtainableByName.get(s.selection));
    }
  }

  return total;
}

/**
 * One combination, as a RankableItem. BOTH swatch/photo pairs -- exterior
 * and interior -- render explicitly in `detail`, stacked vertically
 * (2026-09-20), rather than exterior riding in RankableItem's own built-in
 * leading-icon slot with interior below the label: a combination card is
 * comparing two colour decisions at once, and putting one to the row's
 * left and the other under the label read as unrelated rather than as a
 * pair. Neither goes in the built-in slot here (imageUrl/swatch both
 * null) so nothing double-renders.
 */
function toItem(
  combo: RealCombination,
  configuratorQuestions: Record<string, ConfiguratorQuestions>,
  selections: ConfiguratorSelection[],
  trimOptionsById: Map<string, TrimOption>,
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

  const pills = q ? featurePillsFor(q, selections, combo.trim) : [];
  const hasColorSwatch = !!(colorChoice?.imageUrl || colorChoice?.swatch);
  const hasInteriorSwatch = !!(interiorChoice?.imageUrl || interiorChoice?.swatch);
  const estimatedPriceCents = estimatedPriceCentsFor(
    combo,
    trimOptionsById.get(combo.trimId),
    q,
    selections,
  );

  return {
    id: combinationId(combo),
    label,
    imageUrl: null,
    swatch: null,
    detail: (
      <>
        {estimatedPriceCents != null && (
          <span className="block text-sm font-semibold text-emerald-400">
            {formatCents(estimatedPriceCents)} est.
          </span>
        )}
        {(hasColorSwatch || hasInteriorSwatch) && (
          <span className="mt-1 flex flex-col gap-1.5">
            {hasColorSwatch && (
              <span className="flex items-center gap-1.5">
                <Thumb item={{ id: "exterior", label: colorLabel, imageUrl: colorChoice?.imageUrl ?? null }} />
                <ColorDot item={{ id: "exterior", label: "", swatch: colorChoice?.swatch ?? null }} />
                <span className="text-[11px] text-zinc-500">exterior</span>
              </span>
            )}
            {hasInteriorSwatch && (
              <span className="flex items-center gap-1.5">
                <Thumb item={{ id: "interior", label: interiorLabel, imageUrl: interiorChoice?.imageUrl ?? null }} />
                <ColorDot item={{ id: "interior", label: "", swatch: interiorChoice?.swatch ?? null }} />
                <span className="text-[11px] text-zinc-500">interior</span>
              </span>
            )}
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
  trimOptions,
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
  /** Real synced-inventory pricing per trim (2026-09-20) -- the anchor for
   *  each combination card's estimated price, see estimatedPriceCentsFor. */
  trimOptions: TrimOption[];
  /** Whether the display cap has been lifted from 5 to the full (<=10)
   *  prioritized set -- lives in the parent so it survives this
   *  component re-rendering, same as every other piece of step state. */
  showAll: boolean;
  onShowMore: () => void;
}) {
  const trimOptionsById = new Map(trimOptions.map((o) => [o.id, o]));
  const visibleCount = showAll
    ? prioritized.visible.length
    : Math.min(prioritized.initialCount, prioritized.visible.length);
  const shown = prioritized.visible.slice(0, visibleCount);
  const items = shown.map((c) => toItem(c, configuratorQuestions, selections, trimOptionsById));

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
