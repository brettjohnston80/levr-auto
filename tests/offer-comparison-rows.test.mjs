// Offer entry chunk 10: the comparison rows, the "Lowest out-the-door" badge and the
// out-the-door sort (plan 4.C, wording 6.3).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
const C = await import("../src/lib/offer-comparison-rows.ts");

const offer = (o = {}) => ({
  id: "a", status: "pending", offerPriceCents: 2_810_000, msrpCents: 3_089_500,
  vehicleExteriorColor: "Ice Cap", vehicleInteriorColor: "Black SofTex", sentToCustomerAt: "2026-10-27T00:00:00Z",
  goodUntil: "2026-11-05", otd: { totalCents: 3_074_200, source: "dealer_quote" },
  addons: [{ description: "Nitrogen fill", amountCents: 14_900, dealerSaysRemovable: true }],
  fees: [{ kind: "doc_fee", amountCents: 39_900 }, { kind: "sales_tax", amountCents: 185_000 }, { kind: "title_registration", amountCents: 24_400 }],
  options: [
    { name: "Cold Weather Package", customerAskedFor: true, onTheCar: true },
    { name: "Moonroof", customerAskedFor: true, onTheCar: false },
    { name: "Mudguards", customerAskedFor: false, onTheCar: true },
  ],
  totalPriceCents: 2_810_000, takesDelivery: false, deliveryEstimateCents: null, deliveryPending: false, ...o,
});
const picks = { exterior: ["Ice Cap"], interior: ["Cockpit Red"] };

describe("rows", () => {
  const rows = C.comparisonRows([offer(), offer({ id: "b", otd: null, sentToCustomerAt: null, goodUntil: null, addons: [], fees: [], options: [], offerPriceCents: 3_100_000 })], picks);
  const get = (k) => rows.find((r) => r.key === k).cells;
  it("are in the approved order", () => {
    assert.deepEqual(rows.map((r) => r.label), ["Exterior", "Interior", "Options you want", "Also on the car", "Window sticker", "Discount", "Car price",
      "Dealer add-ons", "Doc fee", "Sales tax", "Title & registration", "Out-the-door", "Figures from", "Good until"]);
  });
  it("mark the customer's colours ✓ and others \"not your pick\"", () => {
    assert.deepEqual(get("exterior")[0], { lines: ["Ice Cap ✓"], tone: "good" });
    assert.deepEqual(get("interior")[0], { lines: ["Black SofTex", "not your pick"], tone: "muted" });
  });
  it("show no mark when the customer ranked no colours", () => {
    assert.deepEqual(C.comparisonRows([offer()], { exterior: [], interior: [] })[0].cells[0], { lines: ["Ice Cap"], tone: "plain" });
  });
  it("count the options asked for and list the extras", () => {
    assert.deepEqual(get("options")[0].lines, ["1 of 2"]);
    assert.deepEqual(get("also")[0].lines, ["Mudguards"]);
    assert.deepEqual(get("options")[1].lines, ["—"]);
  });
  it("show the discount only below the sticker, with the percent", () => {
    assert.deepEqual(get("discount")[0].lines, ["−$2,795 (9%)"]);
    assert.deepEqual(get("discount")[1].lines, ["—"]);
  });
  it("list add-ons with \"can be removed\" and sum each fee kind", () => {
    assert.deepEqual(get("addons")[0].lines, ["Nitrogen fill $149 · can be removed"]);
    assert.deepEqual(get("doc_fee")[0].lines, ["$399"]);
    assert.deepEqual(get("title_registration")[1].lines, ["—"]);
  });
  it("say where the out-the-door came from, or Requested on a sent offer without one", () => {
    assert.deepEqual(get("otd")[0].lines, ["$30,742"]);
    assert.deepEqual(get("figures_from")[0].lines, ["Dealer's quote"]);
    assert.deepEqual(get("figures_from")[1].lines, ["—"]);
    const req = C.comparisonRows([offer({ otd: null })], picks).find((r) => r.key === "figures_from").cells[0];
    assert.deepEqual(req.lines, ["Requested"]);
    const est = C.comparisonRows([offer({ otd: { totalCents: 1, source: "estimate" } })], picks).find((r) => r.key === "figures_from").cells[0];
    assert.deepEqual(est.lines, ["Our estimate"]);
  });
  it("show good until as a short date", () => {
    assert.deepEqual(get("good_until")[0].lines, ["Nov 5"]);
  });
});

