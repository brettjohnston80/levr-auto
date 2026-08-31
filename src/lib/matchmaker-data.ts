// Matches the 9 body-style classes real-scored in the vehicles table
// exactly (see matchmaker-data-spec.md) -- this is a hard filter now, so
// it has to be the real set the scoring dataset uses, not a UI-only
// taxonomy. "Passenger Van" (the old mock/generated-data category) has
// zero rows in the real dataset and was dropped; "Wagon" is new.
export type VehicleType =
  | "Cargo Van"
  | "Convertible"
  | "Coupe"
  | "Hatchback"
  | "Minivan"
  | "Sedan"
  | "SUV"
  | "Truck"
  | "Wagon";
export type Powertrain = "Gas" | "Diesel" | "Hybrid" | "Electric";

export const VEHICLE_TYPES: VehicleType[] = [
  "Sedan",
  "Truck",
  "SUV",
  "Hatchback",
  "Wagon",
  "Convertible",
  "Cargo Van",
  "Coupe",
  "Minivan",
];

export const USE_CASES_BY_VEHICLE_TYPE: Record<VehicleType, string[]> = {
  Sedan: [
    "Daily commuting",
    "Small family transportation",
    "Fuel-efficient errands & city driving",
    "Business-professional use",
    "Long-distance highway trips",
  ],
  Truck: [
    "Full-time construction/trade work",
    "Towing (boat, trailer, equipment)",
    "Hauling materials & cargo bed use",
    "Off-road/outdoor recreation",
    "Daily commuting with occasional utility needs",
  ],
  SUV: [
    "Family road trips",
    "Daily commuting with extra cargo/passenger space",
    "Off-road/adventure use",
    "Towing (camper, boat, small trailer)",
    "All-weather daily driver",
  ],
  Hatchback: [
    "City commuting & easy parking",
    "Fuel-efficient daily driving",
    "First car / budget-friendly",
    "Weekend errands with flexible cargo space",
    "Light gear hauling (bikes, camping basics)",
  ],
  Wagon: [
    "Daily commuting with extra cargo space",
    "All-weather / all-season daily driver",
    "Road trips with gear (skis, bikes, luggage)",
    "Business-professional use",
    "Performance-focused ownership",
  ],
  Convertible: [
    "Weekend/recreational driving",
    "Scenic road trips",
    "Style/personal statement",
    "Warm-climate daily driver",
  ],
  "Cargo Van": [
    "Full-time trade/contractor work",
    "Delivery or courier business",
    "Mobile business use (mobile mechanic, catering, etc.)",
    "Moving/hauling large items",
    "Camper conversion / DIY build",
  ],
  Coupe: [
    "Weekend/recreational driving",
    "Sporty daily commuting",
    "Style/performance-focused ownership",
    "Low-passenger-need daily use",
  ],
  Minivan: [
    "Family with young kids",
    "Carpooling & kid activity shuttling",
    "Road trips with lots of gear",
    "Small business use (mobile services, light cargo + passengers)",
  ],
};

export const FAMILY_SIZES = ["1-2", "3-5", "6+"];

// "6+" is only a meaningful option for vehicles that can actually seat that
// many. Wagon deliberately excluded -- every real Wagon row in the dataset
// seats 4-5 (Volvo Cross Country, Audi allroad/Avant, Porsche Taycan, etc.),
// confirmed against the real data, not assumed from the name.
export const LARGE_CAPACITY_VEHICLE_TYPES: VehicleType[] = ["SUV", "Minivan"];

export const POWERTRAINS: Powertrain[] = ["Gas", "Diesel", "Hybrid", "Electric"];

// Dual-handle slider bounds -- both ends open. The leftmost handle position
// means "$20,000 or less" (stored as min: 0), the rightmost means "$100,000
// or more" (stored as max: Infinity) -- direct generalization of the old
// PRICE_RANGES' first/last buckets, which used the same 0/Infinity sentinels.
export const PRICE_SLIDER_MIN = 20000;
export const PRICE_SLIDER_MAX = 100000;
export const PRICE_SLIDER_STEP = 1000;

export type PriceRangeValue = { min: number; max: number };

export type Priority = { label: string; clarifier: string };

