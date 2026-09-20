"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useDragReorder } from "@/lib/use-drag-reorder";
import type { ColorSwatchValue } from "@/lib/vehicle-color-swatches";

/**
 * The ranked-preference interaction (step 6 of the redesign), replacing the
 * interim click-to-rank buttons shipped with the write path in step 4.
 *
 * THREE ZONES, AND THE MIDDLE ONE IS THE POINT. A customer builds an
 * ordered list by tapping options out of a neutral pool; anything they
 * never touch stays in the pool and is stored as nothing at all. That
 * silence is a real answer -- "no opinion" -- and is why there is no
 * neutral button to press. Exclusions are a separate, explicit statement:
 * "never offer me this", which is materially different from ranking
 * something last, and is reversible straight back to the pool.
 *
 * ONE COMPONENT FOR ALL FOUR CATEGORIES -- exterior colour, interior,
 * seating and trim. They genuinely share the shape: a list of real
 * available options, an order, a set of refusals. Trim differs only in what
 * happens DOWNSTREAM of a change (its #1 selects which configurator build's
 * questions get asked), which is the caller's concern, not this one's --
 * so the shared component stays honest rather than growing a trim flag.
 */

export interface RankableItem {
  /** Stable identity. For trim this is trim+year, not the trim name. */
  id: string;
  label: string;
  /** Model year, price, etc -- shown muted beside the label. */
  sublabel?: string | null;
  /** Real photo, when we have one. Null is the normal case. */
  imageUrl?: string | null;
  /**
   * Small colour-code swatch, ALONGSIDE the photo, never instead of it.
   * Null for trim/seating items and for any colour with no hand-checked
   * code. See vehicle-color-swatches.ts.
   */
  swatch?: ColorSwatchValue | null;
  /** Package context and price notes, rendered under the label. */
  detail?: React.ReactNode;
}

