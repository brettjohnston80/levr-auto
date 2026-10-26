// Writes c1/action-ids.json and c1/gated-ids.json from the branch dev server's action manifest.
// Action ids change whenever files move, so the runner regenerates these after warming the pages
// (only compiled pages' actions are in the manifest). Never committed (git-ignored).
//   action-ids.json: every server action that checks the agent session (getAuthorizedAgent /
//                    requireAgent, directly or through a helper in the same file) -> c1d-actions
//   gated-ids.json:  the lead- or admin-only ones (C16), plus resetTwoFactorAction and the ungated
//                    searchCustomers as a control -> c16-1e
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.mjs";

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, ".next/dev/server/server-reference-manifest.json"), "utf8"));
const idOf = new Map();
for (const v of Object.values(manifest.node)) for (const w of Object.values(v.workers)) {
  const q = decodeURIComponent((w.moduleId.split("actions=")[1] ?? "").split("&")[0]);
  try { for (const [file, list] of JSON.parse(q)) for (const x of list) idOf.set(`${x.filename}#${x.exportedName ?? x.name}`, x.id); } catch {}
}

const GATE = /getAuthorizedAgent|requireAgent\(/;
const all = {}, gated = {}, missing = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const file of walk(path.join(ROOT, "src/lib")).filter((f) => f.endsWith(".ts"))) {
  const src = fs.readFileSync(file, "utf8");
  if (!/^\s*(\/\/.*\n\s*)*["']use server["']/.test(src)) continue;
  // Split into top-level functions; a helper that checks the session gates every export calling it.
  const chunks = src.split(/\n(?=(?:export )?async function |function )/);
  const body = {}; const exported = [];
  for (const c of chunks) { const m = c.match(/^(export )?(?:async )?function (\w+)/); if (m) { body[m[2]] = c; if (m[1]) exported.push(m[2]); } }
  const gatedHelpers = Object.keys(body).filter((n) => !exported.includes(n) && GATE.test(body[n]));
  const rel = path.relative(path.join(ROOT, "src"), file);
  for (const name of exported) {
    const b = body[name];
    const isAgent = GATE.test(b) || gatedHelpers.some((h) => new RegExp(`\\b${h}\\(`).test(b));
    if (!isAgent && name !== "searchCustomers") continue;
    const id = idOf.get(`${rel}#${name}`);
    if (!id) { missing.push(`${rel}#${name}`); continue; }
    if (isAgent) all[name] = [id, rel];
    if (/minRole: "(lead|admin)"/.test(b) && !["addAgentAction", "resendInviteAction"].includes(name)) gated[name] = [id, rel];
    if (name === "resetTwoFactorAction" || name === "searchCustomers") gated[name] = [id, rel];
  }
}
fs.writeFileSync(path.join(ROOT, "scripts/tests/phase1/c1/action-ids.json"), JSON.stringify(all, null, 1));
fs.writeFileSync(path.join(ROOT, "scripts/tests/phase1/c1/gated-ids.json"), JSON.stringify(gated, null, 1));
console.log(`agent actions: ${Object.keys(all).length}; lead/admin-gated: ${Object.keys(gated).length - 1} (+ searchCustomers)`);
if (missing.length) console.log("not in the manifest (page not compiled yet):", missing.join(", "));
