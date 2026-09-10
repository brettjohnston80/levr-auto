// Parser/normalizer for the Toyota/Honda configurator CSVs (step 3 of 9).
//
// Pure functions only -- no DB access, no server imports, no I/O. The
// import route (step 4) reads the CSV and calls these; nothing downstream
// ever re-parses raw source text, because parsing happens once at import
// and the normalized result is what lands in configurator_options.
//
// The source format is a two-level delimited string, NOT JSON:
//   items      split on ' ;; '
//   fields     split on ' | '   ->  name | availability | price | package_ref
//   note       optional ' -- ' suffix anywhere in the item, stripped to `notes`
// package_definitions uses the same shape: name | price | contents: a, b, c

export type Availability = "standard" | "standalone" | "package_only" | "unavailable";

/** How an availability string was resolved -- reporting/audit only. */
export type AvailabilityMethod = "exact" | "prefix" | "forced_unavailable";

export interface ParsedPrice {
  /** Integer cents, or null when genuinely unknown. NEVER render null as $0. */
  priceCents: number | null;
  /** Source said "included" -- costs nothing extra *because* it comes with something else. */
  priceIsIncluded: boolean;
  /** True when the source could not be parsed into a figure at all. */
  priceUnknown: boolean;
}

export interface ParsedOption extends ParsedPrice {
  category: OptionCategory;
  name: string;
  availabilityRaw: string;
  availability: Availability;
  availabilityMethod: AvailabilityMethod;
  packageName: string | null;
  packagePriceCents: number | null;
  packageContents: string[] | null;
  notes: string | null;
}

export interface ParsedPackage {
  name: string;
  priceCents: number | null;
  contents: string[];
}

export type OptionCategory =
  | "exterior_color"
  | "interior"
  | "seating"
  | "wheels"
  | "roof"
  | "drivetrain"
  | "feature";

/** CSV column -> configurator_options.category. */
export const CATEGORY_BY_COLUMN: Record<string, OptionCategory> = {
  exterior_color_options: "exterior_color",
  interior_color_material_options: "interior",
  seating_configuration: "seating",
  wheel_options: "wheels",
  roof_options: "roof",
  drivetrain_engine_variants: "drivetrain",
  common_features: "feature",
};

// The four canonical source spellings, in the exact casing the CSVs use.
// Order matters only for readability -- "Standalone" and "Standard" diverge
// at the 6th character, so no key is a prefix of another.
const CANONICAL: [string, Availability][] = [
  ["Standard", "standard"],
  ["Standalone", "standalone"],
  ["Package-only", "package_only"],
  ["Unavailable", "unavailable"],
];

/**
 * Splits an item's free-text note (' -- ...') from its delimited fields.
 * The note can trail any field, so this splits on the FIRST ' -- ' in the
 * whole item rather than assuming it lives in a particular column.
 */
function splitNote(item: string): { body: string; note: string | null } {
  const idx = item.indexOf(" -- ");
  if (idx === -1) return { body: item, note: null };
  const note = item.slice(idx + 4).trim();
  return { body: item.slice(0, idx), note: note.length > 0 ? note : null };
}

/**
 * Normalizes a source availability string to one of four values.
 *
 * The source field is NOT a clean enum: across the two CSVs there are ~180
 * distinct strings. Most match a canonical value exactly; a meaningful
 * slice carry a canonical prefix plus a free-text qualifier
 * ("Unavailable (cloth only)", "Standard (Honda Sensing)"); the rest are
 * genuinely ambiguous (blank, "Unknown", "Unconfirmed", "Not confirmed",
 * "Available", "Unclear", "Not Applicable").
 *
 * Exact match first, then prefix match, then EVERYTHING else resolves to
 * `unavailable` (approved decision) so it is omitted from customer
 * questions. A false omission is far safer than offering a feature the car
 * cannot have -- an availability we are unsure of is not one we should be
 * promising to a customer.
 */
export function classifyAvailability(raw: string | null | undefined): {
  availability: Availability;
  method: AvailabilityMethod;
} {
  const value = (raw ?? "").trim();

  for (const [source, normalized] of CANONICAL) {
    if (value === source) return { availability: normalized, method: "exact" };
  }
  for (const [source, normalized] of CANONICAL) {
    if (value.startsWith(source)) return { availability: normalized, method: "prefix" };
  }
  return { availability: "unavailable", method: "forced_unavailable" };
}

/**
 * Parses a price cell. The source mixes "$0", "+$475", "$1,850",
 * "included" and blanks.
 *
 * A blank only means "no extra cost" when the item is genuinely obtainable
 * -- for anything else a blank tells us nothing, so it stays unknown
 * rather than being silently reported as free.
 */
