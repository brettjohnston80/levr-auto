// Pickup travel range + per-offer pickup/delivery (2026-09-26). Pure rules
// and approved copy shared by intake, Your Deal, the offer detail view, the
// agent pages and the server actions -- so "is this offer out of range" and
// "what does this answer say" are decided in exactly one place. No server
// imports: client components import this directly.

export const PICKUP_TRAVEL_MILES = [25, 50, 100, 250, 500] as const;
export type PickupTravelMiles = (typeof PICKUP_TRAVEL_MILES)[number];

export type PickupTravel =
  | { choice: "distance"; miles: PickupTravelMiles }
  | { choice: "prefer_delivery" }
  | { choice: "case_by_case" }
  // "I'd drive any distance" (fuel-gauge redesign, 2026-09-30). Carries no
  // miles, so it is never out of range and draws no map circle.
  | { choice: "unlimited" };

export type HandoffMethod = "pickup" | "delivery";

// Approved copy (2026-09-26).
export const PICKUP_TRAVEL_QUESTION = "How far would you drive to pick up your car?";
export const PICKUP_TRAVEL_INTAKE_HELPER = "We'll focus on dealers within that range, and flag any offer that's farther.";
export const PICKUP_TRAVEL_PROMPT_BODY =
  "This helps us focus on the right dealers and flag offers that are farther away.";
export const PICKUP_TRAVEL_MISSING_ERROR = "Please choose how far you'd drive to pick up your car.";

/** Form values: a distance as its number, or the three non-distance choices. */
export const PICKUP_TRAVEL_OPTIONS: { value: string; label: string }[] = [
  ...PICKUP_TRAVEL_MILES.map((m) => ({ value: String(m), label: `Up to ${m} miles` })),
  { value: "prefer_delivery", label: "I'd rather have it delivered" },
  { value: "unlimited", label: "I'd drive any distance" },
  { value: "case_by_case", label: "It depends — case by case" },
];

/** The fuel gauge's stops, empty (left) to full (right). Case by case is a
 *  separate button, not a stop. Short labels approved 2026-09-30. */
export const PICKUP_TRAVEL_GAUGE_STOPS: { value: string; shortLabel: string }[] = [
  { value: "prefer_delivery", shortLabel: "Delivery" },
  ...PICKUP_TRAVEL_MILES.map((m) => ({ value: String(m), shortLabel: String(m) })),
  { value: "unlimited", shortLabel: "Any" },
];
export const PICKUP_TRAVEL_GAUGE_HINT = "Drag or tap to choose";

