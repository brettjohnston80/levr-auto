// BAE #1 (2026-10-30): where sign-in and "Continue your search" go.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
const D = await import("../src/lib/search-destination.ts");

const s = (o) => ({ id: "s1", searchStatus: "searching", paidAt: "2026-10-01T00:00:00Z", make: "Toyota", model: "Camry", ...o });

describe("search destination", () => {
  it("saved, not paid: Review your search", () => {
    assert.equal(D.searchDestination([s({ searchStatus: "awaiting_finalization", paidAt: null })]), "/account/vehicle?searchId=s1");
  });
  it("paid, trim and options not chosen: finalize", () => {
    assert.equal(D.searchDestination([s({ searchStatus: "awaiting_finalization" })]), "/finalize/s1");
  });
  it("paid without a vehicle yet: the dashboard (the agent helps choose)", () => {
    assert.equal(D.searchDestination([s({ searchStatus: "awaiting_finalization", make: null, model: null })]), "/account");
  });
  it("in the 24-hour window: Your Car", () => {
    assert.equal(D.searchDestination([s({ searchStatus: "pending_refinement" })]), "/account/vehicle?searchId=s1");
  });
  for (const st of ["searching", "paused", "purchased"]) {
    it(`${st}: Your Deal`, () => assert.equal(D.searchDestination([s({ searchStatus: st })]), "/account/deal?searchId=s1"));
  }
  it("no search, or only cancelled or switched ones: Get started", () => {
    assert.equal(D.searchDestination([]), "/#get-started");
    assert.equal(D.searchDestination([s({ searchStatus: "cancelled" }), s({ id: "s2", searchStatus: "switched" })]), "/#get-started");
  });
  it("the latest active search wins (oldest first in)", () => {
    const list = [s({ id: "old", searchStatus: "purchased" }), s({ id: "new", searchStatus: "awaiting_finalization", paidAt: null }), s({ id: "gone", searchStatus: "cancelled" })];
    assert.equal(D.searchDestination(list), "/account/vehicle?searchId=new");
    assert.equal(D.latestActiveSearch(list).id, "new");
  });
});
