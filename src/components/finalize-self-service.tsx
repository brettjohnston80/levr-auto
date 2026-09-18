"use client";

import { useState } from "react";
import { COLORS, OPTIONS } from "@/lib/vehicle-data";
import { finalizeSelfService } from "@/lib/finalize-actions";
import type { TrimOption } from "@/lib/finalize-trims";
import {
  categoryHasRealChoiceAcrossTrims,
  combinationId,
  comparePriceDescending,
  computeCategoryAvailability,
  computeRealCombinations,
  matchesNaturalPriceOrder,
  prioritizeCombinations,
  type CombinationPreference,
  type ConfiguratorChoice,
  type ConfiguratorQuestions,
  type ConfiguratorSelection,
  type TrimPreference,
} from "@/lib/configurator-matching";
import {
  FeatureQuestion,
  RankedQuestion,
  SelectionSummary,
} from "@/components/configurator-questions";
import { CombinationsQuestion } from "@/components/combinations-question";
import { RankingQuestion } from "@/components/ranking-question";
import { TrimComparisonModal } from "@/components/trim-comparison-modal";
import { TrimDetailModal } from "@/components/trim-detail-modal";
import { hasAtLeastOneRanked } from "@/lib/ranked-list";

type Step =
  | "trim"
  | "color"
  | "options"
  | "exteriorColor"
  | "interior"
  | "seating"
  | "features"
  | "combinations"
  | "review";

const STEP_LABELS: Record<Step, string> = {
  trim: "trim",
  color: "color",
  options: "options",
  exteriorColor: "color",
  interior: "interior",
  seating: "seating",
  features: "features",
  combinations: "combinations",
  review: "review",
};

