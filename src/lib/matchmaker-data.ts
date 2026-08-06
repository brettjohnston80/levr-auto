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

export const PRICE_RANGES = [
  "Budget-Conscious (Under $30,000)",
  "Practical ($30,000 – $45,000)",
  "Well-Equipped ($45,000 – $60,000)",
  "Premium ($60,000 – $80,000)",
  "Luxurious (Over $80,000)",
];

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

export type MockVehicle = {
  id: string;
  make: string;
  model: string;
  bodyType: VehicleType;
  powertrain: Powertrain;
  priceEstimate: string;
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
    rationale: "Handles hardware-store runs and long hauls without breaking a sweat.",
  },
  {
    id: "f-150",
    make: "Ford",
    model: "F-150",
    bodyType: "Truck",
    powertrain: "Gas",
    priceEstimate: "$42,900 est.",
    rationale: "Bed space and towing capacity for real work-site duty.",
  },
  {
    id: "elantra",
    make: "Hyundai",
    model: "Elantra",
    bodyType: "Sedan",
    powertrain: "Gas",
    priceEstimate: "$23,400 est.",
    rationale: "Cheap to own and easy to park for a daily commute.",
  },
  {
    id: "cr-v-hybrid",
    make: "Honda",
    model: "CR-V Hybrid",
    bodyType: "SUV",
    powertrain: "Hybrid",
    priceEstimate: "$34,800 est.",
    rationale: "Balances passenger room with day-to-day fuel savings.",
  },
  {
    id: "model-y",
    make: "Tesla",
    model: "Model Y",
    bodyType: "SUV",
    powertrain: "Electric",
    priceEstimate: "$46,900 est.",
    rationale: "Quiet commute, quick charging, and zero gas-station stops.",
  },
  {
    id: "silverado",
    make: "Chevrolet",
    model: "Silverado 1500",
    bodyType: "Truck",
    powertrain: "Gas",
    priceEstimate: "$45,200 est.",
    rationale: "Full-size capability if you're hauling gear most days.",
  },
  {
    id: "telluride",
    make: "Kia",
    model: "Telluride",
    bodyType: "SUV",
    powertrain: "Gas",
    priceEstimate: "$39,600 est.",
    rationale: "Three rows of seating for a growing family.",
  },
  {
    id: "prius",
    make: "Toyota",
    model: "Prius",
    bodyType: "Hatchback",
    powertrain: "Hybrid",
    priceEstimate: "$27,750 est.",
    rationale: "Best-in-class miles per gallon for a daily driver.",
  },
  {
    id: "civic",
    make: "Honda",
    model: "Civic",
    bodyType: "Sedan",
    powertrain: "Gas",
    priceEstimate: "$24,900 est.",
    rationale: "Reliable, efficient, and cheap to maintain over time.",
  },
  {
    id: "ioniq-5",
    make: "Hyundai",
    model: "IONIQ 5",
    bodyType: "SUV",
    powertrain: "Electric",
    priceEstimate: "$44,500 est.",
    rationale: "Roomy EV crossover with fast charging for road trips.",
  },
];
