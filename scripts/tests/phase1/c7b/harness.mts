// Calls the REAL queue functions (read-only) and reports, for the scratch searches, how many came
// back and how many carry their customer's email. Run with tsx from the branch worktree.
import fs from "node:fs";
import { getOutreachQueue, getSwitchCallQueue, getCancellationCallQueue } from "../../../../src/lib/outreach-queue";
const ids = new Set<string>(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
const out: Record<string, unknown> = {};
for (const [name, fn] of [["outreach (active searches)", getOutreachQueue], ["switch calls", getSwitchCallQueue], ["cancellation calls", getCancellationCallQueue]] as const) {
  try {
    const rows = (await (fn as () => Promise<{ id: string; customerEmail?: string | null }[]>)()).filter((r) => ids.has(r.id));
    out[name] = { rows: rows.length, withEmail: rows.filter((r) => !!r.customerEmail).length };
  } catch (e) {
    out[name] = { error: e instanceof Error ? e.message : String(e) };
  }
}
console.log("HARNESS " + JSON.stringify(out));
