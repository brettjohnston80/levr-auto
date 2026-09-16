"use client";

import { useDragReorder } from "@/lib/use-drag-reorder";

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
  /** Package context and price notes, rendered under the label. */
  detail?: React.ReactNode;
}

export function RankingQuestion({
  title,
  subtitle,
  items,
  ranked,
  excluded,
  onChange,
}: {
  title: string;
  subtitle: string;
  items: RankableItem[];
  /** Item ids, in the customer's order. */
  ranked: string[];
  /** Item ids the customer refused. */
  excluded: string[];
  onChange: (ranked: string[], excluded: string[]) => void;
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
  const unexclude = (id: string) => onChange(ranked, excluded.filter((e) => e !== id));

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>

      {/* ---- Ranked ---- */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your order {rankedItems.length > 0 ? `(${rankedItems.length})` : ""}
        </p>
        {rankedItems.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-5 text-center text-sm text-zinc-500">
            Nothing ranked yet — tap an option below to start your list.
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
                  <Thumb item={item} />
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
                <span className="flex shrink-0 items-center gap-0.5 pr-1.5">
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
                  <MiniButton label={`Remove ${item.label}`} onClick={() => unrank(item.id)}>
                    ✕
                  </MiniButton>
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
                  <Thumb item={item} />
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
 */
function Thumb({ item }: { item: RankableItem }) {
  if (!item.imageUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- these are
    // arbitrary files dropped into public/ at deploy time, not a fixed set
    // next/image can be configured against.
    <img
      src={item.imageUrl}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className="h-10 w-14 shrink-0 rounded-md object-cover"
      // If a file vanishes or fails to decode, remove the element outright
      // rather than leaving the browser's broken-image glyph on screen.
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

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
      className="flex h-7 w-7 items-center justify-center rounded-md text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
    >
      {children}
    </button>
  );
}
