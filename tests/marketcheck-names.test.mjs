// Tests for the Wave 2 and 3 MarketCheck name check (2026-10-16): the model
// sync rules (src/lib/marketcheck-models.ts) and the per-make trim rules in
// the matcher (src/lib/configurator-matching.ts). Names are MarketCheck's own,
// from one model+trim facet call per make. No database, no network.
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

const MM = await import("../src/lib/marketcheck-models.ts");
const CM = await import("../src/lib/configurator-matching.ts");

const cand = (make, model, trim, fuelType = "Gas", modelYear = 2027) => ({ id: `${model}|${trim}|${fuelType}`, make, model, trim, modelYear, fuelType });
const match = (cands, trim, powertrains = ["GAS"], year = 2027) => {
  const o = CM.matchConfiguratorTrim(cands, { trim, year, powertrains });
  return o.matched ? cands.find((c) => c.id === o.configuratorTrimId).trim : o.reason;
};
const listing = (trim, extra = {}) => ({ vin: "X", price: null, msrp: null, build: { trim, ...extra } });

describe("model names MarketCheck spells differently", () => {
  it("renames and unions", () => {
    for (const [make, model, mc] of [
      ["Audi", "RS3", ["RS 3"]], ["Audi", "RS6 Avant", ["RS 6 Avant"]], ["Audi", "RS7", ["RS 7"]], ["Audi", "RS e-tron GT", ["RS e-tron GT Performance"]],
      ["BMW", "M2", ["M2 Coupe"]], ["BMW", "M3", ["M3 Sedan"]], ["BMW", "M4", ["M4 Coupe"]],
      ["Lexus", "ES", ["ES Hybrid", "ES BEV"]], ["Lexus", "RX", ["RX", "RX Hybrid", "RX PHEV"]], ["Lexus", "UX", ["UX Hybrid"]],
      ["Mercedes-Benz", "C-Class", ["C-Class Sedan"]], ["Mercedes-Benz", "AMG GT", ["AMG GT Coupe"]],
      ["Mini", "Cooper 2 Door", ["Hardtop 2 Door", "3 Door"]], ["MINI", "Cooper Convertible", ["Convertible"]],
      ["Mitsubishi", "Outlander PHEV", ["Outlander Plug-in Hybrid"]],
    ]) assert.deepEqual(MM.marketCheckModelRule(make, model)?.mcModels, mc, `${make} ${model}`);
  });

  it("splits one MarketCheck model by a name it shows", () => {
    const keep = (make, model, l) => MM.marketCheckModelRule(make, model).keep(l);
    assert.ok(keep("Volkswagen", "Jetta GLI", listing("GLI Autobahn")) && !keep("Volkswagen", "Jetta", listing("GLI Autobahn")));
    assert.ok(keep("Volkswagen", "Jetta", listing("SE")) && !keep("Volkswagen", "Jetta GLI", listing("SE")));
    assert.ok(keep("Lincoln", "Navigator L", listing("Reserve L")) && !keep("Lincoln", "Navigator", listing("Reserve L")));
    assert.ok(keep("BMW", "M5 Touring", listing("M5 Touring")) && keep("BMW", "M5", listing("M5")) && !keep("BMW", "M5", listing("M5 Touring")));
    assert.ok(keep("BMW", "ALPINA XB7", listing("ALPINA XB7")) && !keep("BMW", "X7", listing("ALPINA XB7")));
    assert.ok(keep("Genesis", "Electrified GV70", listing("Base", { powertrain_type: "BEV" })) && !keep("Genesis", "GV70", listing("Base", { powertrain_type: "BEV" })));
  });

  it("leaves out models only the body type could separate", () => {
    for (const [make, model] of [["BMW", "2 Series Gran Coupe"], ["BMW", "4 Series Convertible"], ["GMC", "Hummer EV Pickup"], ["Volvo", "EX30 Cross Country"]])
      assert.equal(MM.marketCheckModelRule(make, model), null);
  });
});

