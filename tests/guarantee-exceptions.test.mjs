// GX-2: guarantee exceptions, while-inventory-lasts and the terms version.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const R = await import("../src/lib/guarantee-exception-rule.ts");
const list = JSON.parse(fs.readFileSync(new URL("../data/guarantee-exceptions.json", import.meta.url), "utf8"));
const lasts = JSON.parse(fs.readFileSync(new URL("../data/while-inventory-lasts.json", import.meta.url), "utf8"));

describe("guarantee exceptions", () => {
  it("lists exactly Tesla, Rivian, Lucid and Polestar", () => {
    assert.deepEqual(list.map((e) => e.make).sort(), ["Lucid", "Polestar", "Rivian", "Tesla"]);
  });
  it("matches a make whatever its case, returning the list's spelling", () => {
    assert.equal(R.exceptionMake(list, "tesla"), "Tesla");
    assert.equal(R.exceptionMake(list, " POLESTAR "), "Polestar");
    assert.equal(R.exceptionMake(list, "Toyota"), null);
    assert.equal(R.exceptionMake(list, null), null);
  });
  it("gives the guarantee columns for a brand being set", () => {
    assert.deepEqual(R.guaranteeColumnsFor(list, "Rivian"), { guarantee_status: "not_applicable", guarantee_exception_make: "Rivian" });
    assert.deepEqual(R.guaranteeColumnsFor(list, "Honda"), { guarantee_status: "pending", guarantee_exception_make: null });
    assert.deepEqual(R.guaranteeColumnsFor(list, null), { guarantee_status: "pending", guarantee_exception_make: null }); // undecided
  });
});

describe("while inventory lasts", () => {
  it("covers every Polestar, and only the 2026 Rivian R1T and R1S", () => {
    assert.ok(R.whileInventoryLastsEntry(lasts, "Polestar", "4", 2026));
    assert.ok(R.whileInventoryLastsEntry(lasts, "Polestar", "3", 2027));
    assert.ok(R.whileInventoryLastsEntry(lasts, "Rivian", "R1T", 2026));
    assert.ok(R.whileInventoryLastsEntry(lasts, "rivian", "r1s", 2026));
    assert.equal(R.whileInventoryLastsEntry(lasts, "Rivian", "R1T", 2027), null);
    assert.equal(R.whileInventoryLastsEntry(lasts, "Rivian", "R2", 2027), null);
    assert.equal(R.whileInventoryLastsEntry(lasts, "Tesla", "Model 3", 2026), null);
  });
});

describe("terms version", () => {
  it("only the current version counts as accepted", () => {
    assert.equal(R.hasCurrentTerms({ terms_version: R.TERMS_VERSION }), true);
    assert.equal(R.hasCurrentTerms({ terms_version: "older" }), false);
    assert.equal(R.hasCurrentTerms({ terms_version: null }), false);
    assert.equal(R.hasCurrentTerms(null), false);
  });
});