export function parsePrice(raw: string | null | undefined, availability: Availability): ParsedPrice {
  const value = (raw ?? "").trim();

  if (value.toLowerCase() === "included") {
    return { priceCents: 0, priceIsIncluded: true, priceUnknown: false };
  }

  const numeric = value.match(/^[+-]?\s*\$?\s*([\d,]+(?:\.\d+)?)$/);
  if (numeric) {
    const amount = Number.parseFloat(numeric[1].replace(/,/g, ""));
    if (Number.isFinite(amount)) {
      const signed = value.trimStart().startsWith("-") ? -amount : amount;
      return {
        priceCents: Math.round(signed * 100),
        priceIsIncluded: false,
        priceUnknown: false,
      };
    }
  }

  if (value === "" && availability !== "unavailable") {
    return { priceCents: 0, priceIsIncluded: false, priceUnknown: false };
  }

  return { priceCents: null, priceIsIncluded: false, priceUnknown: true };
}

/** Parses the package_definitions column into a name -> package map. */
export function parsePackageDefinitions(raw: string | null | undefined): Map<string, ParsedPackage> {
  const packages = new Map<string, ParsedPackage>();
  for (const item of (raw ?? "").split(";;")) {
    const { body } = splitNote(item);
    const fields = body.split("|").map((f) => f.trim());
    const name = fields[0] ?? "";
    if (!name) continue;
    const { priceCents } = parsePrice(fields[1], "standalone");
    const contentsField = (fields[2] ?? "").replace(/^contents:\s*/i, "");
    const contents = contentsField
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    packages.set(name, { name, priceCents, contents });
  }
  return packages;
}

/**
 * Parses one option column into normalized options.
 *
 * Package-only items whose package_ref does not resolve against this row's
 * own package_definitions are DROPPED (approved decision) rather than
 * stored with null package fields: a package-only "yes" carrying no name,
 * contents or price cannot be actioned by an agent, so it must never reach
 * a customer as a question. Dropped items are returned separately so the
 * import can report the count instead of losing them silently.
 */
export function parseOptionColumn(
  category: OptionCategory,
  raw: string | null | undefined,
  packages: Map<string, ParsedPackage>,
): { options: ParsedOption[]; droppedUnresolvedPackage: ParsedOption[] } {
  const options: ParsedOption[] = [];
  const droppedUnresolvedPackage: ParsedOption[] = [];

  for (const item of (raw ?? "").split(";;")) {
    if (item.trim() === "") continue;
    const { body, note } = splitNote(item);
    const fields = body.split("|").map((f) => f.trim());

    const name = fields[0] ?? "";
    if (!name) continue;

    const availabilityRaw = fields[1] ?? "";
    const { availability, method } = classifyAvailability(availabilityRaw);
    const price = parsePrice(fields[2], availability);
    const packageRef = fields[3] ?? "";

    const parsed: ParsedOption = {
      category,
      name,
      availabilityRaw,
      availability,
      availabilityMethod: method,
      ...price,
      packageName: null,
      packagePriceCents: null,
      packageContents: null,
      notes: note,
    };

    if (availability === "package_only") {
      const pkg = packageRef ? packages.get(packageRef) : undefined;
      if (!pkg) {
        droppedUnresolvedPackage.push(parsed);
        continue;
      }
      parsed.packageName = pkg.name;
      parsed.packagePriceCents = pkg.priceCents;
      parsed.packageContents = pkg.contents;
    }

    options.push(parsed);
  }

  return { options, droppedUnresolvedPackage };
}

export interface ParsedTrimRow {
  make: string;
  model: string;
  trim: string;
  modelYear: number;
  drivetrain: string | null;
  fuelType: string | null;
  bodyStyle: string | null;
  options: ParsedOption[];
  droppedUnresolvedPackage: ParsedOption[];
}

/** Parses one CSV row into its trim identity plus every normalized option. */
export function parseConfiguratorRow(row: Record<string, string>): ParsedTrimRow {
  const packages = parsePackageDefinitions(row.package_definitions);
  const options: ParsedOption[] = [];
  const dropped: ParsedOption[] = [];

  for (const [column, category] of Object.entries(CATEGORY_BY_COLUMN)) {
    const result = parseOptionColumn(category, row[column], packages);
    options.push(...result.options);
    dropped.push(...result.droppedUnresolvedPackage);
  }

  const blankToNull = (v: string | undefined) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  };

  return {
    make: (row.make ?? "").trim(),
    model: (row.model ?? "").trim(),
    trim: (row.trim ?? "").trim(),
    modelYear: Number.parseInt((row.model_year ?? "").trim(), 10),
    drivetrain: blankToNull(row.drivetrain),
    fuelType: blankToNull(row.fuel_type),
    bodyStyle: blankToNull(row.body_style),
    options,
    droppedUnresolvedPackage: dropped,
  };
}
