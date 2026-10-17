// Body-aware matching (Brett, 2026-10-16): a trim our research has a row per
// body for is named and matched by body; nothing else changes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
// finalize-trims.ts imports "./configurator-matching" without an extension (as the app's bundler
// allows); let Node's own type stripping find it.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return nextResolve(specifier, context);
  },
});
const M = await import("../src/lib/configurator-matching.ts");
const T = await import("../src/lib/finalize-trims.ts");

const cand = (make, model, trim, bodyStyle, fuelType = "Gas", modelYear = 2026) => ({ id: `${trim}|${bodyStyle}|${fuelType}`, make, model, trim, modelYear, fuelType, bodyStyle });
const charger = [cand("Dodge", "Charger", "Scat Pack", "Coupe"), cand("Dodge", "Charger", "Scat Pack", "Sedan"), cand("Dodge", "Charger", "R/T", "Coupe"), cand("Dodge", "Charger", "R/T", "Sedan")];
const splitterFor = (rows) => (trim, year) => M.bodySplitFor(rows, { trim, year });
const L = (trim, doors, bodyType = "Hatchback", price = 5000000) => ({ trim, price_cents: price, year: 2026, powertrain: "Combustion", bodyType, doors });

describe("body-aware matching", () => {
  it("Charger: door count picks 2-Door (Coupe) or 4-Door (Sedan), with Dodge's names", () => {
    const opts = T.buildTrimOptions([L("Scat Pack", "3"), L("Scat Pack", "3"), L("Scat Pack", "5"), L("R/T", "5")], splitterFor(charger));
    assert.deepEqual(opts.map((o) => [o.trim, o.count, o.body, o.baseTrim]).sort(), [
      ["R/T 4-Door", 1, "Sedan", "R/T"], ["Scat Pack 2-Door", 2, "Coupe", "Scat Pack"], ["Scat Pack 4-Door", 1, "Sedan", "Scat Pack"],
    ]);
    for (const o of opts) {
      const pool = charger.filter((c) => c.bodyStyle === o.body);
      const out = M.matchConfiguratorTrim(pool, { trim: o.baseTrim, year: 2026, powertrains: ["GAS"] });
      assert.ok(out.matched && out.configuratorTrimId === `${o.baseTrim}|${o.body}|Gas`, o.trim);
    }
  });
  it("Corolla / Mazda3: body type picks Hatchback or Sedan; Mercedes calls the convertible a Cabriolet", () => {
    const corolla = [cand("Toyota", "Corolla", "SE", "hatchback"), cand("Toyota", "Corolla", "SE", "sedan")];
    assert.deepEqual(T.buildTrimOptions([L("SE", "5", "Hatchback"), L("SE", "4", "Sedan")], splitterFor(corolla)).map((o) => o.trim).sort(), ["SE Hatchback", "SE Sedan"]);
    const cle = [cand("Mercedes-Benz", "CLE", "CLE 300 4MATIC", "Coupe"), cand("Mercedes-Benz", "CLE", "CLE 300 4MATIC", "Convertible")];
    assert.deepEqual(T.buildTrimOptions([L("CLE 300", "2", "Coupe"), L("CLE 300", "2", "Convertible")], splitterFor(cle)).map((o) => o.trim).sort(), ["CLE 300 Cabriolet", "CLE 300 Coupe"]);
  });
  it("one body among the listings still gets its name, so it can match; an unreadable body joins the most common", () => {
    const opts = T.buildTrimOptions([L("R/T", "5"), L("R/T", "5"), L("R/T", null, null)], splitterFor(charger));
    assert.deepEqual(opts.map((o) => [o.trim, o.count]), [["R/T 4-Door", 3]]);
  });
  it("trims without research twins, and no splitter at all, are exactly as before", () => {
    const ls = [L("Scat Pack", "3"), L("Scat Pack", "5")];
    const one = [cand("Dodge", "Charger", "Scat Pack", "Coupe")];
    assert.deepEqual(T.buildTrimOptions(ls, splitterFor(one)), T.buildTrimOptions(ls));
    assert.deepEqual(T.buildTrimOptions(ls).map((o) => [o.trim, o.count, o.body]), [["Scat Pack", 2, undefined]]);
  });
});
