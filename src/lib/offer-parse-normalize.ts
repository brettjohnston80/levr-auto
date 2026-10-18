// Turns the AI parser's raw tool input into ParsedOffer. Kept out of
// offer-parsing-actions.ts because a "use server" file may only export async
// functions, and this needs to be unit-tested.
//
// Destination is never an add-on (Brett, 2026-10-17). Total SRP already
// includes the manufacturer's destination charge, so a destination amount
// the dealer lists separately belongs in the offer price; listing it as an
// add-on would make the offer look that much further below Total SRP than it
// really is. The parser reports it in its own field, and as a backstop any
// add-on line that names destination is moved into the price here too.

export interface ParsedOfferAddon {
  description: string;
  amountCents: number;
}

export interface ParsedOffer {
  dealerName: string | null;
  dealerContact: string | null;
  // Includes destinationCents whenever the dealer stated a vehicle price.
  offerPriceCents: number | null;
  addons: ParsedOfferAddon[];
  // The separately listed destination charge that was moved into the price
  // (or, with no stated price, that the agent still needs to include). 0 when
  // none was listed.
  destinationCents: number;
}

// Manufacturers' names for the destination charge: "Destination", "Dest.
// charge", GM's "Destination Freight Charge", Hyundai's "Freight Charges",
// Toyota's "Delivery, Processing and Handling" (DPH), Honda's "Destination and
// Handling" (D&H).
const DESTINATION_PATTERN =
  /\bdestination\b|\bdest\.?\s*(chg|charge|fee)\b|\bfreight\b|\bprocessing\s*(and|&)\s*handling\b|\bD\s*&\s*H\b|\bDPH\b/i;

export function isDestinationCharge(description: string): boolean {
  return DESTINATION_PATTERN.test(description);
}

/** Shown when an agent types a destination add-on by hand (approved 2026-10-17). */
export const DESTINATION_ADDON_REFUSAL = "Destination is already included in Total SRP. Add it to the offer price instead.";

/** The refusal for the first add-on description that names destination, or null. */
export function destinationAddonRefusal(descriptions: string[]): string | null {
  return descriptions.some((d) => isDestinationCharge(d)) ? DESTINATION_ADDON_REFUSAL : null;
}

function toCents(dollars: unknown): number | null {
  return typeof dollars === "number" && Number.isFinite(dollars) ? Math.round(dollars * 100) : null;
}

export function toParsedOffer(input: Record<string, unknown>): ParsedOffer {
  const rawAddons = Array.isArray(input.addons) ? input.addons : [];
  const lines: ParsedOfferAddon[] = rawAddons
    .filter((a): a is { description: unknown; amount_dollars: unknown } => typeof a === "object" && a !== null)
    .map((a) => ({
      description: String(a.description ?? "").trim(),
      amountCents: Math.round(Number(a.amount_dollars ?? 0) * 100),
    }))
    .filter((a) => a.description.length > 0 && Number.isFinite(a.amountCents) && a.amountCents > 0);

  const addons = lines.filter((a) => !isDestinationCharge(a.description));
  const destinationFromAddons = lines
    .filter((a) => isDestinationCharge(a.description))
    .reduce((sum, a) => sum + a.amountCents, 0);
  // If the parser filled its own field, that is the figure; a destination line
  // in addons as well would be the same charge listed twice, not a second one.
  const destinationField = toCents(input.destination_dollars);
  const destinationCents =
    destinationField !== null && destinationField > 0 ? destinationField : destinationFromAddons;

  const statedPrice = toCents(input.offer_price_dollars);
  const offerPriceCents = statedPrice === null ? null : statedPrice + destinationCents;

  return {
    dealerName: typeof input.dealer_name === "string" && input.dealer_name.trim() ? input.dealer_name.trim() : null,
    dealerContact:
      typeof input.dealer_contact === "string" && input.dealer_contact.trim() ? input.dealer_contact.trim() : null,
    offerPriceCents,
    addons,
    destinationCents,
  };
}
