// The mechanical half of the D2 cleanup rules (Wave 2 review, decision D1;
// docs/research/configurator-wave2-review-2026-10-14.md section 2), applied to
// raw research CSV rows BEFORE configurator-parse.ts reads them. The
// manufacturer-dependent half (trim styling, "Base", site checks, missing
// prices) is the Cowork re-pass, never done here.
//
// One rule never invents a fact: anything it can't map with certainty is left
// exactly as it was and listed in the report, so an import can be reviewed
// before it happens. Tests: tests/configurator-mapping.test.mjs (one block per
// rule, run with `npm run test:configurator`).
//
// Deliberately free of imports so Node can run it directly in the tests.

export type CsvRow = Record<string, string>;

export interface MappingNote {
  rule: string;
  make: string;
  model: string;
  trim: string;
  modelYear: string;
  detail: string;
}

export interface MappingReport {
  rowsIn: number;
  rowsOut: number;
  /** Counts of changes made, by rule. */
  changed: Record<string, number>;
  /** Things a rule could not map with certainty: left unchanged, for review. */
  unmapped: MappingNote[];
  /** Information a change removed (e.g. a body-choice price), for review. */
  dropped: MappingNote[];
  /** Two rows that would end up with the same trim identity: import refuses. */
  collisions: string[];
  /** Every known correction applied (see KNOWN_CORRECTIONS). */
  corrections: MappingNote[];
  /** Rows left out of the import (data/held-models.json). */
  held: MappingNote[];
}

/** Optional official figures from the Cowork re-pass, keyed by engineFactKey(). */
export interface EngineFact {
  hp: number | null;
  displacementL: string | null;
  cylinders: string | null;
}

export interface MappingOptions {
  engineFacts?: Map<string, EngineFact>;
  /** Defaults to KNOWN_CORRECTIONS; tests pass their own. */
  corrections?: KnownCorrection[];
  /** From data/held-models.json (heldModelsFromJson); none held when omitted. */
  heldModels?: HeldModel[];
}

// ---------------------------------------------------------------------------
// Rule 6: one body style per row, from a fixed list.

export const BODY_STYLES = ["Sedan", "Hatchback", "Wagon", "Coupe", "Convertible", "SUV", "Truck", "Minivan", "Cargo Van"];

const BODY_MAP: Record<string, string[]> = {
  sedan: ["Sedan"],
  hatchback: ["Hatchback"],
  wagon: ["Wagon"],
  coupe: ["Coupe"],
  convertible: ["Convertible"],
  suv: ["SUV"],
  truck: ["Truck"],
  "pickup truck": ["Truck"],
  pickup: ["Truck"],
  minivan: ["Minivan"],
  "cargo van": ["Cargo Van"],
  // A coupe-shaped SUV is still an SUV (as our dataset's BMW X6 and Audi Q5 Sportback).
  "suv coupe": ["SUV"],
  // Our dataset has the 911 only as Coupe and Convertible.
  targa: ["Convertible"],
  // One row standing for two bodies becomes one row per body (as Corolla sedan/hatchback).
  "coupe or sedan": ["Coupe", "Sedan"],
};

/** The body style(s) a raw value maps to, or null when it isn't recognised. */
export function mapBodyStyle(raw: string): string[] | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return BODY_MAP[key] ?? null;
}

// ---------------------------------------------------------------------------
// Rule 7: one drivetrain per row, written FWD, RWD, AWD or 4WD.

const DRIVE_TOKENS: Array<[RegExp, string]> = [
  [/^(sh-awd|s-awc|awc|awd|e-awd|4matic\+?|quattro|xdrive|4motion|all4|all-wheel drive|all wheel drive)$/i, "AWD"],
  [/^(4wd|4x4|four-wheel drive|four wheel drive|full-time 4wd)$/i, "4WD"],
  [/^(fwd|front-wheel drive|front wheel drive)$/i, "FWD"],
  [/^(rwd|rear-wheel drive|rear wheel drive)$/i, "RWD"],
  // In this research "2WD" is only ever a pickup or a body-on-frame SUV, which are rear-drive.
  [/^(2wd|two-wheel drive)$/i, "RWD"],
];

function driveToken(token: string): string | null {
  const t = token.trim();
  for (const [re, value] of DRIVE_TOKENS) if (re.test(t)) return value;
  return null;
}

/**
 * The single drivetrain for a row. A combined value ("FWD/AWD", "RWD; AWD
 * available", "RWD or AWD") keeps the first, standard one; the other is a
 * priced option item. Null when blank or not recognised.
 */
export function mapDrivetrain(raw: string): string | null {
  const first = raw.split(/\/|;|\bor\b|,/i)[0] ?? "";
  if (!first.trim()) return null;
  return driveToken(first);
}

// ---------------------------------------------------------------------------
// Rule 8: fuel type from a fixed list.

export const FUEL_TYPES = ["Gas", "Hybrid", "PHEV", "EV", "Hydrogen"];

