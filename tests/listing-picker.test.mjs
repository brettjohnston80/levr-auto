// Offer entry chunk 6: the Log Offer listing picker's filter and sort (plan 5.0 step 2).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
const P = await import("../src/lib/listing-picker.ts");

const L = (id, o) => ({ id, trim: "SE", year: 2026, priceCents: 2_900_000, miles: 10, ...o });
const list = [
  L("far", { miles: 120 }),
  L("near", { miles: 4 }),
  L("noMiles", { miles: null }),
  L("xse", { trim: "XSE", miles: 2 }),
  L("old", { year: 2025, miles: 1 }),
  L("nearCheap", { miles: 4, priceCents: 2_800_000 }),
];

describe("listing picker", () => {
  it("keeps the committed year and the customer's trims, nearest first, then cheapest", () => {
    assert.deepEqual(P.pickerListings(list, { modelYear: 2026, customerTrims: ["se"], allTrims: false }).map((l) => l.id),
      ["nearCheap", "near", "far", "noMiles"]);
  });
  it("All trims shows the other trims too", () => {
    assert.deepEqual(P.pickerListings(list, { modelYear: 2026, customerTrims: ["SE"], allTrims: true }).map((l) => l.id),
      ["xse", "nearCheap", "near", "far", "noMiles"]);
  });
  it("with no ranked trims, shows every trim", () => {
    assert.equal(P.pickerListings(list, { modelYear: 2026, customerTrims: [], allTrims: false }).length, 5);
  });
  it("marks colours against the customer's picks", () => {
    assert.equal(P.colourMatch("Ice Cap", ["ice cap"]), "match");
    assert.equal(P.colourMatch("Midnight Black Metallic", ["Ice Cap"]), "not_pick");
    assert.equal(P.colourMatch(null, ["Ice Cap"]), null);
    assert.equal(P.colourMatch("Ice Cap", []), null);
  });
  it("shows the last 8 of the VIN", () => {
    assert.equal(P.vinLast8("1HGCM82633A004352"), "…3A004352");
  });
});