// All 10 possible rankable dimensions across every vehicle type combined
// (8 shared + Resale Value + Towing & Payload) -- used for clarifier
// lookups (PriorityRanker) regardless of which 9 are actually valid for
// the current vehicle type. See TOWING_PAYLOAD_VEHICLE_TYPES/
// defaultPriorityOrder for which 9 are actually offered.
export const ALL_PRIORITIES: Priority[] = [
  { label: "Safety", clarifier: "Best crash test results" },
  { label: "Comfort", clarifier: "Spacious, smooth ride" },
  { label: "Cargo Space", clarifier: "Best-in-class trunk/storage room" },
  { label: "Fuel Economy", clarifier: "Best MPG or EV range" },
  { label: "Reliability", clarifier: "Fewest expected repairs, longest-lasting" },
  { label: "Performance", clarifier: "Best acceleration & handling" },
  { label: "Technology & Features", clarifier: "Most advanced tech and driver-assist features" },
  { label: "Price/Value", clarifier: "Most car for the money" },
  { label: "Resale Value", clarifier: "Holds its value best over time" },
  { label: "Towing & Payload", clarifier: "Best towing capacity and payload" },
];

// Decided 2026-09-02: Truck/SUV/Cargo Van get "Towing & Payload" as their
// 9th rankable priority instead of "Resale Value". Resale Value is still
// computed for every vehicle regardless of body style (a data-layer
// fact, see towing_payload_score's migration comment) -- this is purely
// which 9 dimensions get OFFERED in the UI.
export const TOWING_PAYLOAD_VEHICLE_TYPES: VehicleType[] = ["Truck", "SUV", "Cargo Van"];

const SHARED_PRIORITY_LABELS = [
  "Safety",
  "Comfort",
  "Cargo Space",
  "Fuel Economy",
  "Reliability",
  "Performance",
  "Technology & Features",
  "Price/Value",
];

// The 9 rankable dimension labels valid for a given vehicle type, in
// neutral default order -- i.e. before any Main Use pre-fill hint is
// applied. "" (no vehicle type chosen yet) falls back to the Resale
// Value variant, same as the pre-2026-09-02 fixed default.
export function defaultPriorityOrder(vehicleType: VehicleType | ""): string[] {
  const ninth =
    vehicleType !== "" && TOWING_PAYLOAD_VEHICLE_TYPES.includes(vehicleType)
      ? "Towing & Payload"
      : "Resale Value";
  return [...SHARED_PRIORITY_LABELS, ninth];
}

// Swaps whichever of the two type-dependent labels (Resale Value /
// Towing & Payload) is present in an existing, possibly customer-
// reordered priority list for the correct one given a new vehicle type --
// preserving position and every other manual edit, rather than resetting
// the whole list. Used when the customer changes vehicle type after
// having already manually dragged priorities around.
export function retargetPriorityOrderForVehicleType(
  order: string[],
  vehicleType: VehicleType | "",
): string[] {
  const wantsTowing = vehicleType !== "" && TOWING_PAYLOAD_VEHICLE_TYPES.includes(vehicleType);
  const target = wantsTowing ? "Towing & Payload" : "Resale Value";
  const other = wantsTowing ? "Resale Value" : "Towing & Payload";
  return order.map((label) => (label === other ? target : label));
}

