// Transpiles the sign-in modules from src/lib (following their local imports) into gen/, so the
// library-level Chunk 1 tests call the branch's real code. gen/ is git-ignored and rebuilt by the
// runner before every run, so it can never be an older copy.
//   gen/real: the modules use the real service-role client (lib/admin.mjs)
//   gen/spy:  the modules use c1g/spy-admin.mjs, which records add_agent calls and runs none
const path = require("path"); const fs = require("fs");
const tests = path.resolve(__dirname, ".."); const root = path.resolve(tests, "../../..");
const ts = require(root + "/node_modules/typescript");
const start = ["agent-invite", "agent-accounts", "email", "runtime-env", "test-accounts", "agent-two-factor-reset", "agent-invite-lifetime", "agent-activity", "offer-submission"];
for (const [dir, admin] of [["real", "../../lib/admin.mjs"], ["spy", "../../c1g/spy-admin.mjs"]]) {
  const out = path.join(tests, "gen", dir); fs.mkdirSync(out, { recursive: true });
  const seen = new Set(); const queue = [...start];
  while (queue.length) {
    const f = queue.shift(); if (seen.has(f)) continue; seen.add(f);
    let code = ts.transpileModule(fs.readFileSync(`${root}/src/lib/${f}.ts`, "utf8"),
      { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    code = code.replace(/import "server-only";/g, "").replace(/from "react"/g, 'from "./stub-react.mjs"')
      .replace(/from "\.\/supabase\/admin"/g, `from "${admin}"`)
      .replace(/from "\.\/([a-z0-9-]+)"/g, (m, name) => { queue.push(name); return `from "./${name}.mjs"`; });
    fs.writeFileSync(`${out}/${f}.mjs`, code);
  }
  fs.writeFileSync(`${out}/stub-react.mjs`, "export const cache = (fn) => fn;\n");
  console.log(`gen/${dir}:`, [...seen].join(", "));
}
