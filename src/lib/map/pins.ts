// Provider-neutral map data for Your Deal (2026-09-26): built on the server
// from DealDetails, rendered by src/components/offer-map.tsx.

export type OfferPinStatus = "pending" | "accepted" | "inactive";

export interface OfferPin {
  offerId: string;
  lat: number;
  lng: number;
  /** ZIP-centroid position rather than the listing's real coordinates. */
  approximate: boolean;
  status: OfferPinStatus;
  highlighted: boolean;
  beyondRange: boolean;
  dealerName: string;
  priceCents: number;
  distanceMiles: number | null;
  photoUrl: string | null;
}

export interface OfferMapData {
  pins: OfferPin[];
  /** Offers with no dealer location on file -- listed under the map. */
  unplacedCount: number;
  customer: { lat: number; lng: number } | null;
  /** Pickup-range radius in miles, only when the customer gave a distance. */
  rangeMiles: number | null;
}

export function pinStatus(offerStatus: string): OfferPinStatus {
  if (offerStatus === "customer_accepted") return "accepted";
  if (offerStatus === "pending") return "pending";
  return "inactive"; // declined or withdrawn
}

// Approved copy (2026-09-26).
export const MAP_COPY = {
  toggleList: "List",
  toggleMap: "Map",
  yourArea: "Your area",
  rangeLabel: (miles: number) => `Your pickup range: ${miles} miles`,
  legend: {
    pending: "Pending",
    accepted: "Accepted",
    highlighted: "Highlighted",
    inactive: "Declined or withdrawn",
    beyondRange: "Beyond your pickup range",
  },
  milesAway: (miles: number) => `${miles} miles away`,
  approximate: "Approximate location",
  viewDetails: "View details",
  unplaced: (n: number) => `${n} ${n === 1 ? "offer" : "offers"} can't be shown on the map because the dealer's location isn't on file.`,
};

/** A geodesic circle as a closed [lng, lat] ring -- no geo library needed. */
export function circleRing(center: { lat: number; lng: number }, radiusMiles: number, steps = 96): [number, number][] {
  const R = 3958.8; // Earth radius, miles
  const d = radiusMiles / R;
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const brng = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 =
      lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return ring;
}