describe("Lowest out-the-door badge", () => {
  it("needs at least two open offers with an out-the-door figure", () => {
    assert.equal(C.lowestOtdOfferId([offer()]), null);
    assert.equal(C.lowestOtdOfferId([offer(), offer({ id: "b", otd: null })]), null);
    assert.equal(C.lowestOtdOfferId([offer(), offer({ id: "b", status: "customer_declined", otd: { totalCents: 1, source: "dealer_quote" } })]), null);
  });
  it("goes to the lowest figure, quotes and estimates alike", () => {
    assert.equal(C.lowestOtdOfferId([offer(), offer({ id: "b", otd: { totalCents: 3_000_000, source: "estimate" } })]), "b");
  });
  it("skips an offer still waiting on a delivery estimate", () => {
    assert.equal(C.lowestOtdOfferId([offer(), offer({ id: "b", otd: { totalCents: 3_000_000, source: "dealer_quote" }, deliveryPending: true })]), "a");
  });
  it("breaks a tie by price + delivery", () => {
    assert.equal(C.lowestOtdOfferId([offer({ totalPriceCents: 2_900_000 }), offer({ id: "b", totalPriceCents: 2_800_000 })]), "b");
  });
});

describe("Best total price sort and column order", () => {
  it("puts offers with an out-the-door first, lowest first, then the rest by price + delivery", () => {
    const list = [
      offer({ id: "noOtdCheap", otd: null, totalPriceCents: 1_000_000 }),
      offer({ id: "high", otd: { totalCents: 3_200_000, source: "dealer_quote" } }),
      offer({ id: "low", otd: { totalCents: 3_100_000, source: "estimate" } }),
      offer({ id: "noOtdPending", otd: null, totalPriceCents: 900_000, deliveryPending: true }),
    ];
    assert.deepEqual([...list].sort(C.compareByOtd).map((o) => o.id), ["low", "high", "noOtdCheap", "noOtdPending"]);
  });
  it("pins the badge's offer first in the comparison and leaves out closed offers", () => {
    const list = [offer({ id: "x" }), offer({ id: "y", otd: { totalCents: 100, source: "dealer_quote" } }), offer({ id: "z", status: "withdrawn" })];
    assert.deepEqual(C.comparisonOrder(list).map((o) => o.id), ["y", "x"]);
  });
});

describe("delivery (Brett, 2026-10-29)", () => {
  // A: $30,742 out-the-door, picked up. B: $30,393 out-the-door but $500 delivery = $30,893.
  const pickup = offer({ id: "pickup" });
  const deliv = offer({ id: "deliv", otd: { totalCents: 3_039_300, source: "dealer_quote" }, takesDelivery: true, deliveryEstimateCents: 50_000 });
  it("compares out-the-door + delivery for an offer taken by delivery, out-the-door alone within range", () => {
    assert.equal(C.comparedTotalCents(pickup), 3_074_200);
    assert.equal(C.comparedTotalCents(deliv), 3_089_300);
    assert.equal(C.comparedTotalCents(offer({ deliveryEstimateCents: 50_000 })), 3_074_200); // estimate, but picked up
  });
  it("gives the badge to the lower compared total", () => {
    assert.equal(C.lowestOtdOfferId([pickup, deliv]), "pickup");
    assert.equal(C.lowestOtdOfferId([pickup, { ...deliv, deliveryEstimateCents: 0 }]), "deliv");
  });
  it("an offer by delivery still waiting on its estimate can't get the badge", () => {
    const waiting = { ...deliv, deliveryEstimateCents: null, deliveryPending: true, otd: { totalCents: 100, source: "dealer_quote" } };
    assert.equal(C.lowestOtdOfferId([pickup, waiting]), "pickup");
  });
  it("sorts by the compared total", () => {
    assert.deepEqual([deliv, pickup].sort(C.compareByOtd).map((o) => o.id), ["pickup", "deliv"]);
  });
  it("shows the estimate and the delivery total as rows when an offer comes by delivery", () => {
    const rows = C.comparisonRows([pickup, deliv], picks);
    const get = (k) => rows.find((r) => r.key === k)?.cells.map((c) => c.lines[0]);
    assert.deepEqual(get("delivery"), ["—", "+$500"]);
    assert.deepEqual(get("otd_with_delivery"), ["—", "$30,893"]);
    assert.equal(rows.find((r) => r.key === "otd_with_delivery").label, "Out-the-door with delivery");
    assert.equal(C.comparisonRows([pickup], picks).some((r) => r.key === "delivery"), false);
    const pend = C.comparisonRows([{ ...deliv, deliveryEstimateCents: null, deliveryPending: true }], picks);
    assert.deepEqual(pend.find((r) => r.key === "delivery").cells[0].lines, ["Requested"]);
  });
});
