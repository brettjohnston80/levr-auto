"use client";

import {
  type ConfiguratorChoice,
  type ConfiguratorSelection,
} from "@/lib/configurator-matching";

// The rich configurator question UI (step 7 of 9), shown only for a trim
// that resolved to exactly one researched build. Every other trim -- and
// every one of the 34 makes with no configurator data -- keeps the generic
// colour/options steps unchanged.
//
// RANKING REPLACED THE THREE-WAY PRIORITY SCALE (2026-09-14). The controls
// here are the interim shape: rank-by-click-order plus an explicit "not
// open to it". Step 6 of the redesign replaces the interaction with a pool
// and drag-to-reorder; the DATA shape these emit is already final, which is
// why the write path can be built and verified against it now.

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
 */
export function RankedQuestion({
  title,
  subtitle,
  choices,
  category,
  selections,
  onChange,
}: {
  title: string;
  subtitle: string;
  choices: ConfiguratorChoice[];
  category: ConfiguratorSelection["category"];
  selections: ConfiguratorSelection[];
  onChange: (next: ConfiguratorSelection[]) => void;
}) {
  const mine = selections.filter((s) => s.category === category);
  const entryFor = (name: string) => mine.find((s) => s.selection === name) ?? null;

  /**
   * Rewrites this category's entries, renumbering the ranked ones densely.
   *
   * The server renumbers too, and that is not redundant -- it is the one
   * that guarantees the partial unique index holds. This one exists so the
   * customer sees 1, 2, 3 rather than 1, 3, 4 the instant they unrank
   * something in the middle.
   */
  function commit(next: ConfiguratorSelection[]) {
    const others = selections.filter((s) => s.category !== category);
    const ranked = next
      .filter((s) => !s.excluded)
      .map((s, i) => ({ ...s, rankPosition: i + 1, excluded: false }));
    const excluded = next
      .filter((s) => s.excluded)
      .map((s) => ({ ...s, rankPosition: null, excluded: true }));
    onChange([...others, ...ranked, ...excluded]);
  }

  function entryFrom(choice: ConfiguratorChoice, excluded: boolean): ConfiguratorSelection {
    return {
      category,
      questionKind: "ranked",
      selection: choice.name,
      rankPosition: null,
      excluded,
      packageName: choice.packageName,
      packagePriceCents: choice.packagePriceCents,
      packageContents: choice.packageContents,
      priceUnknown:
        choice.availability === "package_only"
          ? choice.packagePriceCents == null
          : choice.priceCents == null,
    };
  }

  // Ranking appends to the end of the list -- the customer builds their
  // order by picking in order. Clicking a ranked item again unranks it.
  function toggleRank(choice: ConfiguratorChoice) {
    const existing = entryFor(choice.name);
    const rest = mine.filter((s) => s.selection !== choice.name);
    if (existing && !existing.excluded) {
      commit(rest);
      return;
    }
    commit([...rest.filter((s) => !s.excluded), entryFrom(choice, false), ...rest.filter((s) => s.excluded)]);
  }

  // Excluding is a separate statement, not the bottom of the ranking: an
  // unranked option means no opinion, an excluded one means "never offer
  // me this". Conflating them would lose the difference entirely.
  function toggleExclude(choice: ConfiguratorChoice) {
    const existing = entryFor(choice.name);
    const rest = mine.filter((s) => s.selection !== choice.name);
    if (existing?.excluded) {
      commit(rest);
      return;
    }
    commit([...rest, entryFrom(choice, true)]);
  }

  const rankedCount = mine.filter((s) => !s.excluded).length;

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
      <div className="mt-5 space-y-2">
        {choices.map((choice) => {
          const entry = entryFor(choice.name);
          const ranked = entry && !entry.excluded;
          const excluded = entry?.excluded ?? false;
          return (
            <div
              key={choice.name}
              className={`rounded-xl border p-3.5 transition-colors ${
                ranked
                  ? "border-emerald-500/60 bg-emerald-500/[0.07]"
                  : excluded
                    ? "border-amber-500/40 bg-amber-500/[0.05]"
                    : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-sm font-medium text-white">
                  {ranked ? (
                    <span className="mr-1.5 text-emerald-400">{entry!.rankPosition}.</span>
                  ) : null}
                  {choice.name}
                </span>
                <PriceTag choice={choice} />
              </div>
              <PackageNote choice={choice} />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleRank(choice)}
                  aria-pressed={!!ranked}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    ranked
                      ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  }`}
                >
                  {ranked ? `Ranked #${entry!.rankPosition}` : `Rank it #${rankedCount + 1}`}
                </button>
                <button
                  type="button"
                  onClick={() => toggleExclude(choice)}
                  aria-pressed={excluded}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    excluded
                      ? "border-amber-500 bg-amber-500 text-zinc-950"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  }`}
                >
                  Not open to it
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
  choices,
  selections,
  onChange,
}: {
  choices: ConfiguratorChoice[];
  selections: ConfiguratorSelection[];
  onChange: (next: ConfiguratorSelection[]) => void;
}) {
  const isOn = (name: string) =>
    selections.some((s) => s.category === "feature" && s.selection === name);

  function toggle(choice: ConfiguratorChoice) {
    if (isOn(choice.name)) {
      onChange(
        selections.filter((s) => !(s.category === "feature" && s.selection === choice.name)),
      );
      return;
    }
    onChange([
      ...selections,
      {
        category: "feature",
        questionKind: "feature",
        selection: choice.name,
        // Features are never ranked and never excluded -- they are
        // independent adds, not competing choices, so there is no order to
        // express between "heated wheel" and "moonroof".
        rankPosition: null,
        excluded: false,
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
        These cost extra on this trim — everything else it comes with already. Optional.
      </p>
      <div className="mt-5 space-y-2">
        {choices.map((choice) => {
          const active = isOn(choice.name);
          return (
            <button
              key={choice.name}
              type="button"
              onClick={() => toggle(choice)}
              aria-pressed={active}
              className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                active
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-sm font-medium text-white">{choice.name}</span>
                <PriceTag choice={choice} />
              </div>
              <PackageNote choice={choice} />
            </button>
          );
        })}
      </div>
    </div>
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
        // -- "not open to black" and "black last" are different answers.
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
                not open to: {excluded.map((r) => r.selection).join(", ")}
              </span>
            ) : null}
          </p>
        );
      })}
    </>
  );
}
