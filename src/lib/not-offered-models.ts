/**
 * Make/models customers can no longer choose, even though the researched
 * vehicle dataset still has them. Shared by intake (intake-vehicle-options.ts,
 * which also feeds the switch and agent forms and the server-side year
 * check) and Matchmaker (matchmaker-vehicles.ts), so the two never disagree.
 *
 * Ford Escape (Brett, 2026-10-10): Ford is discontinuing it and it can't be
 * bought in CA, MA, OR, NY, WA or VT.
 *
 * /matchmaker is a static page, so a change here reaches it on the next
 * deploy.
 */
const NOT_OFFERED = new Set(["Ford|Escape"]);

export function isNotOfferedModel(make: string | null, model: string | null): boolean {
  return NOT_OFFERED.has(`${make ?? ""}|${model ?? ""}`);
}