/** Full wording for a form value (the gauge's centre text). */
export function travelValueLabel(value: string): string | null {
  return PICKUP_TRAVEL_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

export function travelFromValue(value: string | null | undefined): PickupTravel | null {
  if (value === "prefer_delivery" || value === "case_by_case" || value === "unlimited") return { choice: value };
  const miles = Number(value);
  return (PICKUP_TRAVEL_MILES as readonly number[]).includes(miles)
    ? { choice: "distance", miles: miles as PickupTravelMiles }
    : null;
}

export function travelToValue(travel: PickupTravel | null): string {
  if (!travel) return "";
  return travel.choice === "distance" ? String(travel.miles) : travel.choice;
}

/** From the two customer_searches columns. Anything inconsistent reads as unanswered. */
export function travelFromColumns(choice: string | null, miles: number | null): PickupTravel | null {
  if (choice === "distance") return travelFromValue(String(miles));
  if (choice === "prefer_delivery" || choice === "case_by_case" || choice === "unlimited") return { choice };
  return null;
}

/** To the two customer_searches columns (the DB shape check mirrors this). */
export function travelToColumns(travel: PickupTravel): { pickup_travel_choice: string; pickup_travel_miles: number | null } {
  return {
    pickup_travel_choice: travel.choice,
    pickup_travel_miles: travel.choice === "distance" ? travel.miles : null,
  };
}

/** Customer-facing summary line on Your Deal. */
export function travelSummary(travel: PickupTravel): string {
  if (travel.choice === "distance") return `Pickup range: up to ${travel.miles} miles`;
  if (travel.choice === "prefer_delivery") return "Pickup range: you'd rather have it delivered";
  if (travel.choice === "unlimited") return "Pickup range: any distance";
  return "Pickup range: case by case";
}

/** Agent-facing label. */
export function travelAgentLabel(travel: PickupTravel | null): string {
  if (!travel) return "Not answered yet";
  if (travel.choice === "distance") return `Up to ${travel.miles} miles`;
  if (travel.choice === "unlimited") return "Any distance";
  return travel.choice === "prefer_delivery" ? "Prefers delivery" : "Case by case";
}

/** Same rounding the detail view uses for "About N miles from you". */
export function roundMiles(distanceMiles: number): number {
  return Math.max(1, Math.round(distanceMiles));
}

/**
 * The out-of-range flag. Only when the customer gave a distance, the offer's
 * distance is known, it's farther than that distance, and they haven't
 * already chosen delivery on this offer (the warning would be noise then).
 */
export function isBeyondPickupRange(
  travel: PickupTravel | null,
  distanceMiles: number | null,
  handoff: HandoffMethod | null,
): boolean {
  if (!travel || travel.choice !== "distance") return false;
  if (distanceMiles == null) return false;
  if (handoff === "delivery") return false;
  return roundMiles(distanceMiles) > travel.miles;
}

// Approved copy (2026-09-26).
export function outOfRangeCopy(distanceMiles: number, travelMiles: number): string {
  return `${roundMiles(distanceMiles)} miles away — farther than the ${travelMiles} miles you said you'd drive. Delivery may cost extra.`;
}

/**
 * What the accept confirmation pre-selects when the offer has no answer yet:
 * pickup when within range (or distance unknown) or when they'd drive any
 * distance (approved 2026-09-30), delivery when beyond it or when they said
 * they'd rather have it delivered, nothing otherwise.
 */
export function defaultHandoff(travel: PickupTravel | null, distanceMiles: number | null): HandoffMethod | null {
  if (!travel || travel.choice === "case_by_case") return null;
  if (travel.choice === "prefer_delivery") return "delivery";
  if (travel.choice === "unlimited") return "pickup";
  if (distanceMiles != null && roundMiles(distanceMiles) > travel.miles) return "delivery";
  return "pickup";
}

export const HANDOFF_QUESTION = "How would you get this car?";
export const HANDOFF_OPTIONS: { value: HandoffMethod; label: string }[] = [
  { value: "pickup", label: "I'd pick it up" },
  { value: "delivery", label: "Estimate delivery for me" },
];
export const HANDOFF_HELPER = "You can change this anytime before you buy.";
export const HANDOFF_ACCEPT_PROMPT = "Confirm how you'd get this car:";
export const HANDOFF_ACCEPT_DISABLED_HINT = "Choose pickup or delivery to accept.";
export const HANDOFF_REQUIRED_ERROR = "Choose pickup or delivery before accepting.";
export const HANDOFF_CLOSED_ERROR = "You can only change this on an offer that's still open.";

/** "Congratulations — next steps" line. */
export function handoffNextStepsCopy(method: HandoffMethod): string {
  return method === "pickup"
    ? "Getting your car: You'll pick it up."
    : "Getting your car: We're getting you a delivery estimate.";
}
export const DELIVERY_EXPLANATION =
  "LEVR doesn't arrange delivery in-house yet — your agent will get a delivery estimate from the dealer, and you and the dealer will set up shipping directly.";

/** Agent-facing handoff label. */
export function handoffAgentLabel(method: HandoffMethod | null): string {
  if (method === "pickup") return "Would pick it up";
  if (method === "delivery") return "Wants a delivery estimate";
  return "Pickup/delivery not chosen yet";
}

export function isHandoffMethod(value: unknown): value is HandoffMethod {
  return value === "pickup" || value === "delivery";
}
