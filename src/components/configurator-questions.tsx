"use client";

import {
  type AutoExcludedChoice,
  type ConfiguratorChoice,
  type ConfiguratorSelection,
} from "@/lib/configurator-matching";
import { RankingQuestion, type RankableItem } from "@/components/ranking-question";

// The rich configurator question UI (step 7 of 9), shown only for a trim
// that resolved to exactly one researched build. Every other trim -- and
// every one of the 34 makes with no configurator data -- keeps the generic
// colour/options steps unchanged.
//
// RANKING REPLACED THE THREE-WAY PRIORITY SCALE (2026-09-14). RankedQuestion
// below is now a thin ADAPTER: it translates between this flow's
// ConfiguratorSelection[] and the shared RankingQuestion's (ranked ids,
// excluded ids) shape, and owns nothing about the interaction itself. The
// pool / ordered list / exclusions UI, and the pointer-drag reordering,
// live in ranking-question.tsx so trim can reuse them unchanged.

function formatCents(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/**
 * What this option costs, in words.
 *
 * A null price is NEVER rendered as "$0" -- the parser stores null for a
 * price it genuinely could not read, and telling a customer an option is
 * free when nobody confirmed that is exactly the error the whole price
 * pipeline is built to avoid.
 */
function priceLabel(choice: ConfiguratorChoice): { text: string; tone: "free" | "cost" | "unknown" } {
  if (choice.availability === "package_only") {
    if (choice.packagePriceCents == null) {
      return { text: "Package price not confirmed", tone: "unknown" };
    }
    return { text: `+${formatCents(choice.packagePriceCents)} package`, tone: "cost" };
  }
  if (choice.priceIsIncluded) return { text: "Included", tone: "free" };
  if (choice.priceCents == null) return { text: "Price not confirmed", tone: "unknown" };
  if (choice.priceCents === 0) return { text: "No extra cost", tone: "free" };
  return { text: `+${formatCents(choice.priceCents)}`, tone: "cost" };
}

// Exported (2026-09-19) so trim-detail-modal.tsx can reuse these verbatim
// in read-only form for the wheels/roof/drivetrain sections -- same "one
// implementation, can't drift" reasoning as Thumb/ColorDot's own export
// from ranking-question.tsx for the combinations step.
export function PriceTag({ choice }: { choice: ConfiguratorChoice }) {
  const { text, tone } = priceLabel(choice);
  const cls =
    tone === "free"
      ? "text-emerald-400/80"
      : tone === "unknown"
        ? "text-amber-400/90"
        : "text-zinc-300";
  return <span className={`shrink-0 text-xs font-medium ${cls}`}>{text}</span>;
}

/**
 * The package a choice is locked inside, spelled out.
 *
 * This is the entire reason the configurator project exists: "customer
 * wants a heated steering wheel" is unactionable for an agent when that
 * feature only exists inside a package that also carries four other
 * things and a price. The customer sees what they would actually be
 * buying before they ask for it.
 *
 * TWO CALLING SHAPES, and the wording has to differ (2026-09-20 fix).
 * `choice` is either an individual feature bundled inside a package
 * (TrimDetailModal's raw `questions.features`, e.g. "Heated leather
 * steering wheel") or the package itself, post-`groupIntoPackages`
 * (RankedQuestion/`/account/vehicle`'s feature Section, where a real
 * multi-item package is now the displayed item and `choice.name` IS
 * `choice.packageName`). "Only available in the Cold Weather Package"
 * under a row already titled "Cold Weather Package" is self-referential --
 * `choice.name === choice.packageName` is the structural signal for that
 * case, true regardless of which caller reached here, and switches to
 * describing what's actually included instead. A single-item package (no
 * other contents to list) gets no note at all -- there's nothing to add
 * beyond the name already shown as the row's title.
 */
export function PackageNote({ choice }: { choice: ConfiguratorChoice }) {
  if (choice.availability !== "package_only" || !choice.packageName) return null;
  const hasContents = choice.packageContents && choice.packageContents.length > 0;
  if (choice.name === choice.packageName) {
    if (!hasContents) return null;
    return (
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
        Includes: <span className="text-zinc-400">{choice.packageContents!.join(", ")}</span>
      </p>
    );
  }
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
      Only available in the <span className="text-zinc-400">{choice.packageName}</span>
      {hasContents && <> — also includes {choice.packageContents!.join(", ")}</>}
    </p>
  );
}

