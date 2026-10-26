// AI offer parser: destination is never an add-on (Brett, 2026-10-17).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
const N = await import("../src/lib/offer-parse-normalize.ts");

describe("destination charge names", () => {
  it("recognizes the manufacturers' names for it", () => {
    for (const d of ["Destination", "Destination charge", "Dest. chg", "Destination Freight Charge", "Freight Charges",
      "Delivery, Processing and Handling Fee", "Destination & Handling", "D&H", "DPH"]) {
      assert.equal(N.isDestinationCharge(d), true, d);
    }
  });
  it("leaves real dealer fees and add-ons alone", () => {
    for (const d of ["Doc fee", "Documentation fee", "Nitrogen tire fill", "Paint protection", "Dealer delivery to your home",
      "Window tint", "Electronic filing fee"]) {
      assert.equal(N.isDestinationCharge(d), false, d);
    }
  });
});

describe("toParsedOffer", () => {
  it("adds the parser's destination field to the price and keeps it out of add-ons", () => {
    const p = N.toParsedOffer({ offer_price_dollars: 28000, destination_dollars: 1095, addons: [{ description: "Doc fee", amount_dollars: 399 }] });
    assert.equal(p.offerPriceCents, 2909500);
    assert.equal(p.destinationCents, 109500);
    assert.deepEqual(p.addons, [{ description: "Doc fee", amountCents: 39900 }]);
  });
  it("moves a destination line the parser put in addons into the price", () => {
    const p = N.toParsedOffer({ offer_price_dollars: 28000, addons: [{ description: "Destination & Handling", amount_dollars: 1095 }, { description: "Doc fee", amount_dollars: 399 }] });
    assert.equal(p.offerPriceCents, 2909500);
    assert.equal(p.destinationCents, 109500);
    assert.deepEqual(p.addons.map((a) => a.description), ["Doc fee"]);
  });
  it("counts destination once when it's in both the field and addons", () => {
    const p = N.toParsedOffer({ offer_price_dollars: 28000, destination_dollars: 1095, addons: [{ description: "Destination", amount_dollars: 1095 }] });
    assert.equal(p.offerPriceCents, 2909500);
    assert.deepEqual(p.addons, []);
  });
  it("with no stated price, still keeps destination out of add-ons and reports it", () => {
    const p = N.toParsedOffer({ offer_price_dollars: null, addons: [{ description: "Freight", amount_dollars: 1195 }] });
    assert.equal(p.offerPriceCents, null);
    assert.equal(p.destinationCents, 119500);
    assert.deepEqual(p.addons, []);
  });
  it("is unchanged when no destination is listed", () => {
    const p = N.toParsedOffer({ dealer_name: " Sunrise Toyota ", offer_price_dollars: 31200.5, addons: [{ description: "Paint protection", amount_dollars: 799 }, { description: "", amount_dollars: 5 }, { description: "Zero", amount_dollars: 0 }] });
    assert.equal(p.dealerName, "Sunrise Toyota");
    assert.equal(p.offerPriceCents, 3120050);
    assert.equal(p.destinationCents, 0);
    assert.deepEqual(p.addons, [{ description: "Paint protection", amountCents: 79900 }]);
  });
});

describe("Log Offer refuses a typed destination add-on", () => {
  it("refuses any line naming destination, with the approved message", () => {
    for (const d of ["Destination", "destination & handling", "Freight", "D&H", "DPH", "Dest. charge"]) {
      assert.equal(N.destinationAddonRefusal(["Doc fee", d]), "Destination is already included in Total SRP. Add it to the offer price instead.", d);
    }
  });
  it("allows ordinary add-ons and an empty list", () => {
    assert.equal(N.destinationAddonRefusal(["Doc fee", "Nitrogen tire fill", "Dealer delivery to your home"]), null);
    assert.equal(N.destinationAddonRefusal([]), null);
  });
});
