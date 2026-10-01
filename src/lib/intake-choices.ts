// The intake choices an unpaid search is saved from (sign-up-to-payment fix,
// 2026-09-30). Types only, in their own plain module so client components,
// server-only helpers and "use server" files can all import them -- a
// "use server" file can't re-export types (Next treats every export there
// as a server action and fails at runtime on a type).

/**
 * Context carried over from a Matchmaker card. DISPLAY/REFERENCE ONLY --
 * see the matchmaker_* column comments. Only ever passed explicitly from a
 * live form, never read back from a browser stash.
 */
export type MatchmakerContext = {
  priceCents: number | null;
  modelYear: number | null;
};

export type IntakeChoices =
  | {
      kind: "vehicle";
      make: string;
      model: string;
      /** Nullable so a missing year reaches validateIntakeChoices (unpaid-search.ts) and gets a clear
       *  error (a resumed stash from before the field existed has none). */
      modelYear: number | null;
      zip: string;
      /** Pickup-range form value (see PICKUP_TRAVEL_OPTIONS). */
      pickupTravel: string | null;
      matchmaker?: MatchmakerContext;
    }
  | { kind: "undecided" };
