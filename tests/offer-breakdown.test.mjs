// "How the price adds up" rows (offer entry Chunk 4; plan 4.C, wording 6.3/6.4).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
const B = await import("../src/lib/offer-breakdown.ts");

// The plan's example: $30,895 sticker, $28,100 price, $149 add-on, $399 doc, $1,850 tax, $244 title.
const ex = {
  stickerCents: 3_089_500, priceCents: 2_810_000,
  addons: [{ description: "nitrogen fill", amountCents: 14_900, dealerSaysRemovable: true }],
  fees: [{ kind: "doc_fee", amountCents: 39_900 }, { kind: "sales_tax", amountCents: 185_000 }, { kind: "title_registration", amountCents: 24_400 }],
  deliveryCents: null,
  otd: { totalCents: 3_074_200, source: "dealer_quote" },
};

describe("breakdown rows", () => {
  it("follows the plan's order and labels", () => {
    assert.deepEqual(B.breakdownRows(ex).map((r) => r.label), [
      "Window sticker", "Discount", "Car price", "Dealer add-ons", "Doc fee", "Sales tax", "Title & registration", "Out-the-door",
    ]);
  });
  it("signs the discount negative with a whole percent ($2,795, 9%)", () => {
    const d = B.breakdownRows(ex).find((r) => r.kind === "discount");
    assert.equal(d.amountCents, -279_500);
    assert.equal(d.percent, 9);
  });
  it("scales bars to the sticker", () => {
    const rows = B.breakdownRows(ex);
    assert.equal(rows[0].barFraction, 1);
    assert.equal(rows.find((r) => r.kind === "price").barFraction, 2_810_000 / 3_089_500);
  });
  it("leaves out empty sections, the discount when there is none, and out-the-door when not recorded", () => {
    const rows = B.breakdownRows({ stickerCents: 100_000, priceCents: 100_000, addons: [], fees: [], deliveryCents: null, otd: null });
    assert.deepEqual(rows.map((r) => r.kind), ["sticker", "price"]);
  });
  it("shows no discount row when the price is above the sticker", () => {
    const rows = B.breakdownRows({ ...ex, priceCents: 3_099_500, otd: null });
    assert.ok(!rows.some((r) => r.kind === "discount"));
  });
  it("adds other fees into one row, and a delivery estimate when there is one", () => {
    const rows = B.breakdownRows({ ...ex, fees: [{ kind: "other", label: "Order fee", amountCents: 25_000 }, { kind: "other", label: "Tire fee", amountCents: 500 }], deliveryCents: 0 });
    assert.equal(rows.find((r) => r.kind === "other_fees").amountCents, 25_500);
    assert.ok(rows.some((r) => r.kind === "delivery" && r.amountCents === 0));
  });
  it("gives the approved note for each removable add-on", () => {
    assert.deepEqual(B.removableAddonNotes(ex), ["Don't want the nitrogen fill? The dealer will remove it. Just tell your agent."]);
  });
});

describe("delivery in the breakdown (Brett, 2026-10-29)", () => {
  it("shows Out-the-door, then the estimate, then Out-the-door with delivery", () => {
    const rows = B.breakdownRows({ ...ex, deliveryCents: 50_000 });
    assert.deepEqual(rows.slice(-3).map((r) => [r.kind, r.amountCents]), [["otd", 3_074_200], ["delivery", 50_000], ["otd_with_delivery", 3_124_200]]);
  });
  it("without an out-the-door figure, just the estimate", () => {
    const rows = B.breakdownRows({ ...ex, otd: null, deliveryCents: 50_000 });
    assert.equal(rows.at(-1).kind, "delivery");
    assert.equal(rows.some((r) => r.kind === "otd_with_delivery"), false);
  });
});

