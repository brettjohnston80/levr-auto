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

function PriceTag({ choice }: { choice: ConfiguratorChoice }) {
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
 */
function PackageNote({ choice }: { choice: ConfiguratorChoice }) {
  if (choice.availability !== "package_only" || !choice.packageName) return null;
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
      Only available in the <span className="text-zinc-400">{choice.packageName}</span>
      {choice.packageContents && choice.packageContents.length > 0 && (
        <> — also includes {choice.packageContents.join(", ")}</>
      )}
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
}: {
  title: string;
  subtitle: string;
  rankable: ConfiguratorChoice[];
  autoExcluded: AutoExcludedChoice[];
  category: ConfiguratorSelection["category"];
  selections: ConfiguratorSelection[];
  onChange: (next: ConfiguratorSelection[]) => void;
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

  const autoExcludedItems = visibleAutoExcluded.map(({ choice, note }) => ({
    item: toItem(choice),
    note,
  }));

  function handleChange(nextRanked: string[], nextExcluded: string[]) {
    const others = selections.filter((s) => s.category !== category);
    const build = (name: string, rankPosition: number | null, isExcluded: boolean) => {
      const c = byName.get(name);
      if (!c) return null;
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
      onChange={handleChange}
    />
  );
}

/**
 * The features question: a plain yes/no checklist, no strength.
 *
 * Only genuinely obtainable items appear -- anything the trim already
 * comes with is omitted (there is nothing to ask), and anything the trim
 * cannot be built with is never offered. Only ticked features are ever
 * stored: to an agent, an unticked feature and an unasked one mean the
 * same thing.
 */
export function FeatureQuestion({
  rankable,
  autoExcluded,
  selections,
  onChange,
}: {
  rankable: ConfiguratorChoice[];
  autoExcluded: AutoExcludedChoice[];
  selections: ConfiguratorSelection[];
  onChange: (next: ConfiguratorSelection[]) => void;
}) {
  const entryFor = (name: string) =>
    selections.find((s) => s.category === "feature" && s.selection === name) ?? null;

  /**
   * Sets a feature to wanted, refused, or back to neutral.
   *
   * NEUTRAL STORES NOTHING AT ALL, and that is the point: to an agent, a
   * feature the customer never mentioned and one they were never asked
   * about mean the same thing. Only an actual statement -- "get me this"
   * or "never offer me this" -- earns a row.
   */
  function set(choice: ConfiguratorChoice, excluded: boolean) {
    const rest = selections.filter(
      (s) => !(s.category === "feature" && s.selection === choice.name),
    );
    const current = entryFor(choice.name);
    // Clicking the pill a feature already has clears it, the same
    // toggle-off behaviour the ranked control uses -- so the same button
    // both sets and unsets, and there is no way to end up in a state the
    // customer cannot get back out of.
    if (current && current.excluded === excluded) {
      onChange(rest);
      return;
    }
    onChange([
      ...rest,
      {
        category: "feature",
        questionKind: "feature",
        selection: choice.name,
        // Never ranked. There is no meaningful ordering between "heated
        // steering wheel" and "moonroof" -- they are independent adds, not
        // competing choices, which is why features stayed off the ranked
        // model when colours moved onto it.
        rankPosition: null,
        excluded,
        packageName: choice.packageName,
        packagePriceCents: choice.packagePriceCents,
        packageContents: choice.packageContents,
        priceUnknown:
          choice.availability === "package_only"
            ? choice.packagePriceCents == null
            : choice.priceCents == null,
      },
    ]);
  }

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-white">Any of these worth asking for?</h2>
      <p className="mt-2 text-sm text-zinc-400">
        These aren&apos;t included on this trim by default. Tell us which you want, or flag any
        you&apos;d rather not have. Skipping one is fine.
      </p>
      <div className="mt-5 space-y-2">
        {rankable.map((choice) => {
          const entry = entryFor(choice.name);
          const wanted = entry !== null && !entry.excluded;
          const refused = entry?.excluded ?? false;
          return (
            // Stacks below sm for the same measured reason as the ranking
            // pool rows: side by side, two pills take ~150px of a 390px
            // screen and the label truncates.
            <div
              key={choice.name}
              className={`flex flex-col gap-2.5 rounded-xl border p-3.5 transition-colors sm:flex-row sm:items-center sm:gap-3 ${
                wanted
                  ? "border-emerald-500/60 bg-emerald-500/[0.07]"
                  : refused
                    ? "border-amber-500/40 bg-amber-500/[0.05]"
                    : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <FeatureThumb url={choice.imageUrl ?? null} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-sm font-medium text-white">{choice.name}</span>
                    <PriceTag choice={choice} />
                  </div>
                  <PackageNote choice={choice} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:justify-end">
                <button
                  type="button"
                  onClick={() => set(choice, false)}
                  aria-pressed={wanted}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    wanted
                      ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  }`}
                >
                  Want it
                </button>
                <button
                  type="button"
                  onClick={() => set(choice, true)}
                  aria-pressed={refused}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    refused
                      ? "border-amber-500 bg-amber-500 text-zinc-950"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-amber-500/60 hover:text-amber-300"
                  }`}
                >
                  Exclude
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-excluded (2026-09-16): a feature no CURRENTLY RANKED trim
          offers -- a live-computed fact, never something the customer can
          want/exclude, so no buttons here, just the note. Own block below
          the interactive list, matching the ranked-category convention
          (RankingQuestion's own auto-excluded block) as closely as this
          component's flat-list shape allows -- features has no separate
          "customer excluded" section to sit alongside, so this is the one
          new grouping in this component. */}
      {autoExcluded.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Not offered on your selected trims
          </p>
          <div className="mt-2 space-y-1.5">
            {autoExcluded.map(({ choice, note }) => (
              <div
                key={choice.name}
                className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 opacity-60 sm:flex-row sm:items-start sm:gap-3"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <FeatureThumb url={choice.imageUrl ?? null} />
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-300">{choice.name}</span>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{note}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A feature photo when one exists, and NOTHING otherwise -- same rules as
 * the ranking pool's thumbnail: no placeholder box, and a file that fails
 * to load removes itself rather than showing a broken-image glyph.
 */
function FeatureThumb({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    // Arbitrary files dropped into public/, not a fixed set next/image can
    // be configured against.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className="h-10 w-14 shrink-0 rounded-md object-cover"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

/** Compact read-back of every answer, for the review step. */
export function SelectionSummary({ selections }: { selections: ConfiguratorSelection[] }) {
  if (selections.length === 0) return null;
  const byCategory: [ConfiguratorSelection["category"], string][] = [
    ["exterior_color", "Exterior"],
    ["interior", "Interior"],
    ["seating", "Seating"],
    ["feature", "Features"],
  ];
  return (
    <>
      {byCategory.map(([category, label]) => {
        const rows = selections.filter((s) => s.category === category);
        if (rows.length === 0) return null;
        // Reads back as the ordered list the customer actually built, with
        // refusals called out separately rather than folded in at the end
        // -- "excluded: black" and "black last" are different answers.
        const ranked = rows
          .filter((r) => !r.excluded && r.rankPosition != null)
          .sort((a, b) => (a.rankPosition ?? 0) - (b.rankPosition ?? 0));
        const excluded = rows.filter((r) => r.excluded);
        const unordered = rows.filter((r) => !r.excluded && r.rankPosition == null);
        return (
          <p key={category} className="mt-1">
            <span className="text-zinc-500">{label}:</span>{" "}
            {ranked.length > 0
              ? ranked.map((r, i) => `${i + 1}. ${r.selection}`).join(", ")
              : unordered.map((r) => r.selection).join(", ")}
            {excluded.length > 0 ? (
              <span className="text-amber-400">
                {ranked.length > 0 || unordered.length > 0 ? " — " : ""}
                excluded: {excluded.map((r) => r.selection).join(", ")}
              </span>
            ) : null}
          </p>
        );
      })}
    </>
  );
}
