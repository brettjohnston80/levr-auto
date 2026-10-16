// Tests for the import mapping step (src/lib/configurator-mapping.ts): one
// block per mechanical D2 rule, using real values from the research CSVs.
// Run: npm run test:configurator   (Node's built-in test runner; no database.)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("csv-parse/sync");
const M = await import("../src/lib/configurator-mapping.ts");
const P = await import("../src/lib/configurator-parse.ts");

const read = (file) => parse(fs.readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8"), { columns: true, skip_empty_lines: true, trim: false });
const row = (over) => ({
  make: "Test", model: "Model", trim: "Trim", model_year: "2027", drivetrain: "AWD", fuel_type: "Gas", body_style: "SUV",
  exterior_color_options: "", interior_color_material_options: "", wheel_options: "", roof_options: "", seating_configuration: "",
  drivetrain_engine_variants: "", common_features: "", package_definitions: "", sources: "", discrepancy_notes: "", confidence_notes: "",
  ...over,
});
const names = (cell) => M.splitItems(cell).map((i) => i.name);

describe("rule 4: engine lines in one short format", () => {
  it("rewrites marketing text into size and type, hp, transmission, drivetrain", () => {
    const p = M.readEngineParts("2.0-liter BMW TwinPower Turbo inline 4-cylinder 8-Speed Sport Automatic Transmission xDrive AWD");
    assert.equal(M.formatEngine(p), "2.0L turbo I4, 8-speed automatic, AWD");
    assert.equal(M.formatEngine(M.readEngineParts("2.0L turbo I4 241 hp 7-speed DSG FWD")), "2.0L turbo I4, 241 hp, 7-speed dual-clutch automatic, FWD");
    assert.equal(M.formatEngine(M.readEngineParts("2.5T Inline 4 Turbo GDI, 300 hp, 8-Speed Automatic, RWD")), "2.5L turbo I4, 300 hp, 8-speed automatic, RWD");
    assert.equal(M.formatEngine(M.readEngineParts("Dual motor electric / single-speed / AWD")), "Dual-motor electric, single-speed, AWD");
  });

  it("keeps an EV's battery size (and never reads kW as kWh)", () => {
    assert.equal(M.formatEngine(M.readEngineParts("82 kWh dual-motor 4MOTION AWD 335 hp")), "Dual-motor electric, 82 kWh, 335 hp, AWD");
    assert.equal(M.formatEngine(M.readEngineParts("EV550 118.5kWh Electric - EV 118.5kWh 360/580 m/km 550PS (Automatic)")), "Electric, 118.5 kWh, automatic");
    assert.equal(M.readEngineParts("168kW Rear Electric Motor, 225 hp, RWD, 306-mile EPA range").battery, null);
  });

  it("keeps a twin-scroll turbo as one turbo, a diesel as diesel, and never reads Auto Start-Stop as a transmission", () => {
    assert.equal(M.formatEngine(M.readEngineParts("Rear-Wheel Drive, 2.0L Twin-scroll turbocharged 4-cylinder engine, 10-speed automatic transmission")), "2.0L turbo 4-cylinder, 10-speed automatic, RWD");
    assert.equal(M.formatEngine(M.readEngineParts("4WD, 3.0L Duramax Turbo Diesel engine, 10-speed automatic transmission")), "3.0L turbo diesel, 10-speed automatic, 4WD");
    assert.equal(M.readEngineParts("3.0L twin-turbocharged V6 engine with Auto Start-Stop Technology").transmission, null);
  });

  it("folds a lone standard transmission and the row's own drivetrain into the engine line (Porsche, Lincoln)", () => {
    const r = row({ make: "Porsche", model: "911", trim: "Carrera", drivetrain: "RWD", body_style: "Coupe",
      drivetrain_engine_variants: "8-speed Porsche Doppelkupplung (PDK) | Standard | 0 |  ;; 3.0-Liter Twin-Turbocharged Boxer 6 | Standard | 0 |  ;; Rear-wheel drive | Standard | 0 | " });
    const { rows } = M.mapConfiguratorRows([r]);
    assert.deepEqual(names(rows[0].drivetrain_engine_variants), ["3.0L twin-turbo flat-6, 8-speed dual-clutch automatic, RWD"]);
    const lincoln = row({ make: "Lincoln", model: "Aviator", drivetrain: "RWD/AWD",
      drivetrain_engine_variants: "3.0L twin-turbocharged V6 engine with Auto Start-Stop Technology | Standard | 0 |  ;; Transmission – 10-Speed Automatic Transmission with SelectShift® Capability | Standard | 0 |  ;; Rear-Wheel Drive | Standard | 0 |  ;; All-Wheel Drive | Standalone | 2500 | " });
    assert.deepEqual(names(M.mapConfiguratorRows([lincoln]).rows[0].drivetrain_engine_variants), ["3.0L twin-turbo V6, 10-speed automatic, RWD", "AWD"]);
  });

  it("keeps the availability, price and package of every item byte for byte", () => {
    const r = row({ drivetrain: "FWD/AWD", drivetrain_engine_variants: "FWD, 1.5L Turbo 4-cylinder engine, Continuous Variable Transmission (CVT) | Standard | 0 |  ;; AWD, 1.5L Turbo 4-cylinder engine, 8-speed automatic transmission | Standalone | 2000 | " });
    const cell = M.mapConfiguratorRows([r]).rows[0].drivetrain_engine_variants;
    assert.equal(cell, "1.5L turbo 4-cylinder, CVT, FWD | Standard | 0 |  ;; 1.5L turbo 4-cylinder, 8-speed automatic, AWD | Standalone | 2000 | ");
  });

  it("fills hp, size or cylinders only from the official engine-facts table, never by guessing", () => {
    const text = "B5 AWD Gas (mild hybrid), 247 hp";
    const r = row({ make: "Volvo", model: "XC40", trim: "Ultra", drivetrain_engine_variants: `${text} | Standard | 0 | ` });
    const without = M.mapConfiguratorRows([r]);
    assert.equal(names(without.rows[0].drivetrain_engine_variants)[0], text, "left as is without facts");
    assert.ok(without.report.unmapped.some((n) => n.rule === "4" && n.detail.includes(text)));
    const facts = M.engineFactsFromRows([{ make: "Volvo", model: "XC40", trim: "Ultra", model_year: "2027", engine_option: text, hp: "247", displacement_l: "2.0", cylinders: "I4" }]);
    assert.equal(names(M.mapConfiguratorRows([r], { engineFacts: facts }).rows[0].drivetrain_engine_variants)[0], "2.0L I4 mild hybrid, 247 hp, AWD");
  });

  it("lets the official table name a bare 'N-cylinder' layout", () => {
    const fact = { hp: 395, displacementL: null, cylinders: "I6" };
    assert.equal(M.formatEngine(M.readEngineParts("3.0 Liter 6-Cylinder - Ingenium 3,0 litre 6-cylinder 400PS (294kW) Turbocharged Gas MHEV (Automatic)", fact)), "3.0L turbo I6 mild hybrid, 395 hp, automatic");
    assert.equal(M.formatEngine(M.readEngineParts("3.0 Liter 6-Cylinder - Ingenium 3,0 litre 6-cylinder 400PS (294kW) Turbocharged Gas MHEV (Automatic)")), "3.0L turbo 6-cylinder mild hybrid, automatic");
  });

  it("leaves cab/bed configurations and packages alone and reports them", () => {
    const text = "Crew Cab, Short Box, 2WD, TurboMax engine, 8-speed automatic transmission";
    const { rows, report } = M.mapConfiguratorRows([row({ make: "GMC", drivetrain_engine_variants: `${text} | Standard | 0 | ` })]);
    assert.equal(names(rows[0].drivetrain_engine_variants)[0], text);
    assert.ok(report.unmapped.some((n) => n.detail.includes(text)));
  });
});

describe("rule 6: one body style from the fixed list", () => {
  it("maps case and synonyms", () => {
    assert.deepEqual(M.mapBodyStyle("sedan"), ["Sedan"]);
    assert.deepEqual(M.mapBodyStyle("pickup truck"), ["Truck"]);
    assert.deepEqual(M.mapBodyStyle("SUV Coupe"), ["SUV"]);
    assert.deepEqual(M.mapBodyStyle("Targa"), ["Convertible"]);
    assert.equal(M.mapBodyStyle("Shooting Brake"), null);
  });

  it("splits 'coupe or sedan' into a Coupe row and a Sedan row; the Sedan keeps the +$2,000 four-door price as a standard item", () => {
    const r = row({ make: "Dodge", model: "Charger", trim: "R/T", body_style: "coupe or sedan",
      drivetrain_engine_variants: "2-Door AWD | Standard | 0 |  ;; 4-Door AWD | Standalone | 2000 |  ;; 3.0L Twin Turbo Sixpack SO | Standard | 0 |  ;; 8-Speed Automatic 880RE Transmisson | Standard | 0 | " });
    const { rows, report } = M.mapConfiguratorRows([r]);
    assert.deepEqual(rows.map((x) => x.body_style), ["Coupe", "Sedan"]);
    assert.equal(rows[0].drivetrain_engine_variants, "3.0L twin-turbo, 8-speed automatic, AWD | Standard | 0 | ");
    assert.equal(rows[1].drivetrain_engine_variants, "4-door sedan body | Standard | 2000 |  ;; 3.0L twin-turbo, 8-speed automatic, AWD | Standard | 0 | ");
    assert.deepEqual(report.dropped, []);
    // Through the real parser, the Sedan's body item is standard and still costs $2,000.
    const opt = P.parseConfiguratorRow(rows[1], { blankPriceUnknown: true }).options.find((o) => o.name === "4-door sedan body");
    assert.equal(opt.availability, "standard");
    assert.equal(opt.priceCents, 200000);
  });

  it("leaves an unknown body style unchanged and reports it", () => {
    const { rows, report } = M.mapConfiguratorRows([row({ body_style: "Shooting Brake" })]);
    assert.equal(rows[0].body_style, "Shooting Brake");
    assert.ok(report.unmapped.some((n) => n.rule === "6"));
  });
});

describe("rule 7: one drivetrain per row", () => {
  it("keeps the first, standard drivetrain of a combined value", () => {
    assert.equal(M.mapDrivetrain("FWD/AWD"), "FWD");
    assert.equal(M.mapDrivetrain("2WD/4WD"), "RWD");
    assert.equal(M.mapDrivetrain("RWD; AWD available"), "RWD");
    assert.equal(M.mapDrivetrain("FWD or AWD"), "FWD");
    assert.equal(M.mapDrivetrain("SH-AWD"), "AWD");
    assert.equal(M.mapDrivetrain("4WD"), "4WD");
  });

  it("leaves a blank drivetrain (Mercedes-AMG GT 43, a Cowork check) unchanged and reports it", () => {
    const { rows, report } = M.mapConfiguratorRows([row({ drivetrain: "" })]);
    assert.equal(rows[0].drivetrain, "");
    assert.ok(report.unmapped.some((n) => n.rule === "7"));
  });
});

describe("rule 8: fuel type from the fixed list", () => {
  it("maps spellings", () => {
    assert.deepEqual(M.mapFuelType("Electric"), ["EV"]);
    assert.deepEqual(M.mapFuelType("Plug-in Hybrid"), ["PHEV"]);
    assert.deepEqual(M.mapFuelType("Gas (diesel available)"), ["Gas"]);
    assert.equal(M.mapFuelType("Biodiesel"), null);
  });

  it("splits 'Gas; Hybrid available' into a Gas row and a Hybrid row, each with its own powertrain", () => {
    const r = row({ make: "Lincoln", model: "Nautilus", trim: "Reserve", fuel_type: "Gas; Hybrid available",
      drivetrain_engine_variants: "2.0L Turbocharged I-4 HEV Engine | Standalone | 3000 |  ;; 2.0L I4 - Turbocharged Engine | Standard | 0 |  ;; Eight-Speed Automatic Transmission | Standard | 0 |  ;; CVT Auto Transmission Power Split Electric | Standalone | 0 |  ;; All-Wheel Drive | Standard | 0 | " });
    const { rows } = M.mapConfiguratorRows([r]);
    assert.deepEqual(rows.map((x) => x.fuel_type), ["Gas", "Hybrid"]);
    assert.deepEqual(names(rows[0].drivetrain_engine_variants), ["2.0L turbo I4, 8-speed automatic, AWD"]);
    assert.equal(rows[1].drivetrain_engine_variants, "2.0L turbo I4 hybrid, CVT, AWD | Standard | 3000 | ");
  });
});

describe("rule 9: model names equal our dataset's (D3 merges)", () => {
  it("fixes spelling and merges split models", () => {
    assert.deepEqual(M.mapModel("Audi", "RS 3", "Base"), { model: "RS3", trim: "Base" });
    assert.deepEqual(M.mapModel("GMC", "HUMMER EV SUV", "2X"), { model: "Hummer EV SUV", trim: "2X" });
    assert.deepEqual(M.mapModel("Mercedes-Benz", "CLE Cabriolet", "CLE 300 4MATIC"), { model: "CLE", trim: "CLE 300 4MATIC" });
    assert.deepEqual(M.mapModel("Land Rover", "Defender 110", "X-Dynamic SE"), { model: "Defender", trim: "110 X-Dynamic SE" });
    assert.equal(M.mapModel("Toyota", "Camry", "LE"), null);
  });

  it("keeps a coupe-shaped SUV distinct after the merge (' Coupe' trim suffix approved by Brett 2026-10-16)", () => {
    assert.deepEqual(M.mapModel("Porsche", "Cayenne Coupe", "S"), { model: "Cayenne", trim: "S Coupe" });
    assert.deepEqual(M.mapModel("Mercedes-Benz", "GLE Coupe", "GLE 450 4MATIC"), { model: "GLE", trim: "GLE 450 4MATIC Coupe" });
  });

  it("maps the Charger Daytona to our Charger model with 'Daytona' trims (Wave 3 decision C1)", () => {
    assert.deepEqual(M.mapModel("Dodge", "Charger Daytona", "Scat Pack Plus"), { model: "Charger", trim: "Daytona Scat Pack Plus" });
    const dodge = read("dodge-chrysler-alfa-configurator-full-2026-10.csv").filter((r) => r.model === "Charger Daytona");
    const { rows } = M.mapConfiguratorRows(dodge);
    assert.deepEqual([...new Set(rows.map((r) => `${r.model}|${r.trim}|${r.model_year}|${r.fuel_type}`))].sort(), [
      "Charger|Daytona Scat Pack Plus|2026|EV", "Charger|Daytona Scat Pack Plus|2027|EV", "Charger|Daytona Scat Pack|2026|EV",
    ]);
    assert.deepEqual([...new Set(rows.map((r) => r.body_style))].sort(), ["Coupe", "Sedan"]);
  });
});

describe("known corrections (Brett's decisions, 2026-10-16; research files stay as received)", () => {
  const repass = (s) => read(`${s}-configurator-repass-2026-10.csv`);

  it("MINI Countryman SE ALL4: fuel type EV and an electric engine line", () => {
    const rows = repass("bmw-mini").filter((r) => r.model === "Countryman" && r.trim.startsWith("SE ALL4"));
    assert.equal(rows.length, 2);
    for (const r of rows) assert.equal(r.fuel_type, "Gas", "the research file is unchanged");
    const { rows: out, report } = M.mapConfiguratorRows(rows);
    for (const r of out) {
      assert.equal(r.fuel_type, "EV");
      assert.deepEqual(names(r.drivetrain_engine_variants), ["Electric, 308 hp, AWD"]);
    }
    assert.equal(report.corrections.length, 4);
  });

  it("Audi 'performance' is lowercase everywhere", () => {
    const { rows } = M.mapConfiguratorRows(repass("vw-audi"));
    assert.deepEqual(rows.filter((r) => /performance/i.test(r.trim)).map((r) => `${r.model} ${r.trim}`).sort(),
      ["RS Q8 performance", "RS e-tron GT performance", "RS e-tron GT performance", "RS6 Avant performance", "RS7 performance"]);
  });

  it("Cadillac Escalade / ESV 'V-Series' reverts to 'V'; the entry trim stays 'Base'", () => {
    const { rows } = M.mapConfiguratorRows(repass("cadillac-lincoln"));
    const esc = rows.filter((r) => r.model.startsWith("Escalade")).map((r) => r.trim);
    assert.ok(!esc.includes("V-Series"));
    assert.equal(esc.filter((t) => t === "V").length, 4);
    assert.ok(esc.includes("Base"));
  });

  it("never overwrites a value it doesn't expect, and says so", () => {
    const r = row({ make: "MINI", model: "Countryman", trim: "SE ALL4 Iconic", model_year: "2027", fuel_type: "EV",
      drivetrain_engine_variants: "Electric, 313 hp, AWD | Standard |  | " });
    const { rows, report } = M.mapConfiguratorRows([r]);
    assert.equal(rows[0].fuel_type, "EV");
    assert.deepEqual(names(rows[0].drivetrain_engine_variants), ["Electric, 313 hp, AWD"]);
    assert.equal(report.corrections.length, 0);
    assert.equal(report.unmapped.filter((n) => n.rule === "correction").length, 2);
  });
});

describe("the whole step on every Wave 2 and Wave 3 research file", () => {
  const GROUPS = ["vw-audi", "gmc-buick", "cadillac-lincoln", "mercedes", "bmw-mini", "porsche-landrover", "lexus-acura", "genesis-volvo", "dodge-chrysler-alfa", "mitsubishi-polestar-lucid", "maserati", "fiat"];
  const FILES = [...GROUPS.map((s) => `${s}-configurator-full-2026-10.csv`), ...GROUPS.map((s) => `${s}-configurator-repass-2026-10.csv`)];

  for (const file of FILES) {
    it(`${file}: no trim-identity collisions, and the mapped rows still parse cleanly`, () => {
      const { rows, report } = M.mapConfiguratorRows(read(file));
      assert.deepEqual(report.collisions, []);
      for (const r of rows) {
        const parsed = P.parseConfiguratorRow(r, { blankPriceUnknown: true });
        assert.equal(parsed.droppedUnresolvedPackage.length, 0, `${r.make} ${r.model} ${r.trim}: package reference lost`);
        assert.ok(M.BODY_STYLES.includes(r.body_style), `${r.make} ${r.model} ${r.trim}: body "${r.body_style}"`);
        assert.ok(M.FUEL_TYPES.includes(r.fuel_type), `${r.make} ${r.model} ${r.trim}: fuel "${r.fuel_type}"`);
        if (r.drivetrain) assert.ok(["FWD", "RWD", "AWD", "4WD"].includes(r.drivetrain), `${r.make} ${r.model} ${r.trim}: drivetrain "${r.drivetrain}"`);
      }
    });
  }

  it("changes nothing in the Toyota and Honda files' options (the step is opt-in, but must be safe if used)", () => {
    for (const file of ["toyota-configurator-full-2026-09-09.csv", "honda-configurator-full-2026-09-09.csv"]) {
      const before = read(file);
      const { rows } = M.mapConfiguratorRows(before);
      assert.equal(rows.length, before.length);
      rows.forEach((r, i) => {
        for (const col of ["exterior_color_options", "interior_color_material_options", "wheel_options", "roof_options", "seating_configuration", "common_features", "package_definitions"]) {
          assert.equal(r[col], before[i][col]);
        }
      });
    }
  });
});