// Main Use -> the 1-2 dimensions that should be pre-ranked toward the top
// of the drag-to-rank "what matters most" step, per the approved design
// (§3d): this only sets the STARTING order -- the customer's own final
// ranking (even if left untouched) is what actually drives the score, no
// separate additive nudge. Keyed by the exact use-case strings in
// USE_CASES_BY_VEHICLE_TYPE above (a few entries here correct small
// wording drift from the original planning doc against the real live
// strings -- Sedan's "Business-professional use" is hyphenated in the
// real data though not in the original ask, and the Cargo Van / Minivan
// entries below use the real full parenthetical text, not the shortened
// versions from planning).
export const PRIORITY_HINTS_BY_USE_CASE: Record<string, string[]> = {
  // Sedan
  "Daily commuting": ["Reliability", "Fuel Economy"],
  "Small family transportation": ["Comfort", "Cargo Space"],
  "Fuel-efficient errands & city driving": ["Cargo Space", "Fuel Economy"],
  "Business-professional use": ["Comfort", "Technology & Features"],
  "Long-distance highway trips": ["Fuel Economy"],
  // Truck
  "Full-time construction/trade work": ["Cargo Space", "Towing & Payload"],
  "Towing (boat, trailer, equipment)": ["Towing & Payload", "Fuel Economy"],
  "Hauling materials & cargo bed use": ["Cargo Space", "Towing & Payload"],
  "Off-road/outdoor recreation": ["Performance", "Reliability"],
  "Daily commuting with occasional utility needs": ["Reliability", "Fuel Economy"],
  // SUV
  "Family road trips": ["Comfort", "Cargo Space"],
  "Daily commuting with extra cargo/passenger space": ["Cargo Space", "Comfort"],
  "Off-road/adventure use": ["Performance", "Reliability"],
  "Towing (camper, boat, small trailer)": ["Towing & Payload", "Reliability"],
  "All-weather daily driver": ["Safety", "Reliability"],
  // Hatchback
  "City commuting & easy parking": ["Reliability", "Fuel Economy"],
  "Fuel-efficient daily driving": ["Fuel Economy", "Price/Value"],
  "First car / budget-friendly": ["Price/Value", "Safety"],
  "Weekend errands with flexible cargo space": ["Cargo Space", "Fuel Economy"],
  "Light gear hauling (bikes, camping basics)": ["Cargo Space", "Reliability"],
  // Wagon
  "Daily commuting with extra cargo space": ["Cargo Space", "Reliability"],
  "All-weather / all-season daily driver": ["Safety", "Reliability"],
  "Road trips with gear (skis, bikes, luggage)": ["Cargo Space", "Fuel Economy"],
  "Performance-focused ownership": ["Performance", "Technology & Features"],
  // Convertible
  "Weekend/recreational driving": ["Performance", "Comfort"],
  "Scenic road trips": ["Comfort", "Reliability"],
  "Style/personal statement": ["Technology & Features", "Resale Value"],
  "Warm-climate daily driver": ["Reliability", "Fuel Economy"],
  // Cargo Van
  "Full-time trade/contractor work": ["Reliability", "Towing & Payload"],
  "Delivery or courier business": ["Reliability", "Fuel Economy"],
  "Mobile business use (mobile mechanic, catering, etc.)": ["Reliability", "Cargo Space"],
  "Moving/hauling large items": ["Cargo Space", "Towing & Payload"],
  "Camper conversion / DIY build": ["Cargo Space", "Price/Value"],
  // Coupe
  "Sporty daily commuting": ["Performance", "Fuel Economy"],
  "Style/performance-focused ownership": ["Performance", "Technology & Features"],
  "Low-passenger-need daily use": ["Reliability", "Fuel Economy"],
  // Minivan
  "Family with young kids": ["Safety", "Comfort"],
  "Carpooling & kid activity shuttling": ["Comfort", "Reliability"],
  "Road trips with lots of gear": ["Cargo Space", "Fuel Economy"],
  "Small business use (mobile services, light cargo + passengers)": ["Reliability", "Cargo Space"],
};

// Moves a use case's hinted dimensions to the front of a priority order,
// keeping every other dimension in its existing relative order after --
// a pre-fill of the STARTING position, not a full re-sort. A no-op if the
// use case has no hint (shouldn't happen for a real selection, but this
// stays a safe fallback rather than throwing).
export function applyUseCaseHint(order: string[], useCase: string): string[] {
  const hints = PRIORITY_HINTS_BY_USE_CASE[useCase];
  if (!hints || hints.length === 0) return order;
  const rest = order.filter((label) => !hints.includes(label));
  return [...hints, ...rest];
}

export type Answers = {
  vehicleType: VehicleType | "";
  useCase: string;
  familySize: string;
  powertrain: Powertrain | "";
  // null = step not yet reached/answered, same semantics as the other
  // fields' "" default -- excluded from scoring and hidden from chips
  // until the customer actually reaches and confirms this step.
  priceRange: PriceRangeValue | null;
  priorities: string[];
};

/** Shared by the slider's own live label, BuildingVisual's chip, and ResultsList's chip. */
export function formatPriceRange(range: PriceRangeValue): string {
  const atFloor = range.min <= PRICE_SLIDER_MIN;
  const atCeiling = range.max >= PRICE_SLIDER_MAX;
  if (atFloor && atCeiling) return "Any price";
  if (atFloor) return `$${range.max.toLocaleString()} or less`;
  if (atCeiling) return `$${range.min.toLocaleString()} or more`;
  return `$${range.min.toLocaleString()} – $${range.max.toLocaleString()}`;
}