/**
 * A colour / interior / seating question: build an ordered list of what
 * you want, and separately name anything you refuse outright.
 *
 * THREE STATES, NOT A SCALE. Ranked (the order to try), excluded (never
 * offer this), and untouched -- which is the default and stores nothing at
 * all. That last one is why there is no "no preference" button: silence
 * already means no opinion, and an option the customer ignored must never
 * become an answer an agent negotiates against.
 *
 * `rankable`/`autoExcluded` replace the old single `choices` prop
 * (2026-09-16, full-transparency redesign) -- both are already computed by
 * the caller (finalize-self-service.tsx's `computeCategoryAvailability`)
 * from the union across every trim the customer has ranked, not just their
 * #1. `autoExcluded` items are a live-computed FACT about trim
 * availability, never something this component can rank or exclude --
 * they're handed straight through to RankingQuestion's own auto-excluded
 * block, which renders them non-interactive.
 */
export function RankedQuestion({
  title,
  subtitle,
  rankable,
  autoExcluded,
  category,
  selections,
  onChange,
  trimDisplayNameById,
  onAddTrim,
}: {
  title: string;
  subtitle: string;
  rankable: ConfiguratorChoice[];
  autoExcluded: AutoExcludedChoice[];
  category: ConfiguratorSelection["category"];
  selections: ConfiguratorSelection[];
  onChange: (next: ConfiguratorSelection[]) => void;
  /** Trim id -> display label, for the "Add it" quick-link's button text. */
  trimDisplayNameById: Record<string, string>;
  /** Jumps to the trim step with this trim added, remembering to return
   *  here (2026-09-17) -- see handleAddTrimFromAutoExcluded in
   *  finalize-self-service.tsx, the only real implementation. */
  onAddTrim: (trimId: string) => void;
}) {
  // NOT built from `rankable` for handleChange purposes -- see below,
  // deliberately excludes recovered items so a stray Rank click on one
  // can't smuggle an actually-unavailable option into a save.
  const byName = new Map(rankable.map((c) => [c.name, c]));
  const mine = selections.filter((s) => s.category === category);

  // Option NAME is the id here: search_option_selections is unique on
  // (search_id, category, selection), so a name already identifies an
  // answer within its category.
  const ranked = mine
    .filter((s) => !s.excluded && s.rankPosition != null)
    .sort((a, b) => (a.rankPosition ?? 0) - (b.rankPosition ?? 0))
    .map((s) => s.selection);
  const excluded = mine.filter((s) => s.excluded).map((s) => s.selection);
  const excludedNames = new Set(excluded);

  const toDetail = (c: ConfiguratorChoice) => (
    <>
      <span className="mt-0.5 block">
        <PriceTag choice={c} />
      </span>
      <PackageNote choice={c} />
    </>
  );
  const toItem = (c: ConfiguratorChoice): RankableItem => ({
    id: c.name,
    label: c.name,
    imageUrl: c.imageUrl ?? null,
    swatch: c.swatch ?? null,
    detail: toDetail(c),
  });

  // ⚠ A GENUINE CUSTOMER EXCLUSION MUST NEVER GO INVISIBLE, EVEN IF ITS
  // ONLY OFFERING TRIM GETS REMOVED FROM THE RANKING (2026-09-16). Section
  // 2 ("Excluded") is unchanged-from-today and unconditional on trim
  // availability -- excluding something is a statement independent of
  // whether it's currently buildable. But `rankable` is now scoped to the
  // ranked-trim union, so an excluded name that falls out of it would
  // otherwise vanish from `items` entirely (RankingQuestion's own
  // `excludedItems` lookup silently drops any id `byId` can't resolve).
  // Recovered here from `autoExcluded`'s own choice data -- and then
  // filtered OUT of the auto-excluded block below, so it renders exactly
  // once, in Excluded, same as it always has.
  const recoveredExcluded = autoExcluded.filter(({ choice }) => excludedNames.has(choice.name));
  const visibleAutoExcluded = autoExcluded.filter(({ choice }) => !excludedNames.has(choice.name));

  const items: RankableItem[] = [
    ...rankable.map(toItem),
    ...recoveredExcluded.map(({ choice }) => toItem(choice)),
  ];

  // "Add it" quick-link (2026-09-17): the plain note text stays exactly as
  // computeCategoryAvailability built it (still the right words whether or
  // not there's a real trim to offer clicking on), with one clickable
  // "Add {trim}" button appended per real offering trim -- plural when
  // more than one trim offers it, so the customer picks specifically
  // rather than the link guessing for them.
  const autoExcludedItems = visibleAutoExcluded.map(({ choice, note, offeringTrimIds }) => ({
    item: toItem(choice),
    note:
      offeringTrimIds.length === 0 ? (
        note
      ) : (
        <>
          {note}{" "}
          {offeringTrimIds.map((trimId, i) => (
            <span key={trimId}>
              {i > 0 && ", "}
              <button
                type="button"
                onClick={() => onAddTrim(trimId)}
                className="font-semibold text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
              >
                Add {trimDisplayNameById[trimId] ?? "trim"}
              </button>
            </span>
          ))}
        </>
      ),
  }));

  function handleChange(nextRanked: string[], nextExcluded: string[]) {
    const others = selections.filter((s) => s.category !== category);
    // Looked up by name so a DEMOTED item (still legitimately "ranked" in
    // `selections`, just not offered by any currently-ranked trim right
    // now -- see computeCategoryAvailability) can be preserved verbatim
    // below rather than silently dropped the next time this category
    // changes for any reason.
    const mineByName = new Map(mine.map((s) => [s.selection, s]));
    const build = (name: string, rankPosition: number | null, isExcluded: boolean) => {
      const c = byName.get(name);
      if (c) {
        return {
          category,
          questionKind: "ranked" as const,
          selection: name,
          rankPosition,
          excluded: isExcluded,
          packageName: c.packageName,
          packagePriceCents: c.packagePriceCents,
          packageContents: c.packageContents,
          priceUnknown:
            c.availability === "package_only" ? c.packagePriceCents == null : c.priceCents == null,
        };
      }
      // ⚠ Not in the currently-rankable set -- almost always a demoted
      // item. Preserving its existing stored row (just updated
      // rankPosition/excluded) is what makes "re-add the trim, it snaps
      // back with zero re-entry" hold true regardless of what OTHER
      // action the customer takes in this category while it's demoted.
      // Rebuilding it from `byName` isn't possible (it has no current
      // price/package data to rebuild from) and dropping it would be
      // exactly the silent data loss this whole redesign exists to avoid.
      const existing = mineByName.get(name);
      return existing ? { ...existing, rankPosition, excluded: isExcluded } : null;
    };

    const rows = [
      ...nextRanked.map((name, i) => build(name, i + 1, false)),
      ...nextExcluded.map((name) => build(name, null, true)),
    ].filter(Boolean) as ConfiguratorSelection[];
    onChange([...others, ...rows]);
  }

  return (
    <RankingQuestion
      title={title}
      subtitle={subtitle}
      items={items}
      ranked={ranked}
      excluded={excluded}
      autoExcluded={autoExcludedItems}
      // No removeMeansExclude here (2026-09-19, auto-select-all revert):
      // exterior colour/interior/seating are back to a genuine neutral
      // pool state -- "no opinion" is a real answer again -- so removing
      // an item from "Your order" returns it to the pool, same as trim's
      // own default behaviour via RankingQuestion.
      onChange={handleChange}
    />
  );
}

