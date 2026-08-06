export type VehicleType = "Car" | "Truck" | "SUV";
export type Powertrain = "Gas" | "Hybrid" | "Electric";

export const VEHICLE_TYPES: VehicleType[] = ["Car", "Truck", "SUV"];

export const USE_CASES = [
  "Commuting",
  "Hardware store & hauling trips",
  "Full-time work use",
];

export const FAMILY_SIZES = ["Just me", "2 people", "3-4 people", "5+ people"];

export const POWERTRAINS: Powertrain[] = ["Gas", "Hybrid", "Electric"];

export const PRICE_RANGES = [
  "Under $25k",
  "$25k – $40k",
  "$40k – $60k",
  "$60k+",
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
    bodyType: "Car",
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
    bodyType: "Car",
    powertrain: "Hybrid",
    priceEstimate: "$27,750 est.",
    rationale: "Best-in-class miles per gallon for a daily driver.",
  },
  {
    id: "civic",
    make: "Honda",
    model: "Civic",
    bodyType: "Car",
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
