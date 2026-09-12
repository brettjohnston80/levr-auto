// Matchmaker -> intake hand-off ("Choose this car", step 3 of 5).
//
// A customer who finds a vehicle on /matchmaker and clicks through to
// intake currently arrives with nothing: make, model, the price estimate
// and the model year they were just looking at are all lost at the
// boundary. This carries them across.
//
// ---------------------------------------------------------------------------
// THIS IS PRE-FILL ONLY. IT MUST NEVER RESUME A CHECKOUT.
// ---------------------------------------------------------------------------
// intake-filter.tsx already has two localStorage mechanisms, and both exist
// to RESUME AN INTERRUPTED PURCHASE after signing in:
//
//   levr_pending_intake            -> readPendingIntake()
//   levr_pending_undecided_intake  -> hasPendingUndecidedIntake()
//
// Its resume effect reads those two and, for a signed-in user, calls
// performSave() or performUndecidedSave(). The undecided branch goes
// straight to `window.location.href = checkoutResult.url` -- a real Stripe
// redirect with no further click.
//
// That is not hypothetical. On 2026-08-23 a stray click put a customer on a
// real Stripe checkout with zero fresh intent, because the undecided flag
// had no expiry and fired on a much later, unrelated sign-in. The fix was a
// 1-hour TTL; the lesson is that anything in localStorage which can reach
// performSave/performUndecidedSave is a loaded gun.
//
// So this mechanism is deliberately built as a SEPARATE FILE with its own
// key and its own functions, sharing no code with those two. It is a
// distinct kind of thing -- "here is what the customer was looking at",
// not "here is a purchase that was interrupted" -- and the separation is
// what keeps the two from ever being conflated. Whatever eventually reads
// this must only populate visible form fields. It must never call
// performSave, performUndecidedSave or createCheckoutSession, and it must
// never be added to the resume effect.
//
// Intentionally imports nothing -- no React, no server modules -- so it can
// be used from the Matchmaker (writer) and from intake (reader) without
// dragging anything into either bundle.

const MATCHMAKER_PREFILL_KEY = "levr_matchmaker_prefill";

/**
 * Ten minutes, deliberately much shorter than the 1-hour TTL on the two
 * resume keys. Those have to survive a round trip through an email
 * confirmation link; this one only has to survive a click from /matchmaker
 * to the intake form on the same site. A stale pre-fill is less dangerous
 * than a stale resume, but it is still wrong -- it would silently put a
 * vehicle in front of someone who came back later for something else.
 */
const MATCHMAKER_PREFILL_TTL_MS = 10 * 60 * 1000;

/** Sanity bounds for a model year; also keeps it inside smallint. */
const MIN_MODEL_YEAR = 1900;
const MAX_MODEL_YEAR = 2100;

export interface MatchmakerPrefill {
  make: string;
  model: string;
  /** Matchmaker's researched price ESTIMATE, integer cents. Never a quote. */
  matchmakerPriceCents: number | null;
  matchmakerModelYear: number | null;
}

interface StoredPrefill extends MatchmakerPrefill {
  savedAt: number;
}

/** localStorage is unavailable during SSR and can throw in private modes. */
function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPositiveIntOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0);
}

/**
 * Stores what the customer was looking at on /matchmaker.
 *
 * Nothing here is authoritative. The price is an estimate and the model
 * year is context; both land in display/reference-only columns
 * (customer_searches.matchmaker_price_cents / matchmaker_model_year) that
 * pricing and guarantee logic never read.
 */
export function stashMatchmakerPrefill(prefill: MatchmakerPrefill): void {
  const store = storage();
  if (!store) return;
  const payload: StoredPrefill = { ...prefill, savedAt: Date.now() };
  try {
    store.setItem(MATCHMAKER_PREFILL_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private-mode failure. Losing a pre-fill is a cosmetic loss --
    // the customer just fills the form in themselves -- so never throw.
  }
}

/**
 * Reads a live pre-fill, or null.
 *
 * Expired entries are treated as absent AND removed, so a stale vehicle can
 * never reappear later. Anything malformed is also treated as absent:
 * localStorage is user-writable, and these values are ultimately destined
 * for typed integer/smallint columns, so a hand-edited entry must not be
 * able to push a string or a float into them.
 */
export function readMatchmakerPrefill(): MatchmakerPrefill | null {
  const store = storage();
  if (!store) return null;

  const raw = store.getItem(MATCHMAKER_PREFILL_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredPrefill;

    if (typeof parsed?.savedAt !== "number" || !Number.isFinite(parsed.savedAt)) {
      clearMatchmakerPrefill();
      return null;
    }
    if (Date.now() - parsed.savedAt > MATCHMAKER_PREFILL_TTL_MS) {
      clearMatchmakerPrefill();
      return null;
    }

    const make = typeof parsed.make === "string" ? parsed.make.trim() : "";
    const model = typeof parsed.model === "string" ? parsed.model.trim() : "";
    // A pre-fill with no vehicle is not a pre-fill.
    if (!make || !model) {
      clearMatchmakerPrefill();
      return null;
    }
    if (
      !isPositiveIntOrNull(parsed.matchmakerPriceCents) ||
      !isPositiveIntOrNull(parsed.matchmakerModelYear)
    ) {
      clearMatchmakerPrefill();
      return null;
    }
    if (
      parsed.matchmakerModelYear !== null &&
      (parsed.matchmakerModelYear < MIN_MODEL_YEAR || parsed.matchmakerModelYear > MAX_MODEL_YEAR)
    ) {
      clearMatchmakerPrefill();
      return null;
    }

    return {
      make,
      model,
      matchmakerPriceCents: parsed.matchmakerPriceCents,
      matchmakerModelYear: parsed.matchmakerModelYear,
    };
  } catch {
    clearMatchmakerPrefill();
    return null;
  }
}

/** Call once a pre-fill has been applied, so a reload does not re-apply it. */
export function clearMatchmakerPrefill(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(MATCHMAKER_PREFILL_KEY);
  } catch {
    // Non-fatal, same reasoning as stash.
  }
}

/** Exported for tests and for the eventual reader; not a general-purpose key. */
export const MATCHMAKER_PREFILL_STORAGE_KEY = MATCHMAKER_PREFILL_KEY;
export const MATCHMAKER_PREFILL_TTL = MATCHMAKER_PREFILL_TTL_MS;