function formatCents(cents: number | null): string {
  if (cents == null) return "";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

// The "in-depth, built off Matchmaker" post-payment finalization flow (Step
// 5 of the pending-pivot's "Full flow") -- same step-at-a-time interactive
// pattern as components/matchmaker.tsx, but scoped to the make/model
// already paid for (trim/color/options) rather than open-ended vehicle
// discovery. Trim options come from real synced MarketCheck listings
// (finalize-trims.ts), not mock data.
//
// TWO PATHS THROUGH THE SAME COMPONENT (step 7 of 9). When the chosen trim
// resolves to exactly one researched configurator build, the generic
// colour/options steps are replaced by real questions about that specific
// car -- the colours it can actually be built in, at their real prices,
// with package contents spelled out. When it does not resolve -- no live
// batch, a make with no configurator data, or an ambiguous trim -- the
// flow is byte-for-byte what it has always been. The fallback is the
// common case by a wide margin and is never degraded to make room for the
// rich one.
export function FinalizeSelfService({
  searchId,
  make,
  model,
  trimOptions,
  configuratorQuestions,
  modelYear,
}: {
  searchId: string;
  make: string;
  model: string;
  trimOptions: TrimOption[];
  configuratorQuestions: Record<string, ConfiguratorQuestions>;
  /**
   * The search's committed model year. When set, trimOptions have already
   * been filtered to it server-side, so every option shares this year.
   * Null on searches predating the required year.
   */
  modelYear: number | null;
}) {
  const [step, setStep] = useState<Step>("trim");
  // Trim is RANKED now, like every other category. Ids are TrimOption.id
  // (trim+year), not trim names, because two options can share a name
  // across model years and they are genuinely different cars.
  const [rankedTrimIds, setRankedTrimIds] = useState<string[]>([]);
  const [excludedTrimIds, setExcludedTrimIds] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [selections, setSelections] = useState<ConfiguratorSelection[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Where to jump BACK to once the trim step is left via the "Add it"
  // quick-link (2026-09-17) -- null means "no detour in progress", so the
  // trim step's own Next button falls through to its normal sequential
  // behaviour. Set only by handleAddTrimFromAutoExcluded, cleared by
  // either using it (jumping back) or navigating away some other way
  // (breadcrumb click) -- a customer who explicitly picks a different step
  // mid-detour has abandoned the detour, not asked to resume it later.
  const [returnToStep, setReturnToStep] = useState<Step | null>(null);
  // Combination-preferences step (2026-09-17 Phase 3 UI, persisted via
  // writeCombinationPreferences as of 2026-09-19) -- local UI state here,
  // built from and saved back through buildCombinationPreferences() in
  // handleConfirm below.
  const [combinationRanked, setCombinationRanked] = useState<string[]>([]);
  const [combinationExcluded, setCombinationExcluded] = useState<string[]>([]);
  const [showAllCombinations, setShowAllCombinations] = useState(false);
  // Trim comparison view (2026-09-19) -- purely local UI state, same as
  // every other modal-open flag in this component. `detailTrimId` doubles
  // as "which trim the Details modal is open for" and "is it open at
  // all" (null = closed), same convention combinationRanked/Excluded's
  // sibling state already uses elsewhere in this file.
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [detailTrimId, setDetailTrimId] = useState<string | null>(null);

  const trimById = new Map(trimOptions.map((o) => [o.id, o]));
  const topTrimId = rankedTrimIds[0] ?? null;
  const effectiveTrim = (topTrimId && trimById.get(topTrimId)?.trim) || "";

  // ⚠ #1 STILL DECIDES WHETHER THE RICH FLOW RENDERS AT ALL -- that part is
  // deliberately UNCHANGED by the ranked-trim-union redesign. If the
  // customer's top choice doesn't resolve to a researched build (an
  // unmatched trim, or nothing ranked), the whole flow still falls back to
  // the generic colour/options steps below, even if a LOWER-ranked trim
  // would have resolved. Known, narrow scope boundary, not an oversight --
  // the redesign widens WHICH TRIMS' options count once the rich flow is
  // already showing, not whether it shows in the first place.
  const questions: ConfiguratorQuestions | null =
    (topTrimId && configuratorQuestions[topTrimId]) || null;

  // Every ranked trim that resolved to a real build (2026-09-16) -- the
  // per-CATEGORY step-visibility decision below is evaluated across all of
  // these, not just #1, using the exact same `categoryHasRealChoiceAcrossTrims`
  // the server's min-one-ranked engagement gate uses (finalize-actions.ts),
  // imported from the same shared file, so the two can't drift on which
  // categories are "worth asking" for this customer's current ranking.
  const rankedResolvedQuestions = rankedTrimIds
    .map((id) => configuratorQuestions[id])
    .filter((q): q is ConfiguratorQuestions => !!q);

  // Model-wide union + ranked-trim-union exclusion test (2026-09-16,
  // full-transparency redesign). "The model" is every trim already in
  // `configuratorQuestions` -- every real inventory-backed trim that
  // resolved to a researched build, whether ranked or not -- so a colour
  // exclusive to a trim the customer hasn't ranked yet still shows up,
  // auto-excluded, with a note naming the trim to add. Computed fresh on
  // every render from data already in props/state -- no new fetch, see
  // computeCategoryAvailability's own comment for why this is cheap.
  //
  // Hoisted above `steps` (2026-09-17) -- the combinations step's own
  // inclusion test needs trimDisplayNameById and rankedNamesFor too.
  const matchedTrimIds = trimOptions.map((o) => o.id).filter((id) => configuratorQuestions[id]);
  const trimDisplayNameById: Record<string, string> = Object.fromEntries(
    trimOptions.map((o) => [o.id, o.trim]),
  );

  // Name -> rank position, per category, for every RANKED (non-excluded)
  // answer currently held -- feeds computeCategoryAvailability's
  // "Previously ranked #N" note (2026-09-16, surgical re-validation). Only
  // cosmetic to which bucket a name lands in; see that function's own
  // comment.
  const rankedNamesFor = (category: ConfiguratorSelection["category"]): Map<string, number> => {
    const map = new Map<string, number>();
    for (const s of selections) {
      if (s.category === category && !s.excluded && s.rankPosition != null) {
        map.set(s.selection, s.rankPosition);
      }
    }
    return map;
  };

  // Combination preferences (2026-09-17, Phase 2/3) -- the real (trim,
  // colour, interior, seating) tuples the customer's CURRENT rankings
  // produce, scoped to categories/options they've already ranked (never
  // the model's full universe -- see computeRealCombinations's own
  // comment). Recomputed fresh every render, same as everything above;
  // feeds both the "combinations" step's auto-skip test below and its own
  // rendering.
  const realCombinations = questions
    ? computeRealCombinations(
        rankedTrimIds,
        configuratorQuestions,
        trimDisplayNameById,
        rankedNamesFor("exterior_color"),
        rankedNamesFor("interior"),
        rankedNamesFor("seating"),
      )
    : [];
  const prioritizedCombinations = prioritizeCombinations(realCombinations);

  const steps: Step[] = ["trim"];
  if (questions) {
    if (categoryHasRealChoiceAcrossTrims(rankedResolvedQuestions.flatMap((q) => q.exteriorColorRaw)))
      steps.push("exteriorColor");
    if (categoryHasRealChoiceAcrossTrims(rankedResolvedQuestions.flatMap((q) => q.interiorRaw)))
      steps.push("interior");
    if (categoryHasRealChoiceAcrossTrims(rankedResolvedQuestions.flatMap((q) => q.seatingRaw)))
      steps.push("seating");
    // Features has no ">1" threshold -- any real obtainable feature
    // anywhere in the ranked union is worth asking about, matching the
    // single-trim behaviour this replaces (features was never
    // atLeastTwo-gated either).
    if (rankedResolvedQuestions.some((q) => q.features.length > 0)) steps.push("features");
    // Auto-skip (2026-09-17): a single real combination means the
    // customer's own rankings already pin down one exact car -- there is
    // nothing left to choose between, so asking would be a statement, not
    // a question, same "atLeastTwo" spirit every other step here follows.
    if (prioritizedCombinations.totalReal > 1) steps.push("combinations");
  } else {
    steps.push("color", "options");
  }
  steps.push("review");

  const exteriorColorAvailability = computeCategoryAvailability(
    matchedTrimIds,
    rankedTrimIds,
    configuratorQuestions,
    (q) => q.exteriorColorRaw,
    trimDisplayNameById,
    rankedNamesFor("exterior_color"),
  );
  const interiorAvailability = computeCategoryAvailability(
    matchedTrimIds,
    rankedTrimIds,
    configuratorQuestions,
    (q) => q.interiorRaw,
    trimDisplayNameById,
    rankedNamesFor("interior"),
  );
  const seatingAvailability = computeCategoryAvailability(
    matchedTrimIds,
    rankedTrimIds,
    configuratorQuestions,
    (q) => q.seatingRaw,
    trimDisplayNameById,
    rankedNamesFor("seating"),
  );
  const featuresAvailability = computeCategoryAvailability(
    matchedTrimIds,
    rankedTrimIds,
    configuratorQuestions,
    (q) => q.features,
    trimDisplayNameById,
    rankedNamesFor("feature"),
  );

  /**
   * The real conflict the ranked-trim-union redesign makes possible
   * (2026-09-16): a customer's #1-ranked answer isn't necessarily
   * buildable on their #1-ranked TRIM specifically anymore -- it only
   * has to be buildable on SOME ranked trim. Non-blocking (their ranked
   * trim list is already a fallback search order), but surfaced loudly on
   * Review so it's never a silent surprise. Computed live from
   * client-held state -- no round trip needed, matches what gets saved.
   */
  const CONFLICT_LABEL: Record<ConfiguratorSelection["category"], string> = {
    exterior_color: "color",
    interior: "interior",
    seating: "seating layout",
    feature: "feature",
  };
  function computeTopRankConflicts(): {
    category: ConfiguratorSelection["category"];
    name: string;
    offeringTrimLabel: string;
    offeringRank: number;
  }[] {
    if (!topTrimId) return [];
    const topQuestions = configuratorQuestions[topTrimId];
    const conflicts: {
      category: ConfiguratorSelection["category"];
      name: string;
      offeringTrimLabel: string;
      offeringRank: number;
    }[] = [];

    const findOfferingRank = (
      name: string,
      rawChoicesFor: (q: ConfiguratorQuestions) => ConfiguratorChoice[],
    ): { offeringTrimLabel: string; offeringRank: number } | null => {
      // Starts at rank 2 -- rank 1 (index 0) is the trim we already know
      // doesn't offer it, or this wouldn't be a conflict.
      for (let i = 1; i < rankedTrimIds.length; i++) {
        const trimId = rankedTrimIds[i];
        const q = configuratorQuestions[trimId];
        if (q && rawChoicesFor(q).some((c) => c.name === name)) {
          return { offeringTrimLabel: trimDisplayNameById[trimId] ?? trimId, offeringRank: i + 1 };
        }
      }
      return null;
    };

    const RANKED_CHECKS: [ConfiguratorSelection["category"], (q: ConfiguratorQuestions) => ConfiguratorChoice[]][] = [
      ["exterior_color", (q) => q.exteriorColorRaw],
      ["interior", (q) => q.interiorRaw],
      ["seating", (q) => q.seatingRaw],
    ];
    for (const [category, rawChoicesFor] of RANKED_CHECKS) {
      const top = selections.find((s) => s.category === category && !s.excluded && s.rankPosition === 1);
      if (!top) continue;
      const offeredByTop = topQuestions ? rawChoicesFor(topQuestions).some((c) => c.name === top.selection) : false;
      if (offeredByTop) continue;
      const offering = findOfferingRank(top.selection, rawChoicesFor);
      if (offering) conflicts.push({ category, name: top.selection, ...offering });
    }

    // Features aren't ranked, so "wanted" (not excluded) stands in for
    // "#1" -- the same underlying conflict, just without an ordinal.
    for (const f of selections.filter((s) => s.category === "feature" && !s.excluded)) {
      const offeredByTop = topQuestions ? topQuestions.features.some((c) => c.name === f.selection) : false;
      if (offeredByTop) continue;
      const offering = findOfferingRank(f.selection, (q) => q.features);
      if (offering) conflicts.push({ category: "feature", name: f.selection, ...offering });
    }

    return conflicts;
  }
  const topRankConflicts = step === "review" ? computeTopRankConflicts() : [];

  const index = Math.max(0, steps.indexOf(step));

  // High-water mark, never decreases (2026-09-17) -- the breadcrumb's own
  // "already visited" test needs this, not the CURRENT position. A real
  // gap caught during verification: using the current index alone made a
  // step's own breadcrumb entry go right back to unclickable the moment
  // the customer navigated BACK to an earlier step (e.g. via "Add it"),
  // even though they'd genuinely already been there seconds before and had
  // real answers stored. Furthest-ever-reached is what "already visited"
  // actually means here.
  //
  // Updated from EVENT HANDLERS via navigateToStep below, not an effect or
  // a ref mutated during render -- both were tried and both are real
  // anti-patterns this codebase's stricter hooks lint correctly rejects
  // (setState-in-effect risks cascading renders; refs may not be read or
  // written during the render body at all under this lint config). A plain
  // setState call from a click handler is the idiomatic shape for "a user
  // action changed some derived state."
  const [maxIndexReached, setMaxIndexReached] = useState(0);
  function navigateToStep(s: Step) {
    const i = Math.max(0, steps.indexOf(s));
    setMaxIndexReached((prev) => Math.max(prev, i));
    setStep(s);
  }
  const goNext = () => navigateToStep(steps[Math.min(index + 1, steps.length - 1)]);
  const goBack = () => navigateToStep(steps[Math.max(index - 1, 0)]);

  /**
   * Minimum engagement, exterior colour / interior / seating only
   * (2026-09-15, tightened 2026-09-16). Leaving one of these three
   * completely unranked is no longer a valid way to continue -- trim and
   * features are deliberately excluded (trim's "any trim is fine" and
   * features' "none of these" are both real, meaningful answers on their
   * own). A category is only ever a step in `steps` when it genuinely
   * offered more than one real choice, so a suppressed category (e.g.
   * seating on the 217 of 243 trims with only one layout) never reaches
   * this check at all -- there is nothing here scoping it to "shown"
   * separately from that.
   *
   * ⚠ EXCLUDING ITEMS ALONE NO LONGER SATISFIES THIS (2026-09-16). The
   * original rule treated "any row in this category" (ranked OR excluded)
   * as engagement; Brett's follow-up correction is that a customer who
   * only excludes options -- saying what they don't want, never what they
   * do -- hasn't actually answered the question. `hasAtLeastOneRanked`
   * (ranked-list.ts) is the SAME shared predicate the server's
   * writeConfiguratorSelections check uses, so client and server can't
   * drift on what "ranked" means.
   */
  const REQUIRES_ENGAGEMENT: Partial<Record<Step, ConfiguratorSelection["category"]>> = {
    exteriorColor: "exterior_color",
    interior: "interior",
    seating: "seating",
  };
  const requiredCategory = REQUIRES_ENGAGEMENT[step];
  const categoryEngaged = requiredCategory
    ? hasAtLeastOneRanked(
        selections.filter((s) => s.category === requiredCategory),
        (s) => s,
      )
    : true;

  /**
   * ⚠ NOTHING IS WIPED HERE ANYMORE (2026-09-16, surgical re-validation).
   * Before the ranked-trim-union redesign, changing the #1 trim's resolved
   * build cleared every colour/interior/feature answer outright -- correct
   * under the OLD rule, where an answer meant one specific car and a
   * changed #1 could make that string mean nothing at all. That rule no
   * longer holds: every trim the customer can ever rank belongs to the
   * SAME make/model, so a colour NAME never means a different thing just
   * because the ranked set changed -- it either stays validly rankable
   * (still offered by some ranked trim) or becomes auto-excluded, and
   * `computeCategoryAvailability` already handles that surgically, per
   * item, with a "previously ranked" note when it applies (see its own
   * comment). Deleting the underlying `ConfiguratorSelection` row here
   * would be exactly the silent data loss this whole redesign exists to
   * avoid -- and would break the "re-add the trim, it snaps right back"
   * guarantee: the stored rank position is ALL that lets a demoted item
   * reappear in "Your order" with zero re-entry once its trim returns.
   *
   * ⚠ AUTO-PROMOTE, THE COMPLEMENT OF DEMOTION (2026-09-16, auto-select-all
   * redesign). Exterior colour / interior / seating now start FULLY
   * ranked -- every real option on the customer's ranked trims, price
   * descending -- rather than built up from an empty pool. Demotion
   * (above) was already display-only and needed no write; auto-promotion
   * is the opposite direction and genuinely does: a newly-rankable item
   * (a trim was just added) gets a REAL stored ConfiguratorSelection row,
   * not a display illusion, because an auto-ranked list the customer
   * never touches is a real, persisted preference, not a placeholder.
   * Never promotes a name that already has ANY entry (ranked or
   * excluded) -- an explicit exclusion must survive a trim being added
   * that happens to also offer it, same "customer's stated answer wins"
   * principle demotion already follows in the other direction.
   */
  const AUTO_POPULATE_CHECKS: [
    ConfiguratorSelection["category"],
    (q: ConfiguratorQuestions) => ConfiguratorChoice[],
  ][] = [
    ["exterior_color", (q) => q.exteriorColorRaw],
    ["interior", (q) => q.interiorRaw],
    ["seating", (q) => q.seatingRaw],
  ];
  function handleTrimRanking(nextRanked: string[], nextExcluded: string[]) {
    setRankedTrimIds(nextRanked);
    setExcludedTrimIds(nextExcluded);

    setSelections((prev) => {
      let next = prev;
      for (const [category, rawChoicesFor] of AUTO_POPULATE_CHECKS) {
        const availability = computeCategoryAvailability(
          matchedTrimIds,
          nextRanked,
          configuratorQuestions,
          rawChoicesFor,
          trimDisplayNameById,
        );
        const rankableByName = new Map(availability.rankable.map((c) => [c.name, c]));

        const inCategory = next.filter((s) => s.category === category);
        const existingNames = new Set(inCategory.map((s) => s.selection));
        const newlyRankableNames = [...rankableByName.keys()].filter((n) => !existingNames.has(n));
        if (newlyRankableNames.length === 0) continue;

        const excludedRows = inCategory.filter((s) => s.excluded);
        const rankedRows = inCategory
          .filter((s) => !s.excluded && s.rankPosition != null)
          .sort((a, b) => (a.rankPosition ?? 0) - (b.rankPosition ?? 0));
        const rankedRowsByName = new Map(rankedRows.map((s) => [s.selection, s]));

        // Same "still matches fresh auto-population" test as RankedQuestion's
        // own normalization (configurator-questions.tsx) -- only the names
        // still resolvable in rankableByName participate; a demoted row
        // (rankPosition set but no longer in `rankable`) has no price to
        // compare and must never be asked to.
        const wasNatural = matchesNaturalPriceOrder(
          rankedRows.map((s) => s.selection).filter((name) => rankableByName.has(name)),
          rankableByName,
        );

        const buildNew = (name: string): ConfiguratorSelection => {
          const c = rankableByName.get(name)!;
          return {
            category,
            questionKind: "ranked",
            selection: name,
            rankPosition: null,
            excluded: false,
            packageName: c.packageName,
            packagePriceCents: c.packagePriceCents,
            packageContents: c.packageContents,
            priceUnknown:
              c.availability === "package_only" ? c.packagePriceCents == null : c.priceCents == null,
          };
        };

        let orderedNames: string[];
        if (wasNatural) {
          // Still untouched (or this is the very first population) --
          // recompute the whole order fresh, price descending, existing
          // names included. Demoted names (not in rankableByName) sort to
          // the end, stable amongst themselves -- same rule as
          // RankedQuestion's normalization.
          orderedNames = [...rankedRows.map((s) => s.selection), ...newlyRankableNames].sort((a, b) => {
            const inA = rankableByName.has(a);
            const inB = rankableByName.has(b);
            if (inA && inB) return comparePriceDescending(rankableByName.get(a)!, rankableByName.get(b)!);
            if (inA !== inB) return inA ? -1 : 1;
            return 0;
          });
        } else {
          // Customer has already reordered -- preserve it exactly, only
          // append the newly-rankable names (sorted among themselves) at
          // the end.
          const appended = [...newlyRankableNames].sort((a, b) =>
            comparePriceDescending(rankableByName.get(a)!, rankableByName.get(b)!),
          );
          orderedNames = [...rankedRows.map((s) => s.selection), ...appended];
        }

        const rebuiltRanked = orderedNames.map((name, i) => {
          const existing = rankedRowsByName.get(name);
          return { ...(existing ?? buildNew(name)), rankPosition: i + 1, excluded: false };
        });

        const outsideCategory = next.filter((s) => s.category !== category);
        next = [...outsideCategory, ...rebuiltRanked, ...excludedRows];
      }
      return next;
    });
  }

  /**
   * "Available on {trim} — add it" (2026-09-17, combined breadcrumb + add-
   * it navigation). Jumps to the trim step with `trimId` already added to
   * the ranking, remembering where the customer came from so the trim
   * step's own Next button can return them there instead of falling
   * through to trim's normal next-in-sequence step. Reuses
   * handleTrimRanking outright rather than duplicating its auto-promotion
   * logic -- adding a trim from here is not a new kind of trim-ranking
   * change, just one triggered from an unusual place. If the trim was
   * previously excluded, un-excludes it: the customer explicitly asking to
   * add it now is a real override of that earlier exclusion.
   */
  function handleAddTrimFromAutoExcluded(trimId: string, fromStep: Step) {
    if (!rankedTrimIds.includes(trimId)) {
      handleTrimRanking(
        [...rankedTrimIds, trimId],
        excludedTrimIds.filter((id) => id !== trimId),
      );
    }
    setReturnToStep(fromStep);
    navigateToStep("trim");
  }

  /**
   * The customer's trim ranking, as the write path wants it.
   *
   * Ranks become 1..n in list order; exclusions carry a null rank. The #1
   * entry is what decides the legacy `trim` column and which configurator
   * build the colour/feature answers get validated against, server-side --
   * see writeTrimPreferences. Ranking nothing is a legitimate answer and
   * yields an empty list, i.e. "any trim is fine".
   */
  function buildTrimPreferences(): TrimPreference[] {
    const toPref = (id: string, rankPosition: number | null): TrimPreference | null => {
      const opt = trimById.get(id);
      if (!opt) return null;
      return {
        trim: opt.trim,
        modelYear: opt.year ?? null,
        rankPosition,
        excluded: rankPosition === null,
        configuratorTrimId: configuratorQuestions[id]?.configuratorTrimId ?? null,
      };
    };
    return [
      ...rankedTrimIds.map((id, i) => toPref(id, i + 1)),
      ...excludedTrimIds.map((id) => toPref(id, null)),
    ].filter(Boolean) as TrimPreference[];
  }

  /**
   * The customer's combination preferences, as the write path wants them
   * (combination-preferences Phase 3, 2026-09-19) -- same ranked-then-
   * excluded shape as buildTrimPreferences above.
   *
   * `combinationRanked`/`combinationExcluded` only ever hold ids of cards
   * that were actually rendered, i.e. members of
   * prioritizedCombinations.visible -- so `byId` never needs to fall back
   * to anything else. `configuratorTrimId` is looked up fresh here (not
   * carried on RealCombination itself), the exact same translation
   * buildTrimPreferences already does -- if a combination's trim somehow
   * no longer resolves (shouldn't happen within one render, but this
   * mirrors buildTrimPreferences's own defensive `?? null` pattern rather
   * than assuming it can't), that one entry is dropped rather than sent
   * with a fabricated id.
   */
  function buildCombinationPreferences(): CombinationPreference[] {
    const byId = new Map(prioritizedCombinations.visible.map((c) => [combinationId(c), c]));
    const toPref = (id: string, rankPosition: number | null): CombinationPreference | null => {
      const combo = byId.get(id);
      if (!combo) return null;
      const configuratorTrimId = configuratorQuestions[combo.trimId]?.configuratorTrimId;
      if (!configuratorTrimId) return null;
      return {
        configuratorTrimId,
        exteriorColor: combo.exteriorColor,
        interior: combo.interior,
        seating: combo.seating,
        rankPosition,
        excluded: rankPosition === null,
      };
    };
    return [
      ...combinationRanked.map((id, i) => toPref(id, i + 1)),
      ...combinationExcluded.map((id) => toPref(id, null)),
    ].filter(Boolean) as CombinationPreference[];
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    // The legacy columns are now DERIVED SERVER-SIDE from the rows that
    // actually get stored (see writeConfiguratorSelections), so the rich
    // path no longer computes a parallel colours list here that could
    // drift out of rank order or quietly include an excluded colour. The
    // generic path still sends its own, because it has no ranked rows to
    // derive anything from.
    const result = await finalizeSelfService(searchId, {
      trim: effectiveTrim,
      colors,
      requiredOptions: options,
      selections,
      trimPreferences: buildTrimPreferences(),
      combinationPreferences: buildCombinationPreferences(),
    });
    setSaving(false);
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
        <h1 className="mt-6 text-2xl font-semibold text-white">You&apos;re all set.</h1>
        <p className="mt-4 text-sm text-zinc-400">
          You made your decision today. We&apos;ll begin the search tomorrow. If you wake up
          wanting to change something, now&apos;s the time — you have 24 hours to edit this from
          your account.
        </p>
        <a
          href="/account"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          View My Account
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-xl shadow-black/20 sm:p-8">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {steps.map((s, i) => {
          // Only ALREADY-VISITED steps (furthest ever reached, not just
          // the current position -- see maxIndexReached above) are
          // clickable. Jumping AHEAD of anywhere the customer has been
          // would bypass the min-one-selection engagement gate a future
          // step's own Next button normally enforces, since that check
          // only runs when Next is clicked on the step it belongs to.
          // Going back never has that risk: every category's own answers
          // stay exactly as they are regardless of which step is showing.
          const visited = i <= maxIndexReached;
          return (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-zinc-700">→</span>}
              {visited ? (
                <button
                  type="button"
                  onClick={() => {
                    // An explicit jump elsewhere abandons any "Add it"
                    // detour in progress -- the customer chose to go
                    // somewhere specific, not to resume where they left off.
                    setReturnToStep(null);
                    navigateToStep(s);
                  }}
                  className={`hover:text-zinc-300 ${step === s ? "text-emerald-400" : ""}`}
                >
                  {STEP_LABELS[s]}
                </button>
              ) : (
                <span>{STEP_LABELS[s]}</span>
              )}
            </span>
          );
        })}
      </div>

      {step === "trim" && (
        <div className="mt-6">
          {trimOptions.length > 0 ? (
            <>
              {/* Trim comparison view (2026-09-19) -- a decision aid for
                  THIS step, not the combination-preferences step further
                  along: helps decide what to rank, before anything is
                  ranked, rather than refining an already-ranked list.
                  Only worth offering once there's genuinely something to
                  compare. */}
              {trimOptions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setComparisonOpen(true)}
                  className="mb-4 text-sm font-semibold text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
                >
                  Compare trims
                </button>
              )}
              <RankingQuestion
                title={`Which ${make} ${model} trim?`}
                subtitle="Rank them in the order you'd like us to search — we'll work down your list. Mark anything you'd exclude, and leave the rest alone."
                items={trimOptions.map((opt) => ({
                  id: opt.id,
                  label: opt.trim,
                  // Year is shown only when it distinguishes something. With a
                  // committed year every option is that year, so the suffix is
                  // redundant and dropped. Without one (a search predating the
                  // required year) a trim spanning two model years would
                  // otherwise render as two identical-looking rows.
                  sublabel: modelYear == null && opt.year != null ? String(opt.year) : null,
                  detail: (
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {formatCents(opt.minPriceCents)}
                      {opt.maxPriceCents && opt.maxPriceCents !== opt.minPriceCents
                        ? `–${formatCents(opt.maxPriceCents)}`
                        : ""}
                      {" · "}
                      {opt.count} available nationwide
                    </span>
                  ),
                }))}
                ranked={rankedTrimIds}
                excluded={excludedTrimIds}
                onChange={handleTrimRanking}
              />
            </>
          ) : (
            /*
              No synced inventory for this make/model yet. There is nothing
              real to rank, and NO free-text box: a trim the customer types
              is not an inventory option, cannot be ranked against one, and
              was only ever reaching the legacy trim column as an
              unvalidated string. Leaving it open is the honest answer --
              the agent sources across trims and the customer still gets a
              24h window to narrow it once inventory lands.
            */
            <>
              <h2 className="text-xl font-semibold text-white">
                Which {make} {model} trim?
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                We haven&apos;t synced live inventory for this one yet, so there&apos;s nothing to
                rank here. We&apos;ll search every trim — you can narrow it down later from your
                account.
              </p>
            </>
          )}

          {/* Ranking nothing is a legitimate answer -- "any trim" -- so
              Next is never blocked on having built a list. */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              {rankedTrimIds.length === 0 && trimOptions.length > 0
                ? "Don't rank any, and we'll treat every trim as fine."
                : ""}
            </p>
            <button
              type="button"
              onClick={() => {
                // A detour via "Add it" returns to exactly where the
                // customer left off, instead of falling through to trim's
                // normal next-in-sequence step (2026-09-17).
                if (returnToStep) {
                  navigateToStep(returnToStep);
                  setReturnToStep(null);
                } else {
                  goNext();
                }
              }}
              className="shrink-0 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              {returnToStep ? "Back to where I was" : "Next"}
            </button>
          </div>
        </div>
      )}

      {/* Trim comparison + single-trim detail modals (2026-09-19) --
          portaled to document.body, so rendering them here (rather than
          only while step === "trim") is fine either way; kept scoped to
          the trim step's own block for readability since that's the only
          place either can be opened from. Both share the exact same
          rank/exclude write path as the plain list above (handleTrimRanking),
          not a parallel one -- see each modal's own header comment for
          why this is explicitly NOT read-only. */}
      {comparisonOpen && (
        <TrimComparisonModal
          make={make}
          model={model}
          trimOptions={trimOptions}
          configuratorQuestions={configuratorQuestions}
          ranked={rankedTrimIds}
          excluded={excludedTrimIds}
          onChange={handleTrimRanking}
          onOpenDetail={(trimId) => setDetailTrimId(trimId)}
          onClose={() => setComparisonOpen(false)}
        />
      )}
      {detailTrimId &&
        trimById.get(detailTrimId) &&
        (() => {
          const opt = trimById.get(detailTrimId)!;
          const isRanked = rankedTrimIds.includes(detailTrimId);
          const isExcluded = excludedTrimIds.includes(detailTrimId);
          const rankPosition = isRanked ? rankedTrimIds.indexOf(detailTrimId) + 1 : null;
          return (
            <TrimDetailModal
              make={make}
              model={model}
              trim={opt}
              questions={configuratorQuestions[detailTrimId] ?? null}
              isRanked={isRanked}
              isExcluded={isExcluded}
              rankPosition={rankPosition}
              onRank={() => {
                handleTrimRanking([...rankedTrimIds, detailTrimId], excludedTrimIds.filter((id) => id !== detailTrimId));
              }}
              onExclude={() => {
                handleTrimRanking(rankedTrimIds.filter((id) => id !== detailTrimId), [...excludedTrimIds, detailTrimId]);
              }}
              onUndo={() => {
                // Mirrors RankingQuestion's own unrank/unexclude for trim
                // (removeMeansExclude false there): a ranked trim goes back
                // to the neutral pool, an excluded one does too -- same
                // single "undo" action either way from this modal's own
                // single button, since only one of the two states is ever
                // true at once.
                handleTrimRanking(
                  rankedTrimIds.filter((id) => id !== detailTrimId),
                  excludedTrimIds.filter((id) => id !== detailTrimId),
                );
              }}
              onClose={() => setDetailTrimId(null)}
            />
          );
        })()}

      {step === "exteriorColor" && questions && (
        <RankedQuestion
          title="What color?"
          subtitle="These are the colors your ranked trims can be built in -- some may only come on a specific trim. Rank the ones you'd like, or let us know if there's one you'd exclude."
          rankable={exteriorColorAvailability.rankable}
          autoExcluded={exteriorColorAvailability.autoExcluded}
          category="exterior_color"
          selections={selections}
          onChange={setSelections}
          trimDisplayNameById={trimDisplayNameById}
          onAddTrim={(trimId) => handleAddTrimFromAutoExcluded(trimId, "exteriorColor")}
        />
      )}

      {step === "interior" && questions && (
        <RankedQuestion
          title="Interior?"
          subtitle={"Rank the ones you'd like, or let us know if there's one you'd exclude."}
          rankable={interiorAvailability.rankable}
          autoExcluded={interiorAvailability.autoExcluded}
          category="interior"
          selections={selections}
          onChange={setSelections}
          trimDisplayNameById={trimDisplayNameById}
          onAddTrim={(trimId) => handleAddTrimFromAutoExcluded(trimId, "interior")}
        />
      )}

      {step === "seating" && questions && (
        <RankedQuestion
          title="Seating layout?"
          subtitle="Your ranked trims offer more than one configuration."
          rankable={seatingAvailability.rankable}
          autoExcluded={seatingAvailability.autoExcluded}
          category="seating"
          selections={selections}
          onChange={setSelections}
          trimDisplayNameById={trimDisplayNameById}
          onAddTrim={(trimId) => handleAddTrimFromAutoExcluded(trimId, "seating")}
        />
      )}

      {step === "features" && questions && (
        <FeatureQuestion
          rankable={featuresAvailability.rankable}
          autoExcluded={featuresAvailability.autoExcluded}
          selections={selections}
          onChange={setSelections}
        />
      )}

      {step === "combinations" && questions && (
        <CombinationsQuestion
          prioritized={prioritizedCombinations}
          ranked={combinationRanked}
          excluded={combinationExcluded}
          onChange={(next, nextExcluded) => {
            setCombinationRanked(next);
            setCombinationExcluded(nextExcluded);
          }}
          configuratorQuestions={configuratorQuestions}
          selections={selections}
          showAll={showAllCombinations}
          onShowMore={() => setShowAllCombinations(true)}
        />
      )}

      {step === "color" && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">Color preference</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Pick as many as you&apos;re open to — more options means faster offers.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {COLORS.map((color) => {
              const active = colors.includes(color);
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setColors(toggleInArray(colors, color))}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  }`}
                >
                  {color}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "options" && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">Any must-have options?</h2>
          <p className="mt-2 text-sm text-zinc-400">Optional — leave blank if you&apos;re flexible.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {OPTIONS.map((option) => {
              const active = options.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setOptions(toggleInArray(options, option))}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                    active
                      ? "border-emerald-500 bg-emerald-500/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step !== "trim" && step !== "review" && (
        <div className="mt-6">
          {requiredCategory && !categoryEngaged && (
            <p className="mb-3 text-xs text-amber-400">
              Rank at least one option you want to continue -- excluding others is fine, but
              excluding alone isn&apos;t enough.
            </p>
          )}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-semibold text-zinc-400 hover:text-white"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!categoryEngaged}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {index === steps.length - 2 ? "Review" : "Next"}
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">
            This confirms exactly what we&apos;ll search for
          </h2>
          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Vehicle:</span> {make} {model}
              {effectiveTrim ? ` — ${effectiveTrim}` : " — any trim"}
            </p>
            {questions ? (
              selections.length > 0 ? (
                <SelectionSummary selections={selections} />
              ) : (
                <p className="mt-1 text-zinc-500">No color or feature preferences — flexible.</p>
              )
            ) : (
              <>
                <p className="mt-1">
                  <span className="text-zinc-500">Colors:</span>{" "}
                  {colors.length > 0 ? colors.join(", ") : "No preference"}
                </p>
                <p className="mt-1">
                  <span className="text-zinc-500">Options:</span>{" "}
                  {options.length > 0 ? options.join(", ") : "None specified"}
                </p>
              </>
            )}
          </div>
          {topRankConflicts.map((c) => (
            <p
              key={`${c.category}::${c.name}`}
              className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
            >
              Your #1 ranked {CONFLICT_LABEL[c.category]}, {c.name}, isn&apos;t offered on your #1
              ranked trim, {effectiveTrim} — it&apos;s available on {c.offeringTrimLabel}, your #
              {c.offeringRank}.
            </p>
          ))}
          <p className="mt-4 text-xs text-zinc-500">
            You&apos;ll have 24 hours after confirming to change any of this from your account —
            after that, we lock it in and start reaching out to dealers.
          </p>
          {error && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-semibold text-zinc-400 hover:text-white"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="rounded-full bg-emerald-500 px-8 py-3.5 text-base font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {saving ? "Confirming…" : "Confirm & Start My Search"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