const FUEL_MAP: Record<string, string[]> = {
  gas: ["Gas"],
  gasoline: ["Gas"],
  hybrid: ["Hybrid"],
  phev: ["PHEV"],
  "plug-in hybrid": ["PHEV"],
  ev: ["EV"],
  electric: ["EV"],
  hydrogen: ["Hydrogen"],
  // The diesel is an engine option on the same trim.
  "gas (diesel available)": ["Gas"],
  // Two powertrains on one row become a Gas row and a Hybrid row.
  "gas; hybrid available": ["Gas", "Hybrid"],
};

export function mapFuelType(raw: string): string[] | null {
  return FUEL_MAP[raw.trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
}

// ---------------------------------------------------------------------------
// Rule 9: model names equal our vehicle dataset's model names (D3: split
// models merge into the dataset model). Charger Daytona: Wave 3 decision C1.

export interface ModelMapping {
  model: string;
  /** Prefixed to the trim, so the merged rows stay distinct ("Daytona Scat Pack"). */
  trimPrefix?: string;
  /** Appended to the trim where the merged body is the same as the model's own
   *  ("SUV Coupe" maps to SUV), so "GLE 450 4MATIC Coupe" stays distinct from
   *  "GLE 450 4MATIC". Approved by Brett 2026-10-16 (trim names are customer-visible). */
  trimSuffix?: string;
}

export const MODEL_MAP: Record<string, ModelMapping> = {
  "Audi|RS 3": { model: "RS3" },
  "Audi|RS 6 Avant": { model: "RS6 Avant" },
  "Audi|RS 7": { model: "RS7" },
  "GMC|HUMMER EV Pickup": { model: "Hummer EV Pickup" },
  "GMC|HUMMER EV SUV": { model: "Hummer EV SUV" },
  "Mercedes-Benz|GLE Coupe": { model: "GLE", trimSuffix: " Coupe" },
  "Mercedes-Benz|GLC Electric": { model: "GLC" },
  "Mercedes-Benz|CLE Coupe": { model: "CLE" },
  "Mercedes-Benz|CLE Cabriolet": { model: "CLE" },
  "Mercedes-Benz|EQS Sedan": { model: "EQS" },
  "Mercedes-Benz|E-Class Wagon": { model: "E-Class" },
  "Mercedes-Benz|AMG GT Coupe": { model: "AMG GT" },
  "Mercedes-Benz|AMG GT 4-Door Coupe Electric": { model: "AMG GT" },
  "Mercedes-Benz|CLA Electric": { model: "CLA" },
  "Porsche|Cayenne Coupe": { model: "Cayenne", trimSuffix: " Coupe" },
  "Porsche|Cayenne Electric": { model: "Cayenne" },
  "Porsche|Cayenne Coupe Electric": { model: "Cayenne", trimSuffix: " Coupe" },
  "Porsche|Macan Electric": { model: "Macan" },
  "Land Rover|Defender 90": { model: "Defender", trimPrefix: "90 " },
  "Land Rover|Defender 110": { model: "Defender", trimPrefix: "110 " },
  "Land Rover|Defender 130": { model: "Defender", trimPrefix: "130 " },
  "Land Rover|Range Rover Electric": { model: "Range Rover" },
  "Dodge|Charger Daytona": { model: "Charger", trimPrefix: "Daytona " },
};

export function mapModel(make: string, model: string, trim: string): { model: string; trim: string } | null {
  const m = MODEL_MAP[`${make.trim()}|${model.trim()}`];
  if (!m) return null;
  const prefix = m.trimPrefix ?? "";
  const suffix = m.trimSuffix ?? "";
  let t = trim.trim();
  if (prefix && !t.startsWith(prefix)) t = `${prefix}${t}`;
  if (suffix && !t.endsWith(suffix)) t = `${t}${suffix}`;
  return { model: m.model, trim: t };
}

// ---------------------------------------------------------------------------
// Rule 4: engine options in one short format:
// "{size and type}, {hp} hp, {transmission}, {drivetrain}".

interface Item {
  name: string;
  /** Everything after the name (" | Availability | Price | Package"), kept byte for byte. */
  rest: string;
  availability: string;
}

export function splitItems(cell: string): Item[] {
  if (!cell || !cell.trim()) return [];
  return cell.split(" ;; ").map((raw) => {
    const at = raw.indexOf(" | ");
    const name = (at === -1 ? raw : raw.slice(0, at)).trim();
    const rest = at === -1 ? "" : raw.slice(at);
    const availability = (rest.split(" | ")[1] ?? "").trim();
    return { name, rest, availability };
  });
}

export function joinItems(items: Item[]): string {
  return items.map((i) => `${i.name}${i.rest}`).join(" ;; ");
}

const WORD_NUMBERS: Record<string, string> = {
  one: "1", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};

export interface EngineParts {
  base: string | null; // "3.0L twin-turbo V6 mild hybrid" or "Dual-motor electric"
  hp: number | null;
  /**
   * Battery for an EV line: its size, e.g. "82 kWh" (kept, Brett 2026-10-16), or, when the maker
   * publishes no kWh figure, the pack's name, e.g. "Large battery" (Rivian; Brett 2026-10-25).
   */
  battery: string | null;
  transmission: string | null;
  drivetrain: string | null;
}

const NOT_AN_ENGINE = /\b(cab|box|bed|package|battery plus)\b/i;
const DOOR_ITEM = /^\s*\d-door\b/i;

/** Reads the facts the text actually states. Nothing is guessed. */
export function readEngineParts(text: string, fact?: EngineFact): EngineParts {
  const t = ` ${text} `;
  const disp = t.match(/(\d{1,2})[.,](\d)\s*-?\s*(?:L\b|liter|litre|T\b)/i);
  const size = disp ? `${disp[1]}.${disp[2]}L` : fact?.displacementL ? `${fact.displacementL.replace(/L$/i, "")}L` : null;

  let layout: string | null = null;
  const inline = t.match(/\b(?:inline|in-line)[-\s]?(\d)\b|\bI-?(\d)\b|\binline[-\s](\d)-cyl/i);
  const vee = t.match(/\bV-?(6|8|10|12)\b/);
  const flat = t.match(/\bboxer[-\s]?(\d)\b|\bflat[-\s](\d)\b/i);
  const cyl = t.match(/\b(\d{1,2})[-\s]?cyl(?:inder)?\b/i);
  if (inline) layout = `I${inline[1] ?? inline[2] ?? inline[3]}`;
  else if (vee) layout = `V${vee[1]}`;
  else if (flat) layout = `flat-${flat[1] ?? flat[2]}`;
  else if (cyl) layout = /\binline\b/i.test(t) ? `I${cyl[1]}` : `${cyl[1]}-cylinder`;
  // The official table may say what a bare "6-cylinder" is (I6, V6, flat-6).
  if ((!layout || /-cylinder$/.test(layout)) && fact?.cylinders) layout = fact.cylinders;

  let aspiration: string | null = null;
  // "Twin-scroll" is one turbo with a split housing, not two turbos.
  if (/twin[-\s]?e?turbo|biturbo/i.test(t)) aspiration = "twin-turbo";
  else if (/turbo|TFSI|\d\.\dT\b/i.test(t)) aspiration = "turbo";
  if (/supercharg/i.test(t)) aspiration = aspiration ? `${aspiration} supercharged` : "supercharged";

  let electrification: string | null = null;
  if (/plug-?in hybrid|\bPHEV\b/i.test(t)) electrification = "plug-in hybrid";
  else if (/mild hybrid|\bMHEV\b/i.test(t)) electrification = "mild hybrid";
  else if (/hybrid assist/i.test(t)) electrification = "hybrid assist";
  else if (/\bhybrid\b|\bHEV\b/i.test(t)) electrification = "hybrid";

  // A transmission described as "Power Split Electric" is still a transmission, not a motor.
  const isTransmissionText = /transmission|gearbox|\be?CVT\b/i.test(t);
  const isElectric = !size && !isTransmissionText && /electric|\bmotors?\b|\bkWh\b|battery-electric/i.test(t);
  let base: string | null = null;
  if (isElectric) {
    const motors = /quad[-\s]?motor/i.test(t)
      ? "Quad-motor electric"
      : /tri[-\s]?motor/i.test(t)
        ? "Tri-motor electric"
        : /dual[-\s]?motor|twin motor|front\s*(?:\/|&)\s*rear|front \/ rear/i.test(t)
          ? "Dual-motor electric"
          : /single[-\s]?(?:rear\s)?motor|rear motor|single motor/i.test(t)
            ? "Single-motor electric"
            : "Electric";
    base = motors;
  } else if (size) {
    base = [size, aspiration, layout, /\bdiesel\b/i.test(t) ? "diesel" : null, electrification].filter(Boolean).join(" ");
  }

  const hpMatch = t.match(/(\d{2,4})\s*-?\s*(?:hp|horsepower)\b/i);
  const hp = hpMatch ? Number(hpMatch[1]) : (fact?.hp ?? null);

  let transmission: string | null = null;
  const speeds = t.match(/\b(\d{1,2}|one|six|seven|eight|nine|ten)[-\s]speed\b/i);
  const n = speeds ? (WORD_NUMBERS[speeds[1].toLowerCase()] ?? speeds[1]) : null;
  if (/single[-\s]speed|\b1[-\s]speed\b/i.test(t)) transmission = "single-speed";
  else if (/\bmanual\b/i.test(t)) transmission = n ? `${n}-speed manual` : "manual";
  else if (/dual[-\s]clutch|\bDSG\b|S tronic|\bPDK\b|Doppelkupplung|\bDCT\b/i.test(t)) transmission = n ? `${n}-speed dual-clutch automatic` : "dual-clutch automatic";
  else if (/\be?CVT\b|continuous(?:ly)? variable/i.test(t)) transmission = "CVT";
  else if (/automatic|tiptronic|steptronic/i.test(t)) transmission = n ? `${n}-speed automatic` : "automatic";

  let drivetrain: string | null = null;
  const dt = t.match(/\b(SH-AWD|S-AWC|AWC|AWD|4MATIC|quattro|xDrive|4MOTION|ALL4|all[-\s]wheel drive|4WD|four[-\s]wheel drive|FWD|front[-\s]wheel drive|RWD|rear[-\s]wheel drive|2WD|two[-\s]wheel drive|4X4)\b/i);
  if (dt) drivetrain = driveToken(dt[1]);

  const kwh = isElectric ? t.match(/(\d{2,3}(?:\.\d)?)\s*-?\s*kWh\b/i) : null;
  // No kWh figure: keep a named pack, so two packs on one trim (Rivian's Large and Max) stay apart.
  const pack = isElectric && !kwh ? t.match(/\b(standard|large|max|long[-\s]range|extended[-\s]range)[-\s](?:battery|pack)\b/i) : null;
  const packName = pack ? pack[1].toLowerCase().replace(/[-\s]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  const battery = kwh ? `${kwh[1]} kWh` : packName ? `${packName} battery` : null;

  return { base, hp, battery, transmission, drivetrain };
}

export function formatEngine(p: EngineParts): string | null {
  if (!p.base) return null;
  return [p.base, p.battery, p.hp ? `${p.hp} hp` : null, p.transmission, p.drivetrain].filter(Boolean).join(", ");
}

/** "Transmission only" and "drivetrain only" items, which fold into the engine line. */
function itemKind(name: string, fact?: EngineFact): "engine" | "transmission" | "drivetrain" | "door" | "other" {
  if (DOOR_ITEM.test(name)) return "door";
  if (NOT_AN_ENGINE.test(name)) return "other";
  const p = readEngineParts(name, fact);
  if (p.base) return "engine";
  // Anything naming an engine, cylinders or power isn't a bare transmission or drivetrain.
  if (/\bV\d|\bcyl|\bHEMI\b|\bengine\b|\bhp\b|\bPS\b|hybrid|\bGas\b|\bB\d\b|\bT\d\b/i.test(name)) return "other";
  if (p.transmission && !p.drivetrain) return "transmission";
  if (p.drivetrain && !p.transmission && name.replace(/\(.*?\)|with .*$/i, "").trim().split(/\s+/).length <= 4) return "drivetrain";
  return "other";
}

export function engineFactKey(make: string, model: string, trim: string, modelYear: string, engineOption: string): string {
  return [make, model, trim, modelYear, engineOption].map((s) => s.trim().toLowerCase()).join("|");
}

// ---------------------------------------------------------------------------
// Known corrections: Brett's decisions on specific research cells, applied
// first, before the rules, so the research files stay exactly as received
// (re-pass review, 2026-10-16). Each one names the value it expects; if the
// cell holds anything else it's left alone and reported, so a newer research
// file is never silently overwritten.

export interface KnownCorrection {
  make: string;
  model: string;
  trim: string;
  modelYear: string;
  /** A CSV column, "engine:<exact option name>" for one engine option's name, or
   *  "price:<column>:<exact option name>" for one option's price, or
   *  "item:<column>:<exact option name>" for its whole availability/price/package tail. */
  field: string;
  from: string;
  to: string;
  why: string;
}

const audiPerformance = (model: string, modelYear: string): KnownCorrection => ({
  make: "Audi", model, trim: "Performance", modelYear, field: "trim", from: "Performance", to: "performance",
  why: "Audi USA writes 'performance' in lowercase (standing rule: the manufacturer's exact styling)",
});
const cadillacV = (model: string, modelYear: string): KnownCorrection => ({
  make: "Cadillac", model, trim: "V-Series", modelYear, field: "trim", from: "V-Series", to: "V",
  why: "keep 'V' (as 'V Blackwing'), reverting the re-pass rename",
});
const miniSe = (trim: string): KnownCorrection[] => [
  { make: "MINI", model: "Countryman", trim, modelYear: "2027", field: "fuel_type", from: "Gas", to: "EV",
    why: "the Countryman SE ALL4 is all-electric" },
  { make: "MINI", model: "Countryman", trim, modelYear: "2027", field: "engine:308-hp turbocharged engine ALL4 AWD",
    from: "308-hp turbocharged engine ALL4 AWD", to: "Electric, 308 hp, AWD",
    why: "the Countryman SE ALL4 is all-electric (308 hp, BMW Group US press release)" },
];

// Pass 3 linked six 2026 XT5 Premium Luxury items to the Driver Assist Package
// although the package contents don't name them; Brett rejected those links
// (2026-10-16), so they go back to Standalone, unlinked, price not confirmed.
const xt5Unlink = (option: string): KnownCorrection => ({
  make: "Cadillac", model: "XT5", trim: "Premium Luxury", modelYear: "2026",
  field: `item:common_features:${option}`, from: "Package-only |  | Driver Assist Package", to: "Standalone |  | ",
  why: "uncertain Driver Assist Package link rejected (pass 3 review)",
});

export const KNOWN_CORRECTIONS: KnownCorrection[] = [
  ...miniSe("SE ALL4 Signature Plus"),
  ...miniSe("SE ALL4 Iconic"),
  audiPerformance("RS 6 Avant", "2026"),
  audiPerformance("RS 7", "2026"),
  audiPerformance("RS Q8", "2027"),
  cadillacV("Escalade", "2026"),
  cadillacV("Escalade", "2027"),
  cadillacV("Escalade ESV", "2026"),
  cadillacV("Escalade ESV", "2027"),
  // Tesla review decision 4 (Brett, 2026-10-25): the Model Y L as model "Model Y", trim "L Premium",
  // as the Matchmaker dataset already groups it.
  { make: "Tesla", model: "Model Y L", trim: "Premium", modelYear: "2027", field: "model", from: "Model Y L", to: "Model Y",
    why: "the Model Y L is grouped under the Model Y (Tesla review, decision 4)" },
  { make: "Tesla", model: "Model Y L", trim: "Premium", modelYear: "2027", field: "trim", from: "Premium", to: "L Premium",
    why: "the Model Y L is grouped under the Model Y as trim \"L Premium\" (Tesla review, decision 4)" },
  ...["Cooling system, heavy-duty", "Alternator, 155 amps", "Hitch Guidance", "Hitch Guidance with Hitch View",
    "Seats, heated rear outboard seating positions", "Air Ionizer"].map(xt5Unlink),
];

// ---------------------------------------------------------------------------
// Held models: rows left out of the import until Brett releases them. Promotion
// is per make, so a row that must never go live can't simply be imported and
// left unpromoted; it stays out instead (Brett, 2026-10-16).

export interface HeldModel {
  make: string;
  model: string;
  /** Only this trim (exact); every trim when omitted. */
  trim?: string;
  /** Only this model year; every year when omitted. */
  modelYear?: string;
  why: string;
}

const HELD_KEYS = new Set(["make", "model", "trim", "model_year", "why", "since"]);

/**
 * The held list itself lives in data/held-models.json, which the Matchmaker
 * dataset build (scripts/build-matchmaker-v21.py) also reads, so releasing a
 * model (removing its entry) releases it in both places. Callers read the file
 * and pass it in; this module stays free of file access.
 */
export function heldModelsFromJson(text: string): HeldModel[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("held-models.json must be a list");
  return parsed.map((h) => {
    const e = h as Record<string, unknown>;
    if (typeof e.make !== "string" || typeof e.model !== "string") throw new Error("held model needs make and model");
    // An unknown key (a typo like "modelYear") would otherwise hold every year of the model.
    for (const k of Object.keys(e)) if (!HELD_KEYS.has(k)) throw new Error(`held model has an unknown key "${k}"`);
    for (const k of ["trim", "model_year"]) if (k in e && typeof e[k] !== "string") throw new Error(`held model "${k}" must be a string`);
    return {
      make: e.make,
      model: e.model,
      ...(typeof e.trim === "string" ? { trim: e.trim } : {}),
      ...(typeof e.model_year === "string" ? { modelYear: e.model_year } : {}),
      why: typeof e.why === "string" ? e.why : "",
    };
  });
}

/**
 * The held entry covering a row. An entry matches the research file's own names or
 * our dataset's names (after rule 9), so "Charger / Daytona Scat Pack" also covers a
 * research row "Charger Daytona / Scat Pack".
 */
function heldModelFor(row: CsvRow, held: HeldModel[]): HeldModel | undefined {
  const make = (row.make ?? "").trim();
  const year = (row.model_year ?? "").trim();
  const names = [{ model: (row.model ?? "").trim(), trim: (row.trim ?? "").trim() }];
  const mapped = mapModel(make, row.model ?? "", row.trim ?? "");
  if (mapped) names.push(mapped);
  return held.find(
    (h) =>
      h.make === make &&
      (h.modelYear === undefined || h.modelYear === year) &&
      names.some((n) => n.model === h.model && (h.trim === undefined || h.trim === n.trim)),
  );
}

/** Applies the corrections that match this row; logs each applied or skipped one. */
function applyCorrections(row: CsvRow, corrections: KnownCorrection[], report: MappingReport): CsvRow {
  const out = { ...row };
  for (const c of corrections) {
    if (c.make !== (row.make ?? "").trim() || c.model !== (row.model ?? "").trim() || c.modelYear !== (row.model_year ?? "").trim()) continue;
    if (c.trim !== (row.trim ?? "").trim()) continue;
    if (c.field.startsWith("item:")) {
      // "item:<column>:<exact option name>": one option's whole " | Availability | Price | Package" tail.
      const rest = c.field.slice("item:".length);
      const col = rest.slice(0, rest.indexOf(":"));
      const name = rest.slice(rest.indexOf(":") + 1);
      const items = splitItems(out[col] ?? "");
      const hit = items.find((i) => i.name === name);
      if (!hit || hit.rest !== ` | ${c.from}`) {
        report.unmapped.push(note("correction", row, `${col} option "${name}" ${hit ? `is "${hit.rest.slice(3)}"` : "not found"}, not "${c.from}"; correction not applied`));
        continue;
      }
      hit.rest = ` | ${c.to}`;
      hit.availability = (c.to.split(" | ")[0] ?? "").trim();
      out[col] = joinItems(items);
    } else if (c.field.startsWith("price:")) {
      // "price:<column>:<exact option name>": one option's price cell.
      const rest = c.field.slice("price:".length);
      const col = rest.slice(0, rest.indexOf(":"));
      const name = rest.slice(rest.indexOf(":") + 1);
      const items = splitItems(out[col] ?? "");
      const hit = items.find((i) => i.name === name);
      const parts = hit ? hit.rest.split(" | ") : [];
      if (!hit || (parts[2] ?? "").trim() !== c.from) {
        report.unmapped.push(note("correction", row, `${col} option "${name}" ${hit ? `price is "${(parts[2] ?? "").trim()}"` : "not found"}, not "${c.from}"; correction not applied`));
        continue;
      }
      parts[2] = c.to;
      hit.rest = parts.join(" | ");
      out[col] = joinItems(items);
    } else if (c.field.startsWith("engine:")) {
      const items = splitItems(out.drivetrain_engine_variants ?? "");
      const hit = items.find((i) => i.name === c.from);
      if (!hit) {
        report.unmapped.push(note("correction", row, `expected engine option "${c.from}" not found; correction not applied`));
        continue;
      }
      hit.name = c.to;
      out.drivetrain_engine_variants = joinItems(items);
    } else if ((out[c.field] ?? "").trim() === c.from) {
      out[c.field] = c.to;
    } else {
      report.unmapped.push(note("correction", row, `${c.field} is "${out[c.field] ?? ""}", not "${c.from}"; correction not applied`));
      continue;
    }
    report.changed["known correction"] = (report.changed["known correction"] ?? 0) + 1;
    report.corrections.push(note("correction", row, `${c.field}: "${c.from}" -> "${c.to}" (${c.why})`));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Package notes (Brett, 2026-10-16): research notes left inside
// package_definitions contents after pass 4. Each is a fixed note, so the
// rule matches it exactly and changes nothing else in the entry.
//   - GM "standard equipment on this trim (GM standard-features list names the
//     package but does not itemize it separately)": no real contents, so the
//     contents are emptied and the page shows "Contents not listed" (wording
//     signed off).
//   - Lincoln "standard equipment group on this trim; contents: …": the note is
//     dropped and the real contents after it are kept.
//   - The engine-choice note on the 14 GMC entries named like a cab/bed build:
//     "(engine/transmission choice from drivetrain_engine_variants; listed here
//     so items that come with it keep their link)" is removed.

const GM_STANDARD_NOTE = /^contents:\s*standard equipment on this trim \(GM standard-features list names the package but does not itemize it separately\)\s*$/i;
const LINCOLN_STANDARD_NOTE = /^standard equipment group on this trim;\s*(contents:)/i;
const ENGINE_CHOICE_NOTE = /\s*\(engine\/transmission choice from drivetrain_engine_variants; listed here so items that come with it keep their link\)/i;

/** The package_definitions cell with those notes removed; counts what it changed. */
export function cleanPackageNotes(cell: string, report?: MappingReport): string {
  if (!cell) return cell;
  const bump = (k: string) => { if (report) report.changed[k] = (report.changed[k] ?? 0) + 1; };
  return cell
    .split(" ;; ")
    .map((entry) => {
      const parts = entry.split(" | ");
      if (parts.length < 3) return entry;
      let contents = parts.slice(2).join(" | ");
      if (GM_STANDARD_NOTE.test(contents.trim())) {
        contents = "contents: ";
        bump("package note: GM standard equipment");
      } else if (LINCOLN_STANDARD_NOTE.test(contents)) {
        contents = contents.replace(LINCOLN_STANDARD_NOTE, "$1");
        bump("package note: Lincoln standard equipment");
      } else if (ENGINE_CHOICE_NOTE.test(contents)) {
        contents = contents.replace(ENGINE_CHOICE_NOTE, "");
        bump("package note: engine choice");
      } else {
        return entry;
      }
      return [parts[0], parts[1], contents].join(" | ");
    })
    .join(" ;; ");
}

// ---------------------------------------------------------------------------
// The whole step.

function note(rule: string, row: CsvRow, detail: string): MappingNote {
  return { rule, make: row.make ?? "", model: row.model ?? "", trim: row.trim ?? "", modelYear: row.model_year ?? "", detail };
}

/** Rule 4 on one row's drivetrain_engine_variants cell. */
function mapEngineCell(row: CsvRow, original: CsvRow, report: MappingReport, opts: MappingOptions): string {
  const items = splitItems(row.drivetrain_engine_variants ?? "");
  if (items.length === 0) return row.drivetrain_engine_variants ?? "";
  const rowDrive = row.drivetrain && FOUR_DRIVES.includes(row.drivetrain) ? row.drivetrain : null;

  // Fold a single standard transmission into the engine lines; drop standard
  // drivetrain items that only restate the row's drivetrain.
  const standardTransmissions = items.filter((i) => itemKind(i.name) === "transmission" && /^standard$/i.test(i.availability));
  const foldTransmission = standardTransmissions.length === 1 ? readEngineParts(standardTransmissions[0].name).transmission : null;

  // Engine facts are keyed by the research file's own names (before rule 9).
  const factFor = (name: string) =>
    opts.engineFacts?.get(engineFactKey(original.make ?? "", original.model ?? "", original.trim ?? "", original.model_year ?? "", name));

  const out: Item[] = [];
  for (const item of items) {
    const fact = factFor(item.name);
    const kind = itemKind(item.name, fact);
    if (kind === "transmission" && foldTransmission && item === standardTransmissions[0]) {
      report.changed["4 fold transmission"] = (report.changed["4 fold transmission"] ?? 0) + 1;
      continue;
    }
    if (kind === "drivetrain") {
      const d = readEngineParts(item.name).drivetrain;
      if (/^standard$/i.test(item.availability) && d && d === rowDrive) {
        report.changed["4 fold drivetrain"] = (report.changed["4 fold drivetrain"] ?? 0) + 1;
        continue;
      }
      if (d && d !== item.name) {
        out.push({ ...item, name: d });
        report.changed["4 drivetrain item"] = (report.changed["4 drivetrain item"] ?? 0) + 1;
        continue;
      }
      out.push(item);
      continue;
    }
    if (kind === "transmission") {
      const tr = readEngineParts(item.name).transmission;
      if (tr && tr !== item.name) {
        out.push({ ...item, name: tr });
        report.changed["4 transmission item"] = (report.changed["4 transmission item"] ?? 0) + 1;
      } else out.push(item);
      continue;
    }
    if (kind !== "engine") {
      if (kind === "other") report.unmapped.push(note("4", row, `left as is (not an engine line): "${item.name}"`));
      out.push(item);
      continue;
    }
    const parts = readEngineParts(item.name, fact);
    if (!parts.transmission && foldTransmission) parts.transmission = foldTransmission;
    if (!parts.drivetrain && rowDrive) parts.drivetrain = rowDrive;
    const formatted = formatEngine(parts);
    if (!formatted) {
      report.unmapped.push(note("4", row, `engine text not understood, left as is: "${item.name}"`));
      out.push(item);
      continue;
    }
    if (!parts.hp) report.unmapped.push(note("4", row, `no hp in the text or the engine-facts table: "${item.name}"`));
    if (/-mile|\bmi\b.*range|range\b/i.test(item.name)) report.dropped.push(note("4", row, `range text left out of the engine line: "${item.name}"`));
    if (formatted !== item.name) report.changed["4 engine line"] = (report.changed["4 engine line"] ?? 0) + 1;
    out.push({ ...item, name: formatted });
  }
  return joinItems(out);
}

const FOUR_DRIVES = ["FWD", "RWD", "AWD", "4WD"];

const DOORS_BY_BODY: Record<string, string> = { Coupe: "2", Sedan: "4" };

/** The price in an item's " | Availability | Price | Package" tail, as written. */
function itemPrice(item: Item): string {
  return (item.rest.split(" | ")[2] ?? "").trim();
}

/**
 * Splits a two-body row (Charger "coupe or sedan"). Each row drops the other
 * body's "N-Door" item. Its own body item goes too when it costs nothing; when
 * it costs extra (the Charger's 4-door, +$2,000), it stays as a standard item
 * carrying that price, so the configurator still shows the difference
 * (Brett, 2026-10-16).
 */
function bodyRows(row: CsvRow, bodies: string[], report: MappingReport): CsvRow[] {
  if (bodies.length === 1) return [{ ...row, body_style: bodies[0] }];
  return bodies.map((body) => {
    const doors = DOORS_BY_BODY[body];
    const kept: Item[] = [];
    for (const i of splitItems(row.drivetrain_engine_variants ?? "")) {
      const m = i.name.match(/^\s*(\d)-door\b/i);
      if (!m) {
        kept.push(i);
        continue;
      }
      const price = itemPrice(i).replace(/[^0-9.]/g, "");
      if (m[1] === doors && price !== "" && Number(price) > 0) {
        const name = `${doors}-door ${body.toLowerCase()} body`;
        kept.push({ name, rest: i.rest.replace(/^ \| [^|]*\|/, " | Standard |"), availability: "Standard" });
        report.changed["6 body price kept"] = (report.changed["6 body price kept"] ?? 0) + 1;
      }
    }
    return { ...row, body_style: body, drivetrain_engine_variants: joinItems(kept) };
  });
}

const HYBRID_ITEM = /\bHEV\b|\bhybrid\b|power split/i;

/** Splits a "Gas; Hybrid available" row into a Gas row and a Hybrid row. */
function fuelRows(row: CsvRow, fuels: string[], report: MappingReport): CsvRow[] {
  if (fuels.length === 1) return [{ ...row, fuel_type: fuels[0] }];
  return fuels.map((fuel) => {
    const items = splitItems(row.drivetrain_engine_variants ?? "");
    const kept: Item[] = [];
    for (const i of items) {
      const kind = itemKind(i.name);
      const hybrid = HYBRID_ITEM.test(i.name);
      const powertrain = kind === "engine" || kind === "transmission";
      if (fuel === "Hybrid") {
        if (powertrain && !hybrid) continue; // the gas engine and its transmission
        if (hybrid && /^standalone$/i.test(i.availability)) {
          // On the Hybrid row the hybrid powertrain is what you get; its price is the premium over gas.
          kept.push({ ...i, rest: i.rest.replace(/^ \| Standalone/i, " | Standard") });
          report.changed["8 hybrid item made standard"] = (report.changed["8 hybrid item made standard"] ?? 0) + 1;
          continue;
        }
      } else if (hybrid) continue;
      kept.push(i);
    }
    return { ...row, fuel_type: fuel, drivetrain_engine_variants: joinItems(kept) };
  });
}

/**
 * Applies the known corrections, then rules 9, 7, 6, 8 and 4 (in that order) to every row. Rows the rules
 * can't place are kept unchanged and reported; nothing is guessed.
 */
export function mapConfiguratorRows(rows: CsvRow[], opts: MappingOptions = {}): { rows: CsvRow[]; report: MappingReport } {
  const report: MappingReport = { rowsIn: rows.length, rowsOut: 0, changed: {}, unmapped: [], dropped: [], collisions: [], corrections: [], held: [] };
  const corrections = opts.corrections ?? KNOWN_CORRECTIONS;
  const heldModels = opts.heldModels ?? [];
  const bump = (k: string) => (report.changed[k] = (report.changed[k] ?? 0) + 1);
  const out: CsvRow[] = [];

  for (const received of rows) {
    // Held rows never reach the import (matched on the research file's own names).
    const held = heldModelFor(received, heldModels);
    if (held) {
      report.held.push(note("held", received, held.why));
      continue;
    }
    // Corrections first; everything after keys off the corrected row.
    const original = applyCorrections(received, corrections, report);
    let row: CsvRow = { ...original, package_definitions: cleanPackageNotes(original.package_definitions ?? "", report) };

    const m = mapModel(row.make ?? "", row.model ?? "", row.trim ?? "");
    if (m) {
      row = { ...row, model: m.model, trim: m.trim };
      bump("9 model name");
    }

    const drive = mapDrivetrain(row.drivetrain ?? "");
    if (drive) {
      if (drive !== row.drivetrain) bump("7 drivetrain");
      row.drivetrain = drive;
    } else {
      report.unmapped.push(note("7", row, `drivetrain left as is: "${row.drivetrain ?? ""}"`));
    }

    const bodies = mapBodyStyle(row.body_style ?? "");
    if (!bodies) report.unmapped.push(note("6", row, `body style left as is: "${row.body_style ?? ""}"`));
    else if (bodies.length > 1 || bodies[0] !== row.body_style) bump(bodies.length > 1 ? "6 body split" : "6 body style");

    const fuels = mapFuelType(row.fuel_type ?? "");
    if (!fuels) report.unmapped.push(note("8", row, `fuel type left as is: "${row.fuel_type ?? ""}"`));
    else if (fuels.length > 1 || fuels[0] !== row.fuel_type) bump(fuels.length > 1 ? "8 fuel split" : "8 fuel type");

    const byBody = bodies ? bodyRows(row, bodies, report) : [row];
    for (const b of byBody) {
      const byFuel = fuels ? fuelRows(b, fuels, report) : [b];
      for (const f of byFuel) {
        out.push({ ...f, drivetrain_engine_variants: mapEngineCell(f, original, report, opts) });
      }
    }
  }

  // A trim's identity must stay unique (the configurator_trims constraint).
  const seen = new Map<string, number>();
  for (const r of out) {
    const key = [r.make, r.model, r.trim, r.model_year, r.drivetrain, r.fuel_type, r.body_style].map((v) => (v ?? "").trim()).join(" | ");
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen) if (count > 1) report.collisions.push(`${key} (×${count})`);

  report.rowsOut = out.length;
  return { rows: out, report };
}

/** Reads the Cowork re-pass engine-facts CSV rows into the lookup the mapping uses. */
export function engineFactsFromRows(rows: CsvRow[]): Map<string, EngineFact> {
  const facts = new Map<string, EngineFact>();
  for (const r of rows) {
    const hp = Number.parseInt((r.hp ?? "").trim(), 10);
    facts.set(engineFactKey(r.make ?? "", r.model ?? "", r.trim ?? "", r.model_year ?? "", r.engine_option ?? ""), {
      hp: Number.isFinite(hp) ? hp : null,
      displacementL: (r.displacement_l ?? "").trim() || null,
      cylinders: (r.cylinders ?? "").trim() || null,
    });
  }
  return facts;
}
