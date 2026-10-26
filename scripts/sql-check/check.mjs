// Offline parse check for migration files: the real Postgres 17 parser (libpg-query, WASM),
// plus PL/pgSQL function bodies. No database connection.
//   node scripts/sql-check/check.mjs supabase/migrations/<file>.sql [more files]
import fs from "node:fs";
import lib from "libpg-query";
const pg = lib;
let bad = 0;
for (const f of process.argv.slice(2)) {
  const sql = fs.readFileSync(f, "utf8");
  try {
    const tree = await pg.parseQuery(sql);
    let fns = 0;
    if (/language\s+plpgsql/i.test(sql)) { await pg.parsePlPgSQL(sql); fns = (sql.match(/language\s+plpgsql/gi) ?? []).length; }
    console.log(`OK   ${f.split("/").pop()}: ${tree.stmts.length} statements${fns ? `, ${fns} PL/pgSQL bodies` : ""}`);
  } catch (e) { bad++; console.log(`FAIL ${f.split("/").pop()}: ${e.message}`); }
}
process.exit(bad ? 1 : 0);