// FeatureQuestion and its private FeatureThumb helper are gone
// (2026-09-18, features-become-ranked-packages) -- features/packages now
// render through RankedQuestion, the exact same shared component every
// other ranked category (colour/interior/seating/trim) already uses. See
// git history for the old want/exclude/neutral pill UI if this is ever
// revisited.

/**
 * One ranked selection that isn't offered by any of the customer's
 * currently-ranked trims -- the SAME fact, and the SAME computation
 * (computeCategoryAvailability's `autoExcluded` partition), that drives
 * the Review step's own amber conflict callouts (finalize-self-service.tsx).
 * Passed into SelectionSummary as `conflicts` so the compact inline
 * strikethrough below and the fuller callout paragraph above it can never
 * disagree about which items are affected -- one shared list, two
 * renderings.
 */
export interface RankConflict {
  category: ConfiguratorSelection["category"];
  name: string;
  rankPosition: number;
  /** Joined display names, e.g. "XSE" or "XSE, XLE" -- empty string for
   *  the near-unreachable Case B (offered on no trim in the model at all). */
  offeringTrimLabel: string;
}

/**
 * Compact read-back of every answer, for the review step.
 *
 * ⚠ EXCLUSIONS ARE DELIBERATELY NEVER SHOWN HERE (2026-09-20, Brett's
 * explicit correction) -- a prior version of this component rendered an
 * "excluded: X" clarifying note per category. Confirmed via grep this
 * component has exactly ONE caller (finalize-self-service.tsx's review
 * step), so nothing else depends on that list being shown. This is the
 * review step's own summary of what the customer IS asking for; a
 * refusal is a real answer already visible on its own step (the
 * "Excluded" pool section), and repeating it here read as clutter, not
 * confirmation.
 */
