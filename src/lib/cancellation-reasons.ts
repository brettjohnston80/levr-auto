// Must match cancellation_log's reason_category on agent-initiated rows --
// no CHECK constraint on this column (kept free-text-compatible in the DB),
// but this is the fixed list AgentCancellationResolutionForm offers, so
// every agent-mediated cancellation reason stays consistent and reportable.
// Deliberately separate from BYPASS_REASON_CATEGORIES (agent-bypass-reasons.ts)
// -- that list is about waiving a fee with no money moving; this one is
// about why a search ended and, often, why money moved back out.
export const CANCELLATION_REASON_CATEGORIES = [
  "Customer no longer in the market",
  "Customer dissatisfied with service",
  "LEVR error",
  "Goodwill gesture",
  "Other",
] as const;