export function RankingQuestion({
  title,
  subtitle,
  items,
  ranked,
  excluded,
  autoExcluded,
  removeMeansExclude,
  onChange,
  afterSubtitle,
}: {
  title: string;
  subtitle: string;
  items: RankableItem[];
  /** Item ids, in the customer's order. */
  ranked: string[];
  /** Item ids the customer refused. */
  excluded: string[];
  /**
   * Items no CURRENTLY RANKED trim offers (2026-09-16) -- a live-computed
   * fact about trim availability, never a customer statement, so these
   * never appear in `items`/`ranked`/`excluded` at all. Rendered in their
   * own block below "Excluded", same visual shell, but with no Undo
   * control (there's nothing to undo) and a note in its place.
   */
  autoExcluded?: { item: RankableItem; note: React.ReactNode }[];
  /**
   * Whether the ✕ on a ranked row means "exclude this" rather than "no
   * opinion, back to the pool". Every category -- trim, exterior colour,
   * interior, seating -- defaults to the pool-return behaviour (prop
   * omitted): "I have no opinion" is a real, meaningful state for all of
   * them, and no current caller passes true. Kept as an opt-in for a
   * category that might someday start fully ranked with no neutral state
   * left to return to (exterior colour/interior/seating briefly worked
   * this way, 2026-09-16 to 2026-09-19 -- see git history if that's ever
   * revisited).
   */
  removeMeansExclude?: boolean;
  onChange: (ranked: string[], excluded: string[]) => void;
  /** Rendered directly after the subtitle text -- e.g. the trim step's
   *  "Compare trims" link. Generic rather than trim-specific: any future
   *  category-level affordance that belongs with the question's own
   *  intro text, not floating above it, can use the same slot. */
  afterSubtitle?: React.ReactNode;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const rankedItems = ranked.map((id) => byId.get(id)).filter(Boolean) as RankableItem[];
  const excludedItems = excluded.map((id) => byId.get(id)).filter(Boolean) as RankableItem[];
  const poolItems = items.filter((i) => !ranked.includes(i.id) && !excluded.includes(i.id));

  const drag = useDragReorder(ranked, (next) => onChange(next, excluded));

  // Ranking appends: the customer builds their order by choosing in order,
  // then adjusts by dragging. Anything already excluded is released first,
  // so the two lists can never both claim the same option.
  const rank = (id: string) => onChange([...ranked, id], excluded.filter((e) => e !== id));
  const unrank = (id: string) => onChange(ranked.filter((r) => r !== id), excluded);
  const exclude = (id: string) => onChange(ranked.filter((r) => r !== id), [...excluded, id]);
  // Plain unexclude releases back to the neutral pool (trim's behaviour,
  // unchanged). When removeMeansExclude is set there IS no neutral pool
  // for these categories, so Undo goes straight back into "Your order" --
  // appended here, then re-sorted into its actual price-sorted slot one
  // layer up (RankedQuestion's handleChange normalizes on every onChange
  // uniformly, so this doesn't need to know where "the right slot" is).
  const unexclude = (id: string) =>
    removeMeansExclude
      ? onChange([...ranked, id], excluded.filter((e) => e !== id))
      : onChange(ranked, excluded.filter((e) => e !== id));
  const removeFromOrder = removeMeansExclude ? exclude : unrank;

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
      {afterSubtitle}

      {/* ---- Ranked ---- */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your order {rankedItems.length > 0 ? `(${rankedItems.length})` : ""}
        </p>
        {rankedItems.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-5 text-center text-sm text-zinc-500">
            {removeMeansExclude
              ? // Categories that start fully ranked have no pool to "tap
                // below" -- reaching zero here only happens by excluding
                // everything, and the only way back is Undo in Excluded.
                "Everything's been excluded — use Undo below to bring something back."
              : "Nothing ranked yet — tap an option below to start your list."}
          </p>
        ) : (
          <ol className="mt-2 space-y-1">
            {rankedItems.map((item, index) => (
              <li
                key={item.id}
                ref={drag.setItemRef(item.id)}
                // transition-colors only, never transition-all -- the lift
                // applies a transform, and transitioning that makes the
                // carried row visibly lag the finger on pickup.
                className={`flex items-stretch gap-2 rounded-[10px] border transition-colors ${
                  drag.dragIndex === index
                    ? "relative z-10 scale-[1.02] border-emerald-500 bg-emerald-500/10 shadow-lg shadow-black/50"
                    : "border-emerald-500/40 bg-emerald-500/[0.07]"
                }`}
              >
                {/*
                  FULL-HEIGHT grab strip, not a centred square. A 44x44
                  island inside a taller row leaves a dead band above and
                  below it -- measured at only 56% of row height grabbable
                  on the matchmaker ranker, which felt broken on a real
                  phone even though it hit-tested perfectly. Worse, a near
                  miss lands on the row itself, whose touch-action is auto,
                  so the browser instantly claims the gesture as a page
                  scroll with no recovery. self-stretch plus a visible tint
                  because people aim at what they can see.
                */}
                <span
                  onPointerDown={(e) => drag.handlePointerDown(e, index)}
                  onPointerMove={drag.handlePointerMove}
                  onPointerUp={drag.handlePointerEnd}
                  onPointerCancel={drag.handlePointerEnd}
                  // The only touch-action:none surface on the row, so
                  // ordinary page scrolling still works everywhere else.
                  className="flex w-11 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-l-[10px] bg-white/[0.04] text-zinc-500 active:cursor-grabbing"
                  aria-label={`Reorder ${item.label}`}
                  role="button"
                  tabIndex={-1}
                >
                  <svg width="16" height="22" viewBox="0 0 16 22" aria-hidden="true">
                    {[5, 11, 17].map((y) => (
                      <g key={y}>
                        <circle cx="5" cy={y} r="1.6" fill="currentColor" />
                        <circle cx="11" cy={y} r="1.6" fill="currentColor" />
                      </g>
                    ))}
                  </svg>
                </span>

                <span className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
                  <span className="w-5 shrink-0 text-sm font-semibold text-emerald-400">
                    {index + 1}.
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Thumb item={item} />
                    <ColorDot item={item} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">
                      {item.label}
                      {item.sublabel ? (
                        <span className="ml-1.5 font-normal text-zinc-500">{item.sublabel}</span>
                      ) : null}
                    </span>
                    {item.detail}
                  </span>
                </span>

                {/* Arrow buttons are not decoration: they are the only
                    reorder path for keyboard and assistive-tech users, and
                    a real fallback on a device where the drag misbehaves. */}
                <span className="flex shrink-0 items-center gap-1 pr-1.5">
                  <MiniButton
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...ranked];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      onChange(next, excluded);
                    }}
                  >
                    ↑
                  </MiniButton>
                  <MiniButton
                    label="Move down"
                    disabled={index === rankedItems.length - 1}
                    onClick={() => {
                      const next = [...ranked];
                      [next[index], next[index + 1]] = [next[index + 1], next[index]];
                      onChange(next, excluded);
                    }}
                  >
                    ↓
                  </MiniButton>
                  {/* Labeled text, not a bare icon (2026-09-19) -- and
                      deliberately "Remove", not "Exclude": this button
                      calls removeFromOrder, which for every category today
                      returns the item to the neutral pool (or, only when
                      removeMeansExclude is ever true again, straight back
                      into "Your order" -- never to the Excluded list
                      either way), so "Exclude" would describe an action
                      this control doesn't perform. Confirmed with Brett via
                      an explicit question before implementing. */}
                  <button
                    type="button"
                    onClick={() => removeFromOrder(item.id)}
                    aria-label={`Remove ${item.label}`}
                    className="ml-1 shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/35"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ---- Pool ---- */}
      {poolItems.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {rankedItems.length > 0 ? "Also available" : "Available"}
          </p>
          <div className="mt-2 space-y-1.5">
            {poolItems.map((item) => (
              // Stacks below sm. Side by side, the two action buttons take
              // ~150px of a 390px screen and the label truncates to
              // "Nightsha..." -- measured, not guessed. Full width first,
              // buttons underneath.
              <div
                key={item.id}
                className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Thumb item={item} />
                    <ColorDot item={item} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {item.label}
                      {item.sublabel ? (
                        <span className="ml-1.5 font-normal text-zinc-500">{item.sublabel}</span>
                      ) : null}
                    </p>
                    {item.detail}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => rank(item.id)}
                    className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
                  >
                    Rank #{rankedItems.length + 1}
                  </button>
                  <button
                    type="button"
                    onClick={() => exclude(item.id)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-400 transition-colors hover:border-amber-500/60 hover:text-amber-300"
                  >
                    Exclude
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Excluded ---- */}
      {excludedItems.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400/80">
            Excluded ({excludedItems.length})
          </p>
          <div className="mt-2 space-y-1.5">
            {excludedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3"
              >
                <span className="shrink-0 text-amber-400">✕</span>
                <p className="min-w-0 flex-1 text-sm font-medium text-zinc-300 line-through decoration-amber-500/50">
                  {item.label}
                  {item.sublabel ? (
                    <span className="ml-1.5 font-normal text-zinc-500">{item.sublabel}</span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => unexclude(item.id)}
                  className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/35"
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Auto-excluded (2026-09-16) ---- Same shell as Excluded, but
          there is nothing to Undo: this is a live fact about which of the
          customer's CURRENTLY RANKED trims offer this, not something they
          said. The note explains why, and names a real trim to add
          instead of a button. */}
      {autoExcluded && autoExcluded.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Not offered on your selected trims ({autoExcluded.length})
          </p>
          <div className="mt-2 space-y-1.5">
            {autoExcluded.map(({ item, note }) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 opacity-60"
              >
                <span className="shrink-0 pt-0.5 text-zinc-500">–</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-300">
                    {item.label}
                    {item.sublabel ? (
                      <span className="ml-1.5 font-normal text-zinc-500">{item.sublabel}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{note}</p>
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
 * A real photo when one exists, and NOTHING otherwise.
 *
 * Deliberately renders no element at all rather than a placeholder box --
 * an image-shaped grey square with an icon in it reads to a customer as
 * something being broken. Almost every vehicle has no photos, so the
 * absent case is the normal one and has to look deliberate.
 *
 * Exported (2026-09-17) so combinations-question.tsx can render a SECOND
 * swatch/photo pair (the interior, alongside this row's own exterior
 * colour one) with the identical rendering rules -- never a reimplemented
 * copy that could drift on the no-placeholder behaviour above.
 */
/** A minimal X, matching the inline-SVG-per-file convention every other
 *  modal in this codebase already uses rather than a shared icon module
 *  (trim-comparison-modal.tsx/trim-detail-modal.tsx each define their own
 *  CloseIcon too). */
function LightboxCloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A real photo, click-to-enlarge (2026-09-20). Swatches (ColorDot, below)
 * deliberately do NOT get this -- a flat colour circle has no extra detail
 * a bigger version would reveal, while a real photo genuinely does. Every
 * caller of Thumb (the ranking pool, combinations, trim detail, trim
 * comparison) gets the lightbox for free by construction, since this is
 * the ONE place any of them render a real photo -- no per-caller wiring.
 */
export function Thumb({ item }: { item: RankableItem }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Same "remove outright, never leave the broken-image glyph" rule as
  // before -- now a state flag rather than direct DOM manipulation, since
  // hiding just the <img> would leave an empty, still-clickable button
  // behind.
  if (!item.imageUrl || broken) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={item.label ? `Enlarge photo of ${item.label}` : "Enlarge photo"}
        className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- these are
            arbitrary files dropped into public/ at deploy time, not a
            fixed set next/image can be configured against. */}
        <img
          src={item.imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-10 w-14 rounded-md object-cover"
          onError={() => setBroken(true)}
        />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={item.label ? `${item.label} photo` : "Photo"}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6"
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <LightboxCloseIcon />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.label || ""}
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * A small colour-code circle, next to the real photo -- never instead of
 * it. Solid colours are a plain filled circle; two-tone colours split
 * diagonally, body colour on one half and the second colour on the other,
 * via an oversized rotated rect clipped by the circle (a fixed 45° split
 * regardless of where the two source rects start, so it can't render
 * off-centre from rounding).
 *
 * 42px (2026-09-16, doubled again from 21px per Brett's request -- up from
 * an initial 14px). ⚠ This is now LARGER than the 40px-tall photo
 * thumbnail it sits beside, a deliberate reversal of the original "smaller
 * than the photo, not competing for attention" sizing rule -- flagged
 * explicitly since a future pass might otherwise assume that comment is
 * still the live constraint.
 */
export function ColorDot({ item }: { item: RankableItem }) {
  const clipId = useId();
  if (!item.swatch) return null;
  if (item.swatch.kind === "solid") {
    return (
      <span
        className="h-[42px] w-[42px] shrink-0 rounded-full ring-1 ring-inset ring-white/20"
        style={{ backgroundColor: item.swatch.hex }}
        aria-hidden="true"
      />
    );
  }
  return (
    <svg width="42" height="42" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <defs>
        <clipPath id={clipId}>
          <circle cx="10" cy="10" r="9" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="20" height="20" fill={item.swatch.bodyHex} />
        {/* Oversized rect covering the half-plane x>=10, rotated 45° about
            the circle's own centre -- guarantees a clean diagonal bisection
            regardless of the circle's exact radius, with no edge gaps. */}
        <rect x="10" y="-15" width="30" height="50" fill={item.swatch.secondHex} transform="rotate(45 10 10)" />
      </g>
      <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
    </svg>
  );
}

// 56x56 (2026-09-19, explicit instruction: at least 2x the original 28x28)
// -- only ever the Move up/Move down reorder arrows now; the third slot
// this used to hold (a bare "X" remove icon) is a separate, differently
// styled labeled button below, not a MiniButton variant.
function MiniButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-14 w-14 items-center justify-center rounded-md text-2xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
    >
      {children}
    </button>
  );
}
