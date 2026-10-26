import type { MarketCheckListing } from "./marketcheck";

// Where MarketCheck names a model differently from our vehicle data and the
// configurator research (Brett, 2026-10-10). Found by asking MarketCheck
// for its model list per make: e.g. it has "Ram 1500 Pickup" where we have
// "1500", so a sync for "1500" returned nothing at all.
//
// `mcModels` is what to ask MarketCheck for; `keep` picks this model's
// listings when MarketCheck folds two of our models into one (K4 and K4
// Hatchback are both "K4" there). Listings are always stored under OUR
// model name, so /finalize, the intake count and the agent queues (which
// all read listings by our make/model) find them.

interface ModelRule {
  mcModels: string[];
  keep?: (listing: MarketCheckListing) => boolean;
}

const build = (l: MarketCheckListing) =>
  (l.build ?? {}) as Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v : "");
const isHatchback = (l: MarketCheckListing) =>
  /hatch/i.test(text(build(l).body_type));
const isElectric = (l: MarketCheckListing) =>
  /\bbev\b|electric/i.test(
    `${text(build(l).powertrain_type)} ${text(build(l).fuel_type)}`,
  );
const isHybrid = (l: MarketCheckListing) =>
  /\bhev\b|hybrid/i.test(text(build(l).powertrain_type)) &&
  !/phev|plug/i.test(text(build(l).powertrain_type));
const isNTrim = (l: MarketCheckListing) =>
  /^n( tcr)?$/i.test(text(build(l).trim).trim());
const trimIs = (re: RegExp) => (l: MarketCheckListing) =>
  re.test(text(build(l).trim).trim());
const isGli = trimIs(/^gli\b/i);
const isLincolnL = trimIs(/ l$/i);
const isM5Touring = trimIs(/^m5 touring$/i);
const isAlpina = trimIs(/^alpina\b/i);

const RULES: Record<string, ModelRule> = {
  "ram|1500": { mcModels: ["Ram 1500 Pickup"] },
  "ram|2500": { mcModels: ["Ram 2500 Pickup"] },
  "ram|3500": { mcModels: ["Ram 3500 Pickup"] },
  "ram|chassis cab 3500": { mcModels: ["Ram 3500 Chassis Cab"] },
  "ram|chassis cab 4500": { mcModels: ["Ram 4500 Chassis Cab"] },
  "ram|chassis cab 5500": { mcModels: ["Ram 5500 Chassis Cab"] },
  "ram|promaster": {
    mcModels: ["ProMaster Cargo Van", "ProMaster Window Van"],
  },
  "jeep|wrangler": { mcModels: ["Wrangler 4-Door", "Wrangler 2-Door"] },
  "kia|k4": { mcModels: ["K4"], keep: (l) => !isHatchback(l) },
  "kia|k4 hatchback": { mcModels: ["K4"], keep: isHatchback },
  "kia|niro": { mcModels: ["Niro"], keep: (l) => !isElectric(l) },
  "kia|niro ev": { mcModels: ["Niro"], keep: isElectric },
  "kia|carnival": { mcModels: ["Carnival"], keep: (l) => !isHybrid(l) },
  "kia|carnival hybrid": { mcModels: ["Carnival"], keep: isHybrid },
  "hyundai|ioniq 5": { mcModels: ["IONIQ 5"], keep: (l) => !isNTrim(l) },
  "hyundai|ioniq 5 n": { mcModels: ["IONIQ 5"], keep: isNTrim },
  "hyundai|elantra": { mcModels: ["Elantra"], keep: (l) => !isNTrim(l) },
  "hyundai|elantra n": { mcModels: ["Elantra"], keep: isNTrim },
  // Wave 2 and 3 name check (2026-10-16): one model+trim facet call per
  // make. Only renames, or splits decided by a trim name MarketCheck shows.
  // Left out on purpose, because only the body type could tell them apart
  // and we haven't seen those listings: BMW 2/4/8 Series Gran Coupe and 4
  // Series Convertible, GMC Hummer EV Pickup/SUV, Volvo EX30 Cross Country,
  // and the GLE Coupe / Cayenne Coupe / AMG GT 4-Door rows (their listing
  // trims carry no body word, so they would match the other body's row).
  "audi|rs3": { mcModels: ["RS 3"] },
  "audi|rs6 avant": { mcModels: ["RS 6 Avant"] },
  "audi|rs7": { mcModels: ["RS 7"] },
  "audi|rs e-tron gt": { mcModels: ["RS e-tron GT Performance"] },
  "bmw|m2": { mcModels: ["M2 Coupe"] },
  "bmw|m3": { mcModels: ["M3 Sedan"] },
  "bmw|m4": { mcModels: ["M4 Coupe"] },
  "bmw|m5": { mcModels: ["M5"], keep: (l) => !isM5Touring(l) },
  "bmw|m5 touring": { mcModels: ["M5"], keep: isM5Touring },
  "bmw|x7": { mcModels: ["X7"], keep: (l) => !isAlpina(l) },
  "bmw|alpina xb7": { mcModels: ["X7"], keep: isAlpina },
  "genesis|gv70": { mcModels: ["GV70"], keep: (l) => !isElectric(l) },
  "genesis|electrified gv70": { mcModels: ["GV70"], keep: isElectric },
  "lexus|es": { mcModels: ["ES Hybrid", "ES BEV"] },
  "lexus|nx": { mcModels: ["NX", "NX Hybrid", "NX PHEV"] },
  "lexus|rx": { mcModels: ["RX", "RX Hybrid", "RX PHEV"] },
  "lexus|tx": { mcModels: ["TX", "TX Hybrid"] },
  "lexus|ux": { mcModels: ["UX Hybrid"] },
  "lincoln|navigator": { mcModels: ["Navigator"], keep: (l) => !isLincolnL(l) },
  "lincoln|navigator l": { mcModels: ["Navigator"], keep: isLincolnL },
  "mercedes-benz|c-class": { mcModels: ["C-Class Sedan"] },
  "mercedes-benz|amg gt": { mcModels: ["AMG GT Coupe"] },
  "mini|cooper 2 door": { mcModels: ["Hardtop 2 Door", "3 Door"] },
  "mini|cooper 4 door": { mcModels: ["Hardtop 4 Door", "5 Door"] },
  "mini|cooper convertible": { mcModels: ["Convertible"] },
  "mitsubishi|outlander phev": { mcModels: ["Outlander Plug-in Hybrid"] },
  "volkswagen|jetta": { mcModels: ["Jetta"], keep: (l) => !isGli(l) },
  "volkswagen|jetta gli": { mcModels: ["Jetta"], keep: isGli },
};

/** How to sync our make/model from MarketCheck, or null for a plain 1:1 name. */
export function marketCheckModelRule(
  make: string,
  model: string,
): ModelRule | null {
  return RULES[`${make}|${model}`.toLowerCase()] ?? null;
}
