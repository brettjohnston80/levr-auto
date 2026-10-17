// Truck cab and bed display (option C, Brett, 2026-10-16).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
// configurator-matching.ts imports "./cab-bed" without an extension (as the app's bundler allows).
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return nextResolve(specifier, context);
  },
});
const C = await import("../src/lib/cab-bed.ts");
const CM = await import("../src/lib/configurator-matching.ts");

describe("cab and bed build lines", () => {
  it("GMC: cab and bed, drive, then engine and transmission", () => {
    assert.equal(C.formatCabBedLine("Crew Cab, Short Bed, 4WD, 5.3L EcoTec3 V8 engine, 10-speed automatic transmission"), "Crew Cab, Short Bed · 4WD · 5.3L V8, 10-speed automatic");
    assert.equal(C.formatCabBedLine("Crew Cab, Standard Bed, 4WD, 3.0L Duramax Turbo Diesel engine, 10-speed automatic transmission with Electronic Precision shift and front bucket seats"),
      "Crew Cab, Standard Bed · 4WD · 3.0L Duramax diesel, 10-speed automatic, Electronic Precision shift and front bucket seats");
    assert.equal(C.formatCabBedLine("Crew Cab, Standard Bed, 2WD, 6.6L Duramax Turbo-Diesel V8 engine, 10-speed automatic transmission with integrated Power Take-Off (PTO)"),
      "Crew Cab, Standard Bed · 2WD · 6.6L Duramax diesel V8, 10-speed automatic, integrated Power Take-Off (PTO)");
  });
  it("Ram: cab and box, then drive", () => {
    assert.equal(C.formatCabBedLine('Quad Cab / 4x2 (RWD) / 6\'4" Box'), 'Quad Cab, 6\'4" Box · RWD');
    assert.equal(C.formatCabBedLine('Crew Cab / 4x4 / 5\'7" Box'), 'Crew Cab, 5\'7" Box · 4WD');
    assert.equal(C.formatCabBedLine("Crew Cab / 4x4 / 8' Box"), "Crew Cab, 8' Box · 4WD");
  });
  it("Nissan, Ram without a box, and the Sierra EV's battery-first lines", () => {
    assert.equal(C.formatCabBedLine("King Cab, 4x2 (RWD)"), "King Cab · RWD");
    assert.equal(C.formatCabBedLine("Crew Cab Long Bed, 4x4"), "Crew Cab, Long Bed · 4WD");
    assert.equal(C.formatCabBedLine("Crew Cab / 4x4"), "Crew Cab · 4WD");
    assert.equal(C.formatCabBedLine("Max Range battery, Crew Cab, Short Bed, 4WD"), "Crew Cab, Short Bed · 4WD · Max Range battery");
  });
  it("leaves every other line, and any line it can't read, unchanged", () => {
    for (const n of ["3.6L V6 24V VVT eTorque Engine with Stop/Start", "8-Speed Automatic 850RE Transmission", "AWD", "Crew Cab / something odd", "Crew Cab, Short Bed", "Long Range battery"])
      assert.equal(C.formatCabBedLine(n), n);
    assert.equal(C.drivetrainHeading(["AWD", "3.6L V6"]), "Drivetrain");
    assert.equal(C.drivetrainHeading(["Quad Cab / 4x2 (RWD) / 6'4\" Box", "3.6L V6"]), "Cab, bed & powertrain");
  });
  it("Highlights: '{N} builds, from {lowest} to {highest}'", () => {
    const l = (name, availability, priceCents) => ({ name, availability, priceCents });
    assert.equal(C.buildsSummary([l("Quad Cab / 4x2 (RWD) / 6'4\" Box", "standard", 0), l("Crew Cab / 4x4 / 6'4\" Box", "standalone", 929000), l("3.6L V6", "standard", 0)]), "2 builds, from Standard to +$9,290");
    assert.equal(C.buildsSummary([l("Crew Cab / 4x4 / 8' Box", "standard", 0)]), "1 build, Standard");
    assert.equal(C.buildsSummary([l("Crew Cab, Short Bed, 4WD, 6.2L EcoTec3 V8 engine", "standalone", null)]), "1 build");
    assert.equal(C.buildsSummary([l("AWD", "standard", 0)]), null);
  });
  it("a package named like a build is never shown as a feature; its items come with that build", () => {
    const f = (name, packageName) => ({ name, availability: packageName ? "package_only" : "standalone", priceCents: null, priceIsIncluded: false, packageName, packagePriceCents: null, packageContents: [] });
    const build = "Crew Cab, Standard Bed, 4WD, 6.6L Duramax Turbo-Diesel V8 engine, 10-speed automatic transmission";
    const out = CM.groupIntoPackages([f("Winter Grille Cover", build), f("Exhaust brake", build), f("Engine block heater", null), f("Heated seats", "Convenience Package"), f("Heated wheel", "Convenience Package")]);
    assert.deepEqual(out.map((c) => c.name), ["Engine block heater", "Convenience Package"]);
  });
});

describe("credit prices (Brett, 2026-10-17)", async () => {
  const P = await import("../src/lib/option-price.ts");
  const l = (name, availability, priceCents) => ({ name, availability, priceCents, priceIsIncluded: false });
  it("a credit reads with a true minus sign, never +$-", () => {
    assert.equal(P.formatOptionPrice(-300000), "−$3,000");
    assert.equal(P.formatOptionPrice(-299500), "−$2,995");
    assert.equal(P.formatOptionPrice(185000), "+$1,850");
    assert.equal(P.formatUsd(-50000), "−$500");
    assert.equal(P.formatUsd(61000), "$610");
  });
  it("a build list running from a credit to a cost", () => {
    assert.equal(C.buildsSummary([l("Crew Cab, Short Bed, 4WD, 3.0L Duramax Turbo Diesel engine", "standalone", -150000), l("Crew Cab, Standard Bed, 4WD, 6.2L EcoTec3 V8 engine", "standalone", 250000)]),
      "2 builds, from −$1,500 to +$2,500");
  });
});
