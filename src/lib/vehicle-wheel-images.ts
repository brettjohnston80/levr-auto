/**
 * Real wheel-design reference photos, a small third set alongside
 * vehicle-color-images.ts/vehicle-feature-images.ts (2026-09-21) -- same
 * kind of asset (manufacturer configurator screenshots, terms of use never
 * reviewed), so this gets its OWN switch rather than sharing either
 * sibling's, same reasoning both of those already give for not sharing
 * with each other.
 *
 * ⚠ DELIBERATELY A DIFFERENT SHAPE FROM COLORS/FEATURES, NOT A THIRD
 * DIRECTORY-SCAN+SLUG INDEX -- confirmed necessary, not a style choice.
 * Real data investigated 2026-09-21 before building anything:
 *   - Camry's `wheels` category name is IDENTICAL across all 5 real trims
 *     ("Standard wheels only (exact size/spec not itemized as a standalone
 *     purchasable option in Toyota's build tool for this trim)") -- it
 *     carries zero distinguishing information, so a name-keyed lookup
 *     (what colors/features both use) is structurally incapable of
 *     placing three per-trim Camry photos at all.
 *   - Civic has a genuine near-collision a slug-based index would
 *     silently mishandle: "18-Inch Gloss-Black Alloy Wheels" (Sport /
 *     Sport Hybrid, sedan) vs. "18-Inch Gloss Black Alloy Wheels" (Sport
 *     Hatchback / Sport Hybrid Hatchback) differ ONLY by a hyphen, which
 *     slugifyForImage() collapses identically -- a naive scan would let
 *     whichever file the directory listing happened to return last
 *     silently overwrite the other's map entry.
 * Resolution: key on TRIM (plus bodyStyle as a defensive real-data check,
 * not a display requirement here since these two models' trim strings
 * already disambiguate body style on their own -- Corolla-style same-name-
 * across-body-styles collisions are a documented real case elsewhere in
 * this dataset, so the check stays even though it can't currently fire for
 * Camry/Civic), an explicit hand-checked Record like
 * vehicle-color-swatches.ts uses for the exact same "name-keyed matching
 * isn't safe here" reason -- never a filename-derived index.
 *
 * ⚠ ONLY THE "STANDARD" WHEELS ROW EVER GETS A PHOTO. A trim can carry a
 * SECOND wheels row for a priced upgrade (e.g. Civic's $1,600 "18-Inch
 * Black Coal Alloy Wheels", standalone, present on 5 of 9 real trims) --
 * no photo was ever sourced for any upgrade option, and resolveWheelImage
 * has no way to know which upgrade a photo would even depict, so callers
 * must attach the resolved URL only to the choice whose own
 * `availability === "standard"`, never to every row a trim happens to
 * have. Getting this backwards would show a stock-wheel photo next to a
 * customer-selectable upgrade it doesn't actually depict.
 *
 * Every mapped trim/file pair checked directly against a live query of
 * `configurator_options` (2026-09-21), not copied from the delivered
 * filenames' own labels -- two real divergences worth remembering:
 *   - Si and Type R's real names both independently say "Matte Black
 *     Alloy Wheels" (Si: "18-Inch Matte Black Alloy Wheels"; Type R:
 *     "19x9.5J Matte Black Alloy Wheels w/ 265/30ZR19 Michelin Pilot
 *     Sport 4S tires") -- genuinely different wheels on genuinely
 *     different trims, matched to their own distinct delivered photo by
 *     elimination (each trim has exactly one wheels row), not by name.
 *   - LX ("16-Inch Wheels with Covers") and both Sport Touring Hybrid
 *     trims (sedan: "18-Inch Alloy Wheels with Matte Shark Gray Inserts";
 *     hatchback: "18-Inch Alloy Wheels, unique machine-finished design")
 *     have no delivered photo at all and are deliberately absent from the
 *     map below -- they render text-only, same as any other trim with no
 *     photo. Do not "fix" this by borrowing a visually-similar photo from
 *     a different trim.
 *
 * Layout: public/vehicle-wheels/<make>/<model>/<file>.<ext>, same root
 * convention as the sibling sets, no per-option subfolder (mirrors
 * vehicle-features/, which has no category subfolder either).
 */
export const VEHICLE_WHEEL_IMAGES_ENABLED = true;

interface WheelImageEntry {
  /** configurator_trims.body_style for this trim, exact casing as stored
   *  (Camry: "Sedan"; Civic: "sedan"/"hatchback" -- genuinely inconsistent
   *  in the source data across the two makes, compared case-insensitively
   *  below rather than normalized at rest, so this stays a faithful copy
   *  of what's actually in the database). */
  bodyStyle: string;
  file: string;
}

const TOYOTA_CAMRY_WHEELS: Record<string, WheelImageEntry> = {
  Nightshade: { bodyStyle: "Sedan", file: "nightshade.jpg" },
  XLE: { bodyStyle: "Sedan", file: "xle.jpg" },
  XSE: { bodyStyle: "Sedan", file: "xse.jpg" },
};

const HONDA_CIVIC_WHEELS: Record<string, WheelImageEntry> = {
  Sport: { bodyStyle: "sedan", file: "gloss-black-sedan.jpg" },
  "Sport Hybrid": { bodyStyle: "sedan", file: "gloss-black-sedan.jpg" },
  "Sport Hatchback": { bodyStyle: "hatchback", file: "gloss-black-hatchback.jpg" },
  "Sport Hybrid Hatchback": { bodyStyle: "hatchback", file: "gloss-black-hatchback.jpg" },
  Si: { bodyStyle: "sedan", file: "matte-black-si.jpg" },
  "Type R": { bodyStyle: "hatchback", file: "forged-alloy-type-r.jpg" },
};

const WHEEL_IMAGES: Record<string, Record<string, Record<string, WheelImageEntry>>> = {
  Toyota: { Camry: TOYOTA_CAMRY_WHEELS },
  Honda: { Civic: HONDA_CIVIC_WHEELS },
};

/**
 * The wheel photo for one real trim, or null when we don't have one --
 * every make/model outside Camry/Civic, every trim not in the map above,
 * and (the defensive case) a trim/bodyStyle pair that doesn't match what's
 * mapped -- refused rather than served, since a mismatch here means the
 * caller's real data disagrees with what this map was built against, and
 * guessing would risk showing the wrong trim's wheel.
 */
export function resolveWheelImage(
  make: string | null,
  model: string | null,
  trim: string | null,
  bodyStyle: string | null,
): string | null {
  if (!VEHICLE_WHEEL_IMAGES_ENABLED) return null;
  if (!make || !model || !trim || !bodyStyle) return null;
  const entry = WHEEL_IMAGES[make]?.[model]?.[trim];
  if (!entry) return null;
  if (entry.bodyStyle.toLowerCase() !== bodyStyle.toLowerCase()) return null;
  return encodeURI(`/vehicle-wheels/${make.toLowerCase()}/${model.toLowerCase()}/${entry.file}`);
}
