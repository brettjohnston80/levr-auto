import { VEHICLE_COLOR_IMAGES_ENABLED } from "@/lib/vehicle-color-images";

/**
 * Real colour codes for a small swatch indicator, shown ALONGSIDE the real
 * photo (vehicle-color-images.ts), never replacing it (2026-09-16).
 *
 * Source: `camry-civic-color-codes-2026-09-16.md` (Cowork), covering the
 * exact same 39 colours already photographed in the color pilot -- no new
 * colours or models. Scope is Camry + Civic only, gated behind the SAME
 * `VEHICLE_COLOR_IMAGES_ENABLED` switch as the photos, not a new one: this
 * is additive to an already-enabled feature, not a new risk decision.
 *
 * ⚠ THE DATA IS NOT STRUCTURED FOR THIS, AND REQUIRES THE SAME HAND-CHECKED
 * MAPPING DISCIPLINE AS EVERY PRIOR COLOUR/FEATURE MAPPING IN THIS PROJECT.
 * Confirmed directly before writing any of this, not assumed:
 *   - The two-tone flag lives INSIDE the colour-name string itself
 *     ("Wind Chill Pearl w/Midnight Black Metallic roof (two-tone)") --
 *     there is no boolean column and no separate "roof colour" field.
 *   - The RGB/Hex columns carry the BODY colour only, even for two-tone
 *     rows. The roof colour is stated in a free-text Note cell as a
 *     sentence, not a value in a parseable column.
 *   - Civic's Si two-tone interior ("Black/Red Cloth") isn't in the table
 *     shape at all -- its two component RGB values are given in prose
 *     below the table, keyed by a name that doesn't literally match any
 *     table row.
 *   - Civic Type R's interior sample carries its own reliability caveat
 *     (captured under the trim's red ambient lighting, not neutral light)
 *     but is otherwise a single solid estimate, not a two-tone split --
 *     confirmed it is NOT the same shape as Si's genuinely two-tone entry.
 *
 * ⚠ ALL 4 CAMRY TWO-TONE ROWS HAPPEN TO SHARE ONE ROOF COLOUR (Midnight
 * Black Metallic). CONFIRMED COINCIDENTAL IN THIS DATA, NOT A RULE.
 * MIDNIGHT_BLACK_METALLIC_HEX below is a DRY convenience for four rows
 * that independently happen to agree, referenced explicitly by each --
 * there is no fallback anywhere that assumes an unlisted two-tone name
 * shares this roof colour. A future two-tone with a different roof needs
 * its own entry with its own value, read from the source doc, not this
 * constant.
 *
 * ⚠ NAMES DO NOT ALL MATCH `configurator_options.name` LITERALLY, and
 * every key below is checked against a real, live query of that table
 * (2026-09-16), not copied from the source doc's own prose:
 *   - Camry interior: the doc's labels carry "SofTex®"/"Dinamica®" (with
 *     the registered-trademark glyph); the live option names do not carry
 *     "®" at all. Keyed on the live names.
 *   - Civic interior: the doc labels its two special rows "Black/Red
 *     Cloth (Si)" and "Black/Red Suede-Effect Fabric (Type R)" -- neither
 *     parenthetical exists in the live option name. The live Si name is
 *     the plain "Black/Red Cloth"; the live Type R name is the FULL
 *     descriptive string ("Black/Red Suede-Effect Fabric (cloth/sueded
 *     microfiber), high-bolstered sport seats w/ double red stitching"),
 *     copied verbatim below rather than guessed or truncated.
 * Every other name (all 14 Camry exterior, all 11 Civic exterior, the
 * remaining 4 Camry interior, the remaining 4 Civic interior) matched the
 * live option name exactly, character for character -- confirmed by
 * direct comparison against the query result, not assumed from the doc.
 */

export type ColorSwatchValue =
  | { kind: "solid"; hex: string }
  | { kind: "two-tone"; bodyHex: string; secondHex: string };

const MIDNIGHT_BLACK_METALLIC_HEX = "#00031E";

const TOYOTA_CAMRY_EXTERIOR: Record<string, ColorSwatchValue> = {
  Underground: { kind: "solid", hex: "#7E7B7D" },
  "Ocean Gem": { kind: "solid", hex: "#1B4558" },
  "Ice Cap": { kind: "solid", hex: "#FFFFFF" },
  "Celestial Silver Metallic": { kind: "solid", hex: "#828387" },
  "Midnight Black Metallic": { kind: "solid", hex: MIDNIGHT_BLACK_METALLIC_HEX },
  "Reservoir Blue": { kind: "solid", hex: "#1A1C37" },
  "Supersonic Red": { kind: "solid", hex: "#E20500" },
  "Dark Cosmos": { kind: "solid", hex: "#3C4253" },
  "Heavy Metal": { kind: "solid", hex: "#535353" },
  "Wind Chill Pearl": { kind: "solid", hex: "#E3E9E9" },
  "Wind Chill Pearl w/Midnight Black Metallic roof (two-tone)": {
    kind: "two-tone",
    bodyHex: "#E3E9E9",
    secondHex: MIDNIGHT_BLACK_METALLIC_HEX,
  },
  "Heavy Metal w/Midnight Black Metallic roof (two-tone)": {
    kind: "two-tone",
    bodyHex: "#535353",
    secondHex: MIDNIGHT_BLACK_METALLIC_HEX,
  },
  "Ocean Gem w/Midnight Black Metallic roof (two-tone)": {
    kind: "two-tone",
    bodyHex: "#1B4558",
    secondHex: MIDNIGHT_BLACK_METALLIC_HEX,
  },
  "Supersonic Red w/Midnight Black Metallic roof (two-tone)": {
    kind: "two-tone",
    bodyHex: "#E20500",
    secondHex: MIDNIGHT_BLACK_METALLIC_HEX,
  },
};

