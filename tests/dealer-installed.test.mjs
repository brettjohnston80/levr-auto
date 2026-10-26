// Dealer-installed rule and LPO display names (Brett, 2026-10-17).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return nextResolve(specifier, context);
  },
});
const D = await import("../src/lib/option-display.ts");
const R = await import("../src/lib/configurator-dealer-installed.ts");
const P = await import("../src/lib/configurator-parse.ts");

describe("LPO code in names", () => {
  it("recognizes GM's three forms, and nothing else", () => {
    assert.equal(D.hasLpoCode("LPO, Wheel locks, set of 4"), true);
    assert.equal(D.hasLpoCode('LPO 22" (55.9 cm x 22.9 cm) Polished aluminum'), true);
    assert.equal(D.hasLpoCode("Underhood Sight Shield, LPO"), true);
    assert.equal(D.hasLpoCode('Wheels, 20" transit steel wheels for LPO 20" wheels and tires'), false);
    assert.equal(D.hasLpoCode("Lpo-free carpet"), false);
    assert.equal(D.hasLpoCode("Heated seats"), false);
  });
  it("drops the code from the displayed name only", () => {
    assert.equal(D.displayOptionName("LPO, Wheel locks, set of 4"), "Wheel locks, set of 4");
    assert.equal(D.displayOptionName('LPO 22" (55.9 cm x 22.9 cm) Polished aluminum'), '22" (55.9 cm x 22.9 cm) Polished aluminum');
    assert.equal(D.displayOptionName("Underhood Sight Shield, LPO"), "Underhood Sight Shield");
    assert.equal(D.displayOptionName("Heated seats"), "Heated seats");
    assert.equal(D.displayOptionName("LPO"), "LPO");
  });
  it("package contents: the bare LPO item split off by the import is dropped", () => {
    assert.deepEqual(D.displayPackageContents(["LPO", "Roof rack cross rails", "LPO", "Front and rear splash guards", 'Wheels, 20" transit steel wheels for LPO 20" wheels and tires']),
      ["Roof rack cross rails", "Front and rear splash guards", 'Wheels, 20" transit steel wheels for LPO 20" wheels and tires']);
  });
});

describe("dealer-installed import rule", () => {
  const pkgs = R.dealerInstalledPackagesFromRows([{ make: "GMC", model: "Terrain", trim: "Elevation", model_year: "2026", package: "Hit the Road Package" }]);
  const row = () => P.parseConfiguratorRow({
    make: "GMC", model: "Terrain", trim: "Elevation", model_year: "2026",
    common_features: "LPO, Roof rack cross rails | Package-only | | Hit the Road Package ;; Splash guards | Package-only | | Hit the Road Package ;; Heated seats | Package-only | | Tech Package ;; LPO, Cargo net | Standalone | $95 ;; Remote start | Standalone | $300",
    package_definitions: "Hit the Road Package | 575 | contents: Roof rack cross rails, Splash guards ;; Tech Package | 900 | contents: Heated seats",
  });
  it("starts false on every parsed option", () => {
    assert.ok(row().options.every((o) => o.dealerInstalled === false));
  });
  it("flags LPO names and every option in a listed package, nothing else", () => {
    const r = row();
    const rep = R.applyDealerInstalledRule([r], pkgs);
    const flagged = Object.fromEntries(r.options.map((o) => [o.name, o.dealerInstalled]));
    assert.deepEqual(flagged, { "LPO, Roof rack cross rails": true, "Splash guards": true, "Heated seats": false, "LPO, Cargo net": true, "Remote start": false });
    assert.deepEqual([rep.byLpoCode, rep.byPackage, rep.unmatchedPackages.length], [2, 1, 0]);
  });
  it("matches trim and package case-insensitively but never across trims or years", () => {
    const other = R.dealerInstalledPackagesFromRows([{ make: "gmc", model: "terrain", trim: "elevation", model_year: "2026", package: "hit the road package" }, { make: "GMC", model: "Terrain", trim: "Denali", model_year: "2026", package: "Hit the Road Package" }, { make: "GMC", model: "Terrain", trim: "Elevation", model_year: "2027", package: "Hit the Road Package" }]);
    const r = row();
    const rep = R.applyDealerInstalledRule([r], other);
    assert.equal(r.options.find((o) => o.name === "Splash guards").dealerInstalled, true);
    assert.deepEqual(rep.unmatchedPackages.map((u) => u.why), ["row_not_imported", "row_not_imported"]);
  });
  it("never flags a paint or interior colour through its package", () => {
    const r = P.parseConfiguratorRow({
      make: "Cadillac", model: "CT5", trim: "Premium Luxury", model_year: "2026",
      exterior_color_options: "Black Raven | Package-only | | Exterior Accent Package",
      common_features: "Rear spoiler | Package-only | | Exterior Accent Package",
      package_definitions: "Exterior Accent Package | 3450 | contents: Rear spoiler",
    });
    R.applyDealerInstalledRule([r], R.dealerInstalledPackagesFromRows([{ make: "Cadillac", model: "CT5", trim: "Premium Luxury", model_year: "2026", package: "Exterior Accent Package" }]));
    assert.deepEqual(Object.fromEntries(r.options.map((o) => [o.name, o.dealerInstalled])), { "Black Raven": false, "Rear spoiler": true });
  });
  it("a listed package no option is sold through is reported as such", () => {
    const rep = R.applyDealerInstalledRule([row()], R.dealerInstalledPackagesFromRows([{ make: "GMC", model: "Terrain", trim: "Elevation", model_year: "2026", package: "Floor Liner Package" }]));
    assert.deepEqual(rep.unmatchedPackages.map((u) => u.why), ["no_option_in_package"]);
  });
  it("doesn't report other makes' packages as unmatched", () => {
    const rep = R.applyDealerInstalledRule([row()], R.dealerInstalledPackagesFromRows([{ make: "Cadillac", model: "CT5", trim: "Luxury", model_year: "2026", package: "Red Accent Package" }]));
    assert.equal(rep.unmatchedPackages.length, 0);
  });
  it("the committed data file parses: 718 GM packages", () => {
    const text = readFileSync(new URL("../data/configurator-dealer-installed-packages-2026-10.csv", import.meta.url), "utf8");
    const lines = text.trim().split("\n").slice(1).map((l) => { const [make, model, trim, model_year, ...rest] = l.split(","); return { make, model, trim, model_year, package: rest.join(",").replace(/^"|"$/g, "") }; });
    assert.equal(R.dealerInstalledPackagesFromRows(lines).length, 718);
  });
});
