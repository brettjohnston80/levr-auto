// Must match agent_bypass_log's reason_category CHECK constraint exactly
// (20260816140000_agent_bypass_log.sql). Shared between the retrofitted
// AgentSwitchSearchForm and the new extension-bypass form so the two never
// drift apart.
export const BYPASS_REASON_CATEGORIES = [
  "Customer complaint / dissatisfaction",
  "Goodwill gesture",
  "Our error",
  "Special circumstances",
  "Other",
] as const;
