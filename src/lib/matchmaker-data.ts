export type VehicleType =
  | "Cargo Van"
  | "Convertible"
  | "Coupe"
  | "Hatchback"
  | "Minivan"
  | "Passenger Van"
  | "Sedan"
  | "SUV"
  | "Truck";
export type Powertrain = "Gas" | "Hybrid" | "Electric";

export const VEHICLE_TYPES: VehicleType[] = [
  "Sedan",
  "Truck",
  "SUV",
  "Hatchback",
  "Passenger Van",
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
  "Passenger Van": [
    "Large family transportation",
    "Group-shuttle transportation (team, church, business)",
    "Road trips with many passengers",
    "Small business shuttle use",
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

// "6+" is only a meaningful option for vehicles that can actually seat that many.
export const LARGE_CAPACITY_VEHICLE_TYPES: VehicleType[] = ["SUV", "Passenger Van", "Minivan"];

export const POWERTRAINS: Powertrain[] = ["Gas", "Hybrid", "Electric"];

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

export type SeatsCategory = "1-2" | "3-5" | "6+";

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

export type MockVehicle = {
  id: string;
  make: string;
  model: string;
  bodyType: VehicleType;
  powertrain: Powertrain;
  priceEstimate: string;
  priceValue: number;
  seatsCategory: SeatsCategory;
  // 1-5 score per PRIORITIES label -- how well this vehicle actually
  // delivers on that priority, used to weight the ranked-priorities
  // portion of the fit score.
  priorityScores: Record<string, number>;
  rationale: string;
};

export const MOCK_RECOMMENDATIONS: MockVehicle[] = [
  {
    id: "land-cruiser",
    make: "Toyota",
    model: "Land Cruiser",
    bodyType: "SUV",
    powertrain: "Hybrid",
    priceEstimate: "$57,500 est.",
    priceValue: 57500,
    seatsCategory: "6+",
    priorityScores: {
      Safety: 5,
      Comfort: 4,
      "Cargo Space": 4,
      "Fuel Economy": 3,
      Reliability: 5,
      Performance: 3,
      "Technology & Features": 3,
      "Price/Value": 2,
      "Resale Value": 5,
    },
    rationale: "Handles hardware-store runs and long hauls without breaking a sweat.",
  },
  {
    id: "f-150",
    make: "Ford",
    model: "F-150",
    bodyType: "Truck",
    powertrain: "Gas",
    priceEstimate: "$42,900 est.",
    priceValue: 42900,
    seatsCategory: "3-5",
    priorityScores: {
      Safety: 4,
      Comfort: 3,
      "Cargo Space": 5,
      "Fuel Economy": 2,
      Reliability: 3,
      Performance: 4,
      "Technology & Features": 4,
      "Price/Value": 3,
      "Resale Value": 4,
    },
    rationale: "Bed space and towing capacity for real work-site duty.",
  },
  {
    id: "elantra",
    make: "Hyundai",
    model: "Elantra",
    bodyType: "Sedan",
    powertrain: "Gas",
    priceEstimate: "$23,400 est.",
    priceValue: 23400,
    seatsCategory: "3-5",
    priorityScores: {
      Safety: 3,
      Comfort: 3,
      "Cargo Space": 2,
      "Fuel Economy": 4,
      Reliability: 3,
      Performance: 2,
      "Technology & Features": 3,
      "Price/Value": 5,
      "Resale Value": 2,
    },
    rationale: "Cheap to own and easy to park for a daily commute.",
  },
  {
    id: "cr-v-hybrid",
    make: "Honda",
    model: "CR-V Hybrid",
    bodyType: "SUV",
    powertrain: "Hybrid",
    priceEstimate: "$34,800 est.",
    priceValue: 34800,
    seatsCategory: "3-5",
    priorityScores: {
      Safety: 5,
      Comfort: 4,
      "Cargo Space": 4,
      "Fuel Economy": 5,
      Reliability: 5,
      Performance: 3,
      "Technology & Features": 4,
      "Price/Value": 4,
      "Resale Value": 4,
    },
    rationale: "Balances passenger room with day-to-day fuel savings.",
  },
  {
    id: "model-y",
    make: "Tesla",
    model: "Model Y",
    bodyType: "SUV",
    powertrain: "Electric",
    priceEstimate: "$46,900 est.",
    priceValue: 46900,
    seatsCategory: "3-5",
    priorityScores: {
      Safety: 5,
      Comfort: 4,
      "Cargo Space": 4,
      "Fuel Economy": 5,
      Reliability: 3,
      Performance: 5,
      "Technology & Features": 5,
      "Price/Value": 3,
      "Resale Value": 3,
    },
    rationale: "Quiet commute, quick charging, and zero gas-station stops.",
  },
  {
    id: "silverado",
    make: "Chevrolet",
    model: "Silverado 1500",
    bodyType: "Truck",
    powertrain: "Gas",
    priceEstimate: "$45,200 est.",
    priceValue: 45200,
    seatsCategory: "3-5",
    priorityScores: {
      Safety: 3,
      Comfort: 3,
      "Cargo Space": 5,
      "Fuel Economy": 2,
      Reliability: 3,
      Performance: 4,
      "Technology & Features": 3,
      "Price/Value": 3,
      "Resale Value": 4,
    },
    rationale: "Full-size capability if you're hauling gear most days.",
  },
  {
    id: "telluride",
    make: "Kia",
    model: "Telluride",
    bodyType: "SUV",
    powertrain: "Gas",
    priceEstimate: "$39,600 est.",
    priceValue: 39600,
    seatsCategory: "6+",
    priorityScores: {
      Safety: 5,
      Comfort: 5,
      "Cargo Space": 4,
      "Fuel Economy": 2,
      Reliability: 4,
      Performance: 3,
      "Technology & Features": 4,
      "Price/Value": 4,
      "Resale Value": 3,
    },
    rationale: "Three rows of seating for a growing family.",
  },
  {
    id: "prius",
    make: "Toyota",
    model: "Prius",
    bodyType: "Hatchback",
    powertrain: "Hybrid",
    priceEstimate: "$27,750 est.",
    priceValue: 27750,
    seatsCategory: "3-5",
    priorityScores: {
      Safety: 4,
      Comfort: 3,
      "Cargo Space": 3,
      "Fuel Economy": 5,
      Reliability: 5,
      Performance: 2,
      "Technology & Features": 3,
      "Price/Value": 4,
      "Resale Value": 4,
    },
    rationale: "Best-in-class miles per gallon for a daily driver.",
  },
  {
    id: "civic",
    make: "Honda",
    model: "Civic",
    bodyType: "Sedan",
    powertrain: "Gas",
    priceEstimate: "$24,900 est.",
    priceValue: 24900,
    seatsCategory: "3-5",
    priorityScores: {
      Safety: 4,
      Comfort: 3,
      "Cargo Space": 2,
      "Fuel Economy": 4,
      Reliability: 5,
      Performance: 3,
      "Technology & Features": 3,
      "Price/Value": 4,
      "Resale Value": 4,
    },
    rationale: "Reliable, efficient, and cheap to maintain over time.",
  },
  {
    id: "ioniq-5",
    make: "Hyundai",
    model: "IONIQ 5",
    bodyType: "SUV",
    powertrain: "Electric",
    priceEstimate: "$44,500 est.",
    priceValue: 44500,
    seatsCategory: "3-5",
    priorityScores: {
      Safety: 4,
      Comfort: 4,
      "Cargo Space": 3,
      "Fuel Economy": 5,
      Reliability: 3,
      Performance: 4,
      "Technology & Features": 5,
      "Price/Value": 3,
      "Resale Value": 3,
    },
    rationale: "Roomy EV crossover with fast charging for road trips.",
  },
];
