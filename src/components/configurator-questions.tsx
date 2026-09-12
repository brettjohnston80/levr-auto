"use client";

import {
  PRIORITY_LABELS,
  type ConfiguratorChoice,
  type ConfiguratorSelection,
  type SelectionPriority,
} from "@/lib/configurator-matching";

// The rich configurator question UI (step 7 of 9), shown only for a trim
// that resolved to exactly one researched build. Every other trim -- and
// every one of the 34 makes with no configurator data -- keeps the generic
// colour/options steps unchanged.

const PRIORITIES: SelectionPriority[] = ["must_have", "like_to_have", "open_to"];

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
 * A colour / interior / seating question: pick a value AND say how
 * strongly you want it.
 *
 * The three priority buttons ARE the selection control -- there is no
 * separate "select this" step that then needs a strength defaulted in
 * afterwards. That is deliberate: a default would record intent the
 * customer never expressed, and an agent reading must_have will hold out
 * for it in a real negotiation.
 */
export function PreferenceQuestion({
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
  const priorityFor = (name: string): SelectionPriority | null =>
    selections.find((s) => s.category === category && s.selection === name)?.priority ?? null;

  function set(choice: ConfiguratorChoice, priority: SelectionPriority) {
    const others = selections.filter(
      (s) => !(s.category === category && s.selection === choice.name),
    );
    // Clicking the priority a choice already has clears it -- the same
    // button both selects and deselects, so there is no way to end up with
    // a selection whose strength was never chosen.
    if (priorityFor(choice.name) === priority) {
      onChange(others);
      return;
    }
    onChange([
      ...others,
      {
        category,
        questionKind: "preference",
        selection: choice.name,
        priority,
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
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
      <div className="mt-5 space-y-2">
        {choices.map((choice) => {
          const active = priorityFor(choice.name);
          return (
            <div
              key={choice.name}
              className={`rounded-xl border p-3.5 transition-colors ${
                active
                  ? "border-emerald-500/60 bg-emerald-500/[0.07]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-sm font-medium text-white">{choice.name}</span>
                <PriceTag choice={choice} />
              </div>
              <PackageNote choice={choice} />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set(choice, p)}
                    aria-pressed={active === p}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      active === p
                        ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                        : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                    }`}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
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
        priority: null,
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
        return (
          <p key={category} className="mt-1">
            <span className="text-zinc-500">{label}:</span>{" "}
            {rows
              .map((r) =>
                r.priority
                  ? `${r.selection} (${PRIORITY_LABELS[r.priority].toLowerCase()})`
                  : r.selection,
              )
              .join(", ")}
          </p>
        );
      })}
    </>
  );
}
