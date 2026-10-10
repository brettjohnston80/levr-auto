import type { ConfiguratorSelection } from "@/lib/configurator-matching";

/**
 * A finalized search's saved answers, in the exact shape the finalize flow
 * (finalize-self-service.tsx) holds them, so "Make changes" during the 24h
 * window reopens that same flow pre-filled instead of a cruder edit form
 * (Brett's walkthrough, 2026-10-10). Ids use the flow's own conventions:
 * a trim option is `${trim}::${year ?? "unknown"}` (buildTrimOptions), a
 * combination is combinationId()'s `${trimId}::${color}::${interior}::${seating}`
 * with " " for a no-preference axis. A saved row whose trim no longer
 * appears in current inventory simply doesn't match and drops out, the same
 * way the flow already treats a trim that's gone.
 */
export interface FinalizeInitial {
  rankedTrimIds: string[];
  excludedTrimIds: string[];
  /** Legacy generic-path answers (makes with no configurator data). */
  colors: string[];
  options: string[];
  selections: ConfiguratorSelection[];
  combinationRanked: string[];
  combinationExcluded: string[];
}
