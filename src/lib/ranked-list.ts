// Shared normalization for the ranked-preference model (2026-09-14).
//
// Lives in its own module rather than beside its caller because
// finalize-actions.ts carries "use server", and a "use server" file may
// only export async functions -- the same constraint that already split
// inventory-radius.ts out of inventory-count.ts and
// communication-preferences.ts out of auth-actions.ts. Being a plain
// module also makes it directly exercisable, which a Server Action is not.

export interface RankedShape {
  rankPosition: number | null;
  excluded: boolean;
}

export interface NormalizedRanked<T> {
  ranked: { item: T; rankPosition: number }[];
  excluded: { item: T; rankPosition: null }[];
}

/**
 * Ranked lists arrive from a browser, so they cannot be trusted to be
 * dense, unique, or even internally consistent.
 *
 * Both ranked tables carry a PARTIAL UNIQUE INDEX on rank_position, so a
 * client that sends two items at rank 1 -- trivially producible by a
 * double-tap during a reorder -- would fail the whole insert and take
 * every other answer down with it. Sorting by the claimed rank and
 * renumbering 1..n keeps the customer's ordering exactly while making the
 * result structurally incapable of violating the index.
 *
 * The sort is STABLE on arrival order, so duplicate claimed ranks resolve
 * to a deterministic winner rather than whichever one the engine's sort
 * happened to move first.
 *
 * `excluded` wins over any rank the item also claims: the two states are
 * mutually exclusive in the check constraint, and refusing something is
 * the stronger, more explicit statement of the two.
 */
export function normalizeRanked<T>(
  items: T[],
  shapeOf: (item: T) => RankedShape,
): NormalizedRanked<T> {
  const excluded = items
    .filter((i) => shapeOf(i).excluded)
    .map((item) => ({ item, rankPosition: null as null }));

  const ranked = items
    .filter((i) => {
      const s = shapeOf(i);
      return !s.excluded && s.rankPosition != null;
    })
    .map((item, arrivalIndex) => ({
      item,
      claimed: shapeOf(item).rankPosition as number,
      arrivalIndex,
    }))
    .sort((a, b) => a.claimed - b.claimed || a.arrivalIndex - b.arrivalIndex)
    .map(({ item }, i) => ({ item, rankPosition: i + 1 }));

  return { ranked, excluded };
}

/**
 * An item that is neither ranked nor excluded says nothing at all.
 *
 * Storing it would produce a half-populated row that the shape constraint
 * rejects anyway -- and if it somehow got through, an agent would read a
 * preference the customer never expressed.
 */
export function statesAnOpinion(shape: RankedShape): boolean {
  return shape.excluded || shape.rankPosition != null;
}
