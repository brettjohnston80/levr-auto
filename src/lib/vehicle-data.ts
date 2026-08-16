export const MAKES_AND_MODELS: Record<string, string[]> = {
  Toyota: ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "4Runner"],
  Honda: ["Accord", "Civic", "CR-V", "Pilot", "Odyssey"],
  Ford: ["F-150", "Mustang", "Explorer", "Bronco", "Escape"],
  Chevrolet: ["Silverado", "Equinox", "Tahoe", "Camaro", "Traverse"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X"],
  BMW: ["3 Series", "5 Series", "X3", "X5"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLC", "GLE"],
  Audi: ["A4", "A6", "Q5", "Q7"],
  Jeep: ["Wrangler", "Grand Cherokee", "Compass"],
  Subaru: ["Outback", "Forester", "Crosstrek"],
  Hyundai: ["Elantra", "Tucson", "Santa Fe", "Palisade"],
  Kia: ["Telluride", "Sportage", "Sorento", "K5"],
  Nissan: ["Altima", "Rogue", "Pathfinder"],
};

export const MAKES = Object.keys(MAKES_AND_MODELS);

export const COLORS = [
  "Black",
  "White",
  "Silver",
  "Gray",
  "Red",
  "Blue",
  "Green",
  "Beige/Tan",
];

export const OPTIONS = [
  "Sunroof / Moonroof",
  "Leather Seats",
  "Navigation System",
  "Heated & Ventilated Seats",
  "Third-Row Seating",
  "Tow Package",
  "Premium Audio",
  "Advanced Safety Package",
  "All-Wheel Drive",
  "Premium Wheels",
];

// Flat fee, one vehicle, always — no tiers.
export const FLAT_PRICE = 699;

// $100 per switch (after the free grace-period switch) and per ~30-day
// Day-60 extension — same flat fee for both, per Core-Processes-v1.md.
export const EXTENSION_FEE = 100;

// How long a paused search can be resumed self-service (pay the extension
// fee, no agent involved) before it needs agent intervention. Single named
// constant so this never has to be hunted down across files again — used by
// createExtensionCheckoutSession's eligibility gate, getStalePausedSearchesQueue's
// threshold, and the paused-state dashboard copy. Changed from 7 to 30 days
// as part of the finalized Day-60 paused-state policy (CLAUDE.md, 2026-08-15).
export const RESUME_WINDOW_DAYS = 30;
