// Truck cab and bed (Brett, 2026-10-16, option C; wording signed off): a
// pickup's drivetrain list can hold whole builds -- cab, bed, 2WD/4WD and,
// for GMC, the engine -- priced as one combination. They're shown as one
// choice each, in a fixed order ("Crew Cab, Short Bed · 4WD · 5.3L V8,
// 10-speed automatic"), under "Cab, bed & powertrain" instead of
// "Drivetrain", so a shopper never reads a cab or bed as an engine choice.
// Display only: the stored option names, and so inventory matching and every
// saved answer, are unchanged. Pure, no imports, shared by server and client.

const CAB = /^(Crew|Double|Regular|Quad|Mega|Extended|King|Access|SuperCrew|SuperCab|Super Crew|Super Cab) Cab\b/i;

// GMC Sierra EV lines lead with the battery: "Standard Range battery, Crew Cab, Short Bed, 4WD".
const BATTERY_FIRST = /^([^,]*\bbattery), (.+)$/i;

/** A drivetrain line that is a truck build (it starts with a cab, or a battery and then a cab). */
export function isCabBedLine(name: string): boolean {
  const n = name.trim();
  const b = n.match(BATTERY_FIRST);
  return CAB.test(b ? b[2] : n);
}

const DRIVE: Record<string, string> = { "4x2 (rwd)": "RWD", "4x2": "2WD", "4x4": "4WD", "2wd": "2WD", "4wd": "4WD", "awd": "AWD", "rwd": "RWD", "fwd": "FWD" };
const drive = (s: string) => DRIVE[s.trim().toLowerCase()];
/** "Crew Cab Long Bed" -> "Crew Cab, Long Bed" (Nissan writes them together). */
const cabAndBed = (s: string) => s.replace(/\b(Cab) (\S+ (?:Bed|Box))$/i, "$1, $2");

function tidyPowertrain(s: string): string {
  return s
    .replace(/\b(\d\.\dL) EcoTec3 (V\d) engine\b/i, "$1 $2")
    .replace(/\b(\d\.\dL) Duramax Turbo[- ]Diesel (V\d )?engine\b/i, (_m, size: string, v?: string) => `${size} Duramax diesel${v ? ` ${v.trim()}` : ""}`)
    .replace(/\b(\d+)-speed automatic transmission\b/i, "$1-speed automatic")
    .replace(/ with /i, ", ")
    .trim();
}

/**
 * The display form of one build line; anything it can't read is returned
 * unchanged, so an unexpected line is never mangled.
 *   GMC: "Crew Cab, Short Bed, 4WD, 5.3L EcoTec3 V8 engine, 10-speed automatic transmission"
 *        -> "Crew Cab, Short Bed · 4WD · 5.3L V8, 10-speed automatic"
 *   Ram: "Crew Cab / 4x4 / 5'7\" Box" -> "Crew Cab, 5'7\" Box · 4WD"; "Crew Cab / 4x4" -> "Crew Cab · 4WD"
 *   Nissan: "Crew Cab Long Bed, 4x4" -> "Crew Cab, Long Bed · 4WD"
 *   GMC Sierra EV: "Max Range battery, Crew Cab, Short Bed, 4WD" -> "Crew Cab, Short Bed · 4WD · Max Range battery"
 */
export function formatCabBedLine(name: string): string {
  const n = name.trim();
  if (!isCabBedLine(n)) return name;
  const battery = n.match(BATTERY_FIRST);
  if (battery) {
    const rest = formatCabBedLine(battery[2]);
    return rest === battery[2] ? name : `${rest} · ${battery[1]}`;
  }
  if (n.includes(" / ")) {
    // Ram: "Cab / drive / box" or "Cab / drive".
    const parts = n.split(" / ").map((p) => p.trim());
    const d = parts[1] ? drive(parts[1]) : undefined;
    if (!d) return name;
    if (parts.length === 2) return `${parts[0]} · ${d}`;
    if (parts.length === 3 && /box|bed/i.test(parts[2])) return `${parts[0]}, ${parts[2]} · ${d}`;
    return name;
  }
  const parts = n.split(", ");
  // Nissan: "King Cab, 4x2 (RWD)", "Crew Cab Long Bed, 4x4".
  if (parts.length === 2 && drive(parts[1])) return `${cabAndBed(parts[0])} · ${drive(parts[1])}`;
  // GMC: "Cab, Bed, drive, engine, transmission…".
  if (parts.length < 3 || !/bed|box/i.test(parts[1]) || !drive(parts[2])) return name;
  const [cab, bed, d, ...rest] = parts;
  const powertrain = tidyPowertrain(rest.join(", "));
  return powertrain ? `${cab}, ${bed} · ${drive(d)} · ${powertrain}` : `${cab}, ${bed} · ${drive(d)}`;
}

/** The drivetrain section's heading. */
export function drivetrainHeading(names: string[]): string {
  return names.some(isCabBedLine) ? "Cab, bed & powertrain" : "Drivetrain";
}

/** Minimal shape of a priced choice (ConfiguratorChoice satisfies it). */
export interface PricedLine {
  name: string;
  availability: string;
  priceCents: number | null;
  priceIsIncluded?: boolean;
}

/**
 * "{N} builds, from {lowest} to {highest}" (signed off 2026-10-16), or null
 * when the list has no builds. A Standard (or $0) build is "Standard"; a
 * build with no confirmed price is counted but left out of the range.
 */
export function buildsSummary(lines: PricedLine[]): string | null {
  const builds = lines.filter((l) => isCabBedLine(l.name));
  if (builds.length === 0) return null;
  const prices = builds
    .map((l) => (l.availability === "standard" || l.priceIsIncluded ? 0 : l.priceCents))
    .filter((p): p is number => p != null);
  const label = (cents: number) => (cents === 0 ? "Standard" : `+$${Math.round(cents / 100).toLocaleString("en-US")}`);
  const count = `${builds.length} build${builds.length === 1 ? "" : "s"}`;
  if (prices.length === 0) return count;
  const lo = Math.min(...prices), hi = Math.max(...prices);
  return lo === hi ? `${count}, ${label(lo)}` : `${count}, from ${label(lo)} to ${label(hi)}`;
}