// ESTIMATED (photo-sampled, not manufacturer data) -- see the source doc's
// own accuracy caveat. Good enough for a small dot; not a design reference.
const TOYOTA_CAMRY_INTERIOR: Record<string, ColorSwatchValue> = {
  "Black fabric": { kind: "solid", hex: "#211E21" },
  "Boulder fabric": { kind: "solid", hex: "#444242" },
  // Live option name has no "®" -- the doc's "SofTex®/fabric..." label does.
  "Black SofTex/fabric mixed media trim": { kind: "solid", hex: "#282628" },
  "Boulder SofTex/fabric mixed media trim": { kind: "solid", hex: "#464447" },
  // Live option name has no "®" -- the doc's "...Dinamica® trim" label does.
  "Light Gray leather & Dinamica trim": { kind: "solid", hex: "#474543" },
  "Black leather & Dinamica trim": { kind: "solid", hex: "#292726" },
  "Black leather trim": { kind: "solid", hex: "#201D20" },
  "Cockpit Red leather trim": { kind: "solid", hex: "#431F1F" },
};

const HONDA_CIVIC_EXTERIOR: Record<string, ColorSwatchValue> = {
  "Rallye Red": { kind: "solid", hex: "#DA0101" },
  "Crystal Black Pearl": { kind: "solid", hex: "#000000" },
  "Meteorite Gray Metallic": { kind: "solid", hex: "#37424C" },
  "Solar Silver Metallic": { kind: "solid", hex: "#CCD0D3" },
  "Blue Lagoon Pearl": { kind: "solid", hex: "#253757" },
  "Platinum White Pearl": { kind: "solid", hex: "#E5E5E5" },
  "Urban Gray Pearl": { kind: "solid", hex: "#999999" },
  "Boost Blue Pearl": { kind: "solid", hex: "#167FE0" },
  "Sand Dune Pearl": { kind: "solid", hex: "#A4987C" },
  "Championship White": { kind: "solid", hex: "#EDEDE9" },
  "Sonic Gray Pearl": { kind: "solid", hex: "#6F8391" },
};

// ESTIMATED (photo-sampled) -- same caveat as Camry interior above.
const HONDA_CIVIC_INTERIOR: Record<string, ColorSwatchValue> = {
  "Black Cloth": { kind: "solid", hex: "#2D2D2D" },
  "Gray Cloth": { kind: "solid", hex: "#8B8B8D" },
  "Black Leather": { kind: "solid", hex: "#232323" },
  "Gray Leather": { kind: "solid", hex: "#99999B" },
  // Si only. Live option name is the plain "Black/Red Cloth" -- the doc's
  // "(Si)" suffix doesn't exist on the live row. Genuinely two-tone: the
  // source doc sampled the black bolster and the red centre-panel insert
  // as two separate patches rather than one blended average.
  "Black/Red Cloth": { kind: "two-tone", bodyHex: "#151416", secondHex: "#3A1B1D" },
  // Type R only. The live option name is the FULL descriptive string, not
  // the doc's "(Type R)" shorthand -- copied verbatim from the live query.
  // Solid, not two-tone: the source doc could not isolate a black vs red
  // component here (Honda's configurator renders Type R's cabin under red
  // ambient lighting that washes out the true black material), and
  // reports one overall-seat median instead, with an explicit reliability
  // caveat that this reflects the lighting effect, not neutral-light
  // fabric colour. Rendered with the same plain solid-dot treatment as
  // every other estimate here -- see Brett's 2026-09-16 call not to
  // visually distinguish estimated values from manufacturer-sourced ones.
  "Black/Red Suede-Effect Fabric (cloth/sueded microfiber), high-bolstered sport seats w/ double red stitching":
    { kind: "solid", hex: "#842A2E" },
};

const SWATCHES: Record<string, Record<string, Record<string, Record<string, ColorSwatchValue>>>> = {
  Toyota: {
    Camry: {
      exterior_color: TOYOTA_CAMRY_EXTERIOR,
      interior: TOYOTA_CAMRY_INTERIOR,
    },
  },
  Honda: {
    Civic: {
      exterior_color: HONDA_CIVIC_EXTERIOR,
      interior: HONDA_CIVIC_INTERIOR,
    },
  },
};

/**
 * The swatch value for one option, or null when we don't have one --
 * every make/model outside Camry/Civic, and any name that doesn't match
 * (reported, never guessed at via fuzzy matching).
 */
export function vehicleColorSwatch(
  make: string | null,
  model: string | null,
  category: string,
  colorName: string,
): ColorSwatchValue | null {
  if (!VEHICLE_COLOR_IMAGES_ENABLED) return null;
  if (!make || !model) return null;
  return SWATCHES[make]?.[model]?.[category]?.[colorName] ?? null;
}

/** Resolves swatches for a whole question at once, mirroring resolveColorImages. */
export function resolveColorSwatches(
  make: string | null,
  model: string | null,
  category: string,
  colorNames: string[],
): Record<string, ColorSwatchValue> {
  const out: Record<string, ColorSwatchValue> = {};
  if (!VEHICLE_COLOR_IMAGES_ENABLED) return out;
  for (const name of colorNames) {
    const value = vehicleColorSwatch(make, model, category, name);
    if (value) out[name] = value;
  }
  return out;
}