export function SelectionSummary({
  selections,
  conflicts = [],
  trimRanking = [],
}: {
  selections: ConfiguratorSelection[];
  /** See RankConflict's own comment -- defaults to none so any other
   *  future caller isn't forced to compute this. */
  conflicts?: RankConflict[];
  /**
   * Pre-formatted, already-ranked trim labels (2026-09-21) -- e.g.
   * `["XSE", "LE 2026"]` -- rendered as one more numbered-list line,
   * first, using the exact same "{i+1}. {value}" shape every other
   * category below already uses. Trim ranking lives in
   * `search_trim_preferences`/`rankedTrimIds`, not `ConfiguratorSelection`
   * (a trim isn't a category in that type), so it can't fall out of the
   * `byCategory` loop below for free -- the caller (finalize-self-
   * service.tsx) computes the labels (same year-suffix rule the trim
   * step's own list already uses) and passes them in already formatted,
   * same division of labour as `conflicts`. No conflict-checking applies
   * to trim -- it's the thing every other category's conflict is checked
   * AGAINST, not something checked itself -- and, per the same standing
   * correction as every other category here, only RANKED trims render;
   * excluded ones never do.
   */
  trimRanking?: string[];
}) {
  if (selections.length === 0 && trimRanking.length === 0) return null;
  const byCategory: [ConfiguratorSelection["category"], string][] = [
    ["exterior_color", "Exterior"],
    ["interior", "Interior"],
    ["seating", "Seating"],
    ["feature", "Features"],
  ];
  return (
    <>
      {trimRanking.length > 0 && (
        <p className="mt-1">
          <span className="text-zinc-500">Trim:</span>{" "}
          {trimRanking.map((label, i) => (
            <span key={label}>
              {i > 0 ? ", " : ""}
              {i + 1}. {label}
            </span>
          ))}
        </p>
      )}
      {byCategory.map(([category, label]) => {
        const rows = selections.filter((s) => s.category === category && !s.excluded);
        if (rows.length === 0) return null;
        const ranked = rows
          .filter((r) => r.rankPosition != null)
          .sort((a, b) => (a.rankPosition ?? 0) - (b.rankPosition ?? 0));
        const unordered = rows.filter((r) => r.rankPosition == null);
        const conflictFor = (name: string) =>
          conflicts.find((c) => c.category === category && c.name === name);
        return (
          <p key={category} className="mt-1">
            <span className="text-zinc-500">{label}:</span>{" "}
            {ranked.length > 0
              ? ranked.map((r, i) => {
                  const conflict = conflictFor(r.selection);
                  return (
                    <span key={r.selection}>
                      {i > 0 ? ", " : ""}
                      {i + 1}.{" "}
                      <span className={conflict ? "text-zinc-500 line-through decoration-zinc-600" : undefined}>
                        {r.selection}
                      </span>
                      {conflict ? (
                        <span className="text-amber-400">
                          {" "}
                          — unavailable, not offered by your currently-ranked trim(s)
                          {conflict.offeringTrimLabel ? ` — available on ${conflict.offeringTrimLabel}` : ""}
                        </span>
                      ) : null}
                    </span>
                  );
                })
              : unordered.map((r) => r.selection).join(", ")}
          </p>
        );
      })}
    </>
  );
}
