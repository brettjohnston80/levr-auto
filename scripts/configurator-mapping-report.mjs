// Dry run of the import mapping step (src/lib/configurator-mapping.ts) over
// research CSVs: no database, no network. Prints what each rule would change,
// what it left alone, and any trim-identity collisions.
//
//   node scripts/configurator-mapping-report.mjs data/<file>.csv [more files] [--facts data/<engine-facts>.csv] [--json out.json]
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parse } = require("csv-parse/sync");
const { mapConfiguratorRows, engineFactsFromRows, heldModelsFromJson } = await import("../src/lib/configurator-mapping.ts");

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i === -1) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const factsFile = flag("--facts");
const jsonOut = flag("--json");
// --facts a.csv,b.csv: several facts files; later files win on the same engine.
const engineFacts = factsFile ? engineFactsFromRows(factsFile.split(",").flatMap((f) => parse(fs.readFileSync(f, "utf8"), { columns: true, skip_empty_lines: true }))) : undefined;

// The same held list the import and the Matchmaker build use.
const heldModels = heldModelsFromJson(fs.readFileSync(new URL("../data/held-models.json", import.meta.url), "utf8"));

const all = { files: {} };
for (const file of args) {
  const rows = parse(fs.readFileSync(file, "utf8"), { columns: true, skip_empty_lines: true, trim: false });
  const { report } = mapConfiguratorRows(rows, { engineFacts, heldModels });
  all.files[file] = report;
  const unmappedByRule = report.unmapped.reduce((a, n) => ((a[n.rule] = (a[n.rule] ?? 0) + 1), a), {});
  console.log(`\n=== ${file}\n  rows ${report.rowsIn} -> ${report.rowsOut}; changed ${JSON.stringify(report.changed)}`);
  console.log(`  left as is, by rule: ${JSON.stringify(unmappedByRule)}; dropped ${report.dropped.length}; collisions ${report.collisions.length}; corrections ${report.corrections.length}; held ${report.held.length}`);
  for (const h of report.held) console.log(`  HELD ${h.make} ${h.model} ${h.trim} ${h.modelYear}: ${h.detail}`);
  for (const c of report.collisions) console.log(`  COLLISION ${c}`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(all, null, 1));
