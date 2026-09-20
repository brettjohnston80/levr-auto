import {
  categoryHasRealChoiceAcrossTrims,
  groupIntoPackages,
  type ConfiguratorChoice,
  type ConfiguratorQuestions,
} from "@/lib/configurator-matching";

// Pure computation for the trim comparison view (2026-09-19) -- the trim
// ranking step's own "which of these should I even rank" decision aid,
// distinct from combination-preferences (which only exists once trim AND
// colour/interior/seating are already ranked). No server imports, no JSX:
// shared by trim-comparison-modal.tsx (the multi-column table) and
// trim-detail-modal.tsx (the full single-trim breakdown, which reads
// ConfiguratorQuestions' own fields directly for most sections and only
// reaches into here for the same wheels/roof/drivetrain summarizers the
// table uses, in the "N specs" overflow case -- see summarizeDrivetrain).

function formatCents(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export type CellTone = "free" | "cost" | "unknown" | "none";

export interface ComparisonCell {
  text: string;
  tone: CellTone;
}

const DASH: ComparisonCell = { text: "—", tone: "none" };

/**
 * One choice's compact table-cell rendering: Standard / +$price / +$price
 * package / price-not-confirmed / free-standalone. Deliberately NOT the
 * same as configurator-questions.tsx's own `priceLabel` -- that one never
 * has to distinguish "comes with the car by default" (`standard`) from "a
 * real standalone option that happens to be free," because a colour/
 * interior list never mixes the two meanings in one control (every row
 * there is just "pick one, free or not"). A comparison cell is a genuine
 * three-way fact per trim -- standard / priced / not offered -- so
 * `availability` decides the label FIRST, price only within that.
 */
export function priceCellFor(choice: ConfiguratorChoice): ComparisonCell {
  if (choice.availability === "standard") return { text: "Standard", tone: "free" };
  if (choice.availability === "package_only") {
    if (choice.packagePriceCents == null) return { text: "Price not confirmed", tone: "unknown" };
    return { text: `+${formatCents(choice.packagePriceCents)} pkg`, tone: "cost" };
  }
  // standalone
  if (choice.priceIsIncluded) return { text: "Included", tone: "free" };
  if (choice.priceCents == null) return { text: "Price not confirmed", tone: "unknown" };
  if (choice.priceCents === 0) return { text: "No extra cost", tone: "free" };
  return { text: `+${formatCents(choice.priceCents)}`, tone: "cost" };
}

/** Whether a set of cells actually differs -- the gate for "is this row
 *  worth showing at all" on rows built from a summarizer rather than a
 *  named-choice union (seating/wheels/roof/drivetrain). A row where every
 *  compared trim landed on the identical text is not a comparison. */
export function cellsDiffer(cells: ComparisonCell[]): boolean {
  return new Set(cells.map((c) => c.text)).size > 1;
}

/**
 * One row of the "Seating" attribute -- a plain descriptive cell, same
 * shape as the plain trim list already shows (a sentence, not a priced
 * option), since seatingRaw is a LAYOUT description, not something a
 * customer picks or pays for. Real data has 0-2 rows per trim in
 * practice; 2+ is handled honestly rather than assumed away.
 */
export function seatingCell(q: ConfiguratorQuestions | undefined): ComparisonCell {
  if (!q || q.seatingRaw.length === 0) return DASH;
  if (q.seatingRaw.length === 1) return { text: q.seatingRaw[0].name, tone: "none" };
  return { text: `${q.seatingRaw.length} configurations`, tone: "none" };
}

/** Whether Seating is worth its own row across the COMPARED set (not the
 *  ranked set -- comparison happens before any ranking exists). Reuses
 *  categoryHasRealChoiceAcrossTrims exactly, the same ">1 distinct name"
 *  rule that already decides whether seating is worth asking about once
 *  trims are ranked -- fed the raw rows across whichever trims are being
 *  compared here instead of the ranked ones. Camry's identical seating
 *  string on every trim is the real case this excludes. */
export function seatingIsDifferentiator(
  trimIds: string[],
  configuratorQuestions: Record<string, ConfiguratorQuestions>,
): boolean {
  const rows = trimIds.flatMap((id) => configuratorQuestions[id]?.seatingRaw ?? []);
  return categoryHasRealChoiceAcrossTrims(rows);
}

/**
 * Wheels (2026-09-19) -- almost always exactly one `standard` row (a real
 * wheel spec, e.g. "17-Inch Silver-Painted Alloy Wheels"), occasionally
 * plus a real priced `standalone`/`package_only` upgrade (Civic LX, CR-V
 * LX, RAV4 Limited). The upgrade -- the one actionable comparison fact --
 * wins when one exists; otherwise the cell just says "Standard", since
 * the full spec text is too long for a ~160px table cell (the detail
 * modal shows it in full, reading `.wheels` directly, not this function).
 */
export function summarizeWheels(q: ConfiguratorQuestions | undefined): ComparisonCell {
  if (!q || q.wheels.length === 0) return DASH;
  const upgrade = q.wheels.find((c) => c.availability !== "standard");
  if (upgrade) return priceCellFor(upgrade);
  return { text: "Standard", tone: "free" };
}

/**
 * Roof (2026-09-19) -- closest in shape to a real feature: `standard`, or
 * a priced `standalone`/`package_only` moonroof (pick() already excludes
 * `unavailable`, so an empty list here means genuinely no row reached
 * CHOICE_AVAILABILITY, not that it was filtered out silently).
 *
 * ⚠ DELIBERATELY NOT merged into the feature-union rows, even though the
 * shape matches. At least one real model's research data represents the
 * same physical option under both `feature` and `roof` with different
 * wording (RAV4's "Moonroof" name is literally identical across both
 * categories; Camry's "moonroof" ($870, feature) and "Power tilt/slide
 * moonroof" ($870, roof) are the same real option under two different
 * researched strings). Merging by name would silently drop the roof
 * version wherever the strings happen to differ, and merging by "assume
 * they're the same thing" everywhere risks the opposite mistake if they
 * ever genuinely diverge. Keeping Roof as its own row is the honest
 * choice: it reflects the source data exactly as researched, never
 * guesses at a dedup.
 */
export function summarizeRoof(q: ConfiguratorQuestions | undefined): ComparisonCell {
  if (!q || q.roof.length === 0) return DASH;
  const priced = q.roof.find((c) => c.availability !== "standard");
  if (priced) return priceCellFor(priced);
  return { text: "Standard", tone: "free" };
}

/**
 * Drivetrain (2026-09-19) -- the least uniform of the three. A trim can
 * carry SEVERAL simultaneous `standard` rows describing genuinely
 * different real facts at once (engine, transmission, drive layout --
 * RAV4 Woodland has 6, because it real-world spans both a hybrid and a
 * plug-in-hybrid build under one trim name), not a small closed set of
 * named alternatives the way colours are. Only some trims (Honda CR-V is
 * the clean case: FWD standard, AWD +$1,500 standalone) carry a genuine
 * priced alternative -- that's the one fact compact enough for a table
 * cell. Everything else compresses to "Standard" or, transparently,
 * "Standard (N specs)" when more than one simultaneous fact exists,
 * rather than truncating real engine/transmission text into something
 * misleading. Full text is only ever shown in the detail modal.
 */
export function summarizeDrivetrain(q: ConfiguratorQuestions | undefined): ComparisonCell {
  if (!q || q.drivetrain.length === 0) return DASH;
  const priced = q.drivetrain.find((c) => c.availability !== "standard");
  if (priced) return priceCellFor(priced);
  const standardCount = q.drivetrain.filter((c) => c.availability === "standard").length;
  return { text: standardCount > 1 ? `Standard (${standardCount} specs)` : "Standard", tone: "free" };
}

/** One feature-union comparison row: a feature name, and this compared
 *  trim set's per-trim cell for it. */
export interface FeatureComparisonRow {
  name: string;
  cellsByTrimId: Record<string, ComparisonCell>;
}

/**
 * Unions feature/package names across the COMPARED trim set (never the
 * ranked set -- trim comparison happens before any ranking exists, unlike
 * combination-preferences' own union which is deliberately scoped to
 * ranked trims). Each trim's obtainable rows are grouped by package first
 * (2026-09-20 reversal) via groupIntoPackages -- the same function
 * combination-preferences' pill logic and TrimDetailModal's own Features
 * section both already use -- so a multi-item package unions as ONE row
 * under its package name rather than one row per member feature, matching
 * how the customer actually ranks these on the features step. Combined
 * with `.featuresStandard` (names only) so a feature/package that's
 * standard on one compared trim and an upgrade on another renders
 * correctly on both sides.
 */
export function computeFeatureComparisonRows(
  trimIds: string[],
  configuratorQuestions: Record<string, ConfiguratorQuestions>,
): FeatureComparisonRow[] {
  const packagesByTrimId: Record<string, ConfiguratorChoice[]> = {};
  const names = new Set<string>();
  for (const id of trimIds) {
    const q = configuratorQuestions[id];
    if (!q) continue;
    const packages = groupIntoPackages(q.features);
    packagesByTrimId[id] = packages;
    for (const c of packages) names.add(c.name);
    for (const n of q.featuresStandard) names.add(n);
  }

  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => {
    const cellsByTrimId: Record<string, ComparisonCell> = {};
    for (const id of trimIds) {
      const q = configuratorQuestions[id];
      if (!q) {
        cellsByTrimId[id] = DASH;
        continue;
      }
      if (q.featuresStandard.includes(name)) {
        cellsByTrimId[id] = { text: "Standard", tone: "free" };
        continue;
      }
      const choice = packagesByTrimId[id]?.find((c) => c.name === name);
      cellsByTrimId[id] = choice ? priceCellFor(choice) : DASH;
    }
    return { name, cellsByTrimId };
  });
}
