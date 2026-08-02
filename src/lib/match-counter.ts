const NATIONWIDE_BASE = 4_800_000;

const MAKE_INVENTORY: Record<string, number> = {
  Toyota: 612_400,
  Honda: 498_200,
  Ford: 587_900,
  Chevrolet: 542_100,
  Tesla: 118_600,
  BMW: 204_300,
  "Mercedes-Benz": 189_700,
  Audi: 142_800,
  Jeep: 231_500,
  Subaru: 176_400,
  Hyundai: 265_900,
  Kia: 248_300,
  Nissan: 312_700,
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function seededRatio(seed: string): number {
  return (hashString(seed) % 10_000) / 10_000;
}

export type MatchCounterInput = {
  make: string;
  model: string;
  trim: string;
  colors: string[];
};

export function estimateMatches(
  vehicle: MatchCounterInput,
  zip: string,
  totalColors: number
): number | null {
  if (!vehicle.make) return null;

  let count =
    MAKE_INVENTORY[vehicle.make] ??
    Math.round(NATIONWIDE_BASE * (0.03 + seededRatio(vehicle.make) * 0.08));

  if (vehicle.model) {
    count *= 0.04 + seededRatio(`${vehicle.make}:${vehicle.model}`) * 0.12;
  }

  const trim = vehicle.trim.trim();
  if (trim) {
    count *= 0.35 + seededRatio(`trim:${trim.toLowerCase()}`) * 0.3;
  }

  if (vehicle.colors.length > 0) {
    count *= Math.max(0.15, vehicle.colors.length / totalColors);
  }

  if (/^\d{5}$/.test(zip)) {
    count *= 0.05 + seededRatio(`zip:${zip}:${vehicle.make}:${vehicle.model}`) * 0.1;
  }

  return Math.max(3, Math.round(count));
}
