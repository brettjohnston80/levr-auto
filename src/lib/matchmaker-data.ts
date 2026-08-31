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

export const PRIORITIES: Priority[] = [
  { label: "Safety", clarifier: "Best crash test results" },
  { label: "Comfort", clarifier: "Spacious, smooth ride" },
  { label: "Cargo Space", clarifier: "Best-in-class trunk/storage room" },
  { label: "Fuel Economy", clarifier: "Best MPG or EV range" },
  { label: "Reliability", clarifier: "Fewest expected repairs, longest-lasting" },
  { label: "Performance", clarifier: "Best acceleration & handling" },
  { label: "Technology & Features", clarifier: "Most advanced tech and driver-assist features" },
  { label: "Price/Value", clarifier: "Most car for the money" },
  { label: "Resale Value", clarifier: "Holds its value best over time" },
];

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