describe("trim names MarketCheck writes differently", () => {
  it("Acura and Volkswagen: 'w/', 'with', 'Package' and 'Tech'", () => {
    const rdx = [cand("Acura", "RDX", "Technology"), cand("Acura", "RDX", "A-Spec Advance"), cand("Acura", "RDX", "A-Spec"), cand("Acura", "RDX", "Advance")];
    assert.equal(match(rdx, "Technology Package"), "Technology");
    assert.equal(match(rdx, "A-spec w/Advance Package"), "A-Spec Advance");
    assert.equal(match(rdx, "A-Spec Package"), "A-Spec");
    const integra = [cand("Acura", "Integra", "A-Spec with Technology Package"), cand("Acura", "Integra", "A-Spec")];
    assert.equal(match(integra, "A-Spec with Tech Package"), "A-Spec with Technology Package");
    assert.equal(match([cand("Volkswagen", "Atlas", "SE w/Technology"), cand("Volkswagen", "Atlas", "SE")], "SE w/Tech"), "SE w/Technology");
  });

  it("Mercedes-Benz: '4MATIC' dropped and spacing ignored", () => {
    const e = [cand("Mercedes-Benz", "E-Class", "E 350"), cand("Mercedes-Benz", "E-Class", "E 450 4MATIC"), cand("Mercedes-Benz", "E-Class", "E 450 4MATIC All-Terrain")];
    assert.equal(match(e, "E350"), "E 350");
    assert.equal(match(e, "E450"), "E 450 4MATIC");
    assert.equal(match(e, "E450 All-Terrain"), "E 450 4MATIC All-Terrain");
  });

  it("BMW: drivetrain words dropped; a name both drivetrains share is refused", () => {
    const x1 = [cand("BMW", "X1", "xDrive28i"), cand("BMW", "X1", "M35i xDrive")];
    assert.equal(match(x1, "28i"), "xDrive28i");
    const x5 = [cand("BMW", "X5", "40 xDrive"), cand("BMW", "X5", "40 sDrive")];
    assert.equal(match(x5, "40"), "ambiguous_trim");
  });

  it("Lexus: AWD/FWD dropped, and the engine number when MarketCheck leaves it off; the powertrain picks the row", () => {
    const es = [cand("Lexus", "ES", "500e Premium", "EV"), cand("Lexus", "ES", "500e Luxury", "EV")];
    assert.equal(match(es, "500e Premium AWD", ["EV"]), "500e Premium");
    const is = [cand("Lexus", "IS", "350 F SPORT"), cand("Lexus", "IS", "350 F SPORT Special Appearance Package")];
    assert.equal(match(is, "F Sport"), "350 F SPORT");
    const nx = [cand("Lexus", "NX", "350 Luxury"), cand("Lexus", "NX", "350h Luxury", "Hybrid")];
    assert.equal(match(nx, "Luxury", ["HYBRID"]), "350h Luxury");
    assert.equal(match(nx, "Luxury", ["GAS"]), "350 Luxury");
  });

  it("Genesis: engine dropped, E-SC means E-Supercharger, and two engines with one name are refused", () => {
    const gv80c = [cand("Genesis", "GV80 Coupe", "3.5T Advanced"), cand("Genesis", "GV80 Coupe", "3.5T E-Supercharger Prestige"), cand("Genesis", "GV80 Coupe", "3.5T E-Supercharger Prestige Black")];
    assert.equal(match(gv80c, "E-SC Prestige Black"), "3.5T E-Supercharger Prestige Black");
    assert.equal(match(gv80c, "Advanced"), "3.5T Advanced");
    const gv80 = [cand("Genesis", "GV80", "2.5T Prestige"), cand("Genesis", "GV80", "3.5T Prestige")];
    assert.equal(match(gv80, "Prestige"), "ambiguous_trim");
  });

  it("Volvo, Dodge, Cadillac, Lincoln", () => {
    // The engine is dropped only when no research trim has the plain name.
    const xc90 = [cand("Volvo", "XC90", "T8 Core", "PHEV"), cand("Volvo", "XC90", "Plus")];
    assert.equal(match(xc90, "Core", ["PHEV"]), "T8 Core");
    // Where a gas row has the plain name, a plug-in listing is refused, not guessed.
    const xc60 = [cand("Volvo", "XC60", "Plus"), cand("Volvo", "XC60", "T8 Plus", "PHEV")];
    assert.equal(match(xc60, "Plus", ["GAS"]), "Plus");
    assert.equal(match(xc60, "Plus", ["PHEV"]), "ambiguous_trim");
    assert.equal(match([cand("Volvo", "XC40", "Black Edition"), cand("Volvo", "XC40", "Plus")], "Ultra Black Edition"), "Black Edition");
    assert.equal(match([cand("Dodge", "Durango", "GT HEMI Plus"), cand("Dodge", "Durango", "GT HEMI")], "GT HEMI Plus V8"), "GT HEMI Plus");
    assert.equal(match([cand("Cadillac", "Escalade", "V"), cand("Cadillac", "Escalade", "Base")], "V-Series"), "V");
    assert.equal(match([cand("Cadillac", "Escalade", "V"), cand("Cadillac", "Escalade", "Base")], "Escalade"), "Base");
    assert.equal(match([cand("Lincoln", "Navigator L", "Reserve"), cand("Lincoln", "Navigator L", "Black Label")], "Reserve L"), "Reserve");
  });

  it("Mazda keeps its own rule, unchanged", () => {
    const cx5 = [cand("Mazda", "CX-5", "2.5 S Preferred"), cand("Mazda", "CX-5", "2.5 S Premium Plus")];
    assert.equal(match(cx5, "S Preferred"), "2.5 S Preferred");
    assert.equal(match(cx5, "Premium Plus Package"), "2.5 S Premium Plus");
  });
});
