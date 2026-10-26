// Offer entry chunk 2: pricing, warnings and the VIN check (offer-entry plan 4.A, 4.B, 4.C).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
const P = await import("../src/lib/offer-pricing.ts");
const W = await import("../src/lib/offer-warnings.ts");
const V = await import("../src/lib/vin-check.ts");
const G = await import("../src/lib/guarantee.ts");

// Built on the plan's worked example (4.C): sticker $30,895, price $28,100, doc fee $399,
// sales tax $1,850, title & registration $244, plus a $199 add-on.
const camry = {
  stickerCents: 3_089_500,
  priceCents: 2_810_000,
  addons: [{ amountCents: 19_900 }],
  fees: [
    { kind: "doc_fee", amountCents: 39_900 },
    { kind: "sales_tax", amountCents: 185_000 },
    { kind: "title_registration", amountCents: 24_400 },
  ],
};

describe("discount", () => {
  it("is sticker minus price, in cents", () => {
    assert.equal(P.discountCents(3_089_500, 2_810_000), 279_500);
  });
  it("is negative when the price is above the sticker", () => {
    assert.equal(P.discountCents(3_000_000, 3_050_000), -50_000);
  });
  it("rounds the percent to a whole point ($2,795 off $30,895 is 9%)", () => {
    assert.equal(P.discountPercent(3_089_500, 2_810_000), 9);
    assert.equal(P.discountPercent(1_000_000, 905_000), 10); // 9.5% rounds up
    assert.equal(P.discountPercent(1_000_000, 906_000), 9); // 9.4% rounds down
  });
  it("has no percent without a positive sticker", () => {
    assert.equal(P.discountPercent(0, 100), null);
  });
});

describe("out-the-door sum", () => {
  it("adds the price, add-ons and every fee", () => {
    assert.equal(P.outTheDoorSumCents(camry), 2_810_000 + 19_900 + 39_900 + 185_000 + 24_400);
  });
  it("leaves out sales tax paid at registration", () => {
    const fees = camry.fees.map((f) => (f.kind === "sales_tax" ? { ...f, paidAtRegistration: true } : f));
    assert.equal(P.outTheDoorSumCents({ ...camry, fees }), 2_810_000 + 19_900 + 39_900 + 24_400);
  });
  it("only skips tax: a doc fee flagged by mistake still counts", () => {
    const fees = [{ kind: "doc_fee", amountCents: 39_900, paidAtRegistration: true }];
    assert.equal(P.outTheDoorSumCents({ priceCents: 100, addons: [], fees }), 40_000);
  });
  it("is the price alone with no add-ons and no fees", () => {
    assert.equal(P.outTheDoorSumCents({ priceCents: 2_810_000, addons: [], fees: [] }), 2_810_000);
  });
});

describe("arithmetic check ($1 tolerance)", () => {
  const sum = 2_810_000 + 19_900 + 39_900 + 185_000 + 24_400;
  it("accepts an exact total", () => {
    assert.deepEqual(P.checkOutTheDoorTotal(camry, sum), { ok: true, sumCents: sum, differenceCents: 0 });
  });
  it("accepts a total $1 off either way", () => {
    assert.equal(P.checkOutTheDoorTotal(camry, sum + 100).ok, true);
    assert.equal(P.checkOutTheDoorTotal(camry, sum - 100).ok, true);
  });
  it("refuses a total $1.01 off, and reports the difference", () => {
    const r = P.checkOutTheDoorTotal(camry, sum + 101);
    assert.equal(r.ok, false);
    assert.equal(r.differenceCents, 101);
  });
  it("catches a forgotten line (the common failure)", () => {
    const r = P.checkOutTheDoorTotal(camry, sum - 24_400);
    assert.equal(r.ok, false);
    assert.equal(r.differenceCents, -24_400);
  });
});

describe("guarantee price test", () => {
  it("is price below the car's sticker, nothing else", () => {
    assert.equal(P.priceBelowSticker(3_089_500, 2_810_000), true);
    assert.equal(P.priceBelowSticker(3_089_500, 3_089_500), false);
    assert.equal(P.priceBelowSticker(3_089_500, 3_089_501), false);
  });
  it("ignores add-ons and fees: $28,100 vs $30,895 with $5,000 of fees still counts (plan 3.5 test 11)", () => {
    const heavy = { ...camry, fees: [...camry.fees, { kind: "other", amountCents: 500_000 }] };
    assert.ok(P.outTheDoorSumCents(heavy) > heavy.stickerCents);
    assert.equal(P.priceBelowSticker(heavy.stickerCents, heavy.priceCents), true);
  });
  it("feeds the unchanged Day-30 rule the same way is_below_msrp does", () => {
    const isBelowMsrp = P.priceBelowSticker(camry.stickerCents, camry.priceCents);
    const verdict = G.evaluateOfferGuaranteeContribution({
      isBelowMsrp,
      deliveredAt: "2026-10-01T00:00:00Z",
      customerRespondedAt: null,
      vehicleSoldAt: null,
    });
    assert.equal(verdict, "counts");
  });
});

describe("amount bounds", () => {
  it("passes the worked example", () => {
    assert.deepEqual(P.amountProblems(camry), []);
  });
  it("refuses a zero sticker or price, a zero add-on, a negative fee, and anything over $250,000", () => {
    const problems = P.amountProblems({
      stickerCents: 0,
      priceCents: 25_000_001,
      addons: [{ amountCents: 0 }],
      fees: [{ kind: "doc_fee", amountCents: -1 }, { kind: "sales_tax", amountCents: 0 }],
    });
    assert.deepEqual(problems, [
      { field: "sticker", problem: "not_positive" },
      { field: "price", problem: "too_large" },
      { field: "addon", index: 0, problem: "not_positive" },
      { field: "fee", index: 0, problem: "negative" },
    ]);
  });
  it("allows exactly $250,000 and a $0 fee", () => {
    assert.deepEqual(
      P.amountProblems({ stickerCents: 25_000_000, priceCents: 1, addons: [], fees: [{ kind: "doc_fee", amountCents: 0 }] }),
      []
    );
  });
  it("refuses fractional cents", () => {
    assert.deepEqual(P.amountProblems({ stickerCents: 100.5, priceCents: 100, addons: [], fees: [] }), [
      { field: "sticker", problem: "not_whole_cents" },
    ]);
  });
});

describe("VIN check", () => {
  it("accepts VINs with a correct check digit, including X", () => {
    assert.deepEqual(V.checkVin("1HGCM82633A004352"), { ok: true, vin: "1HGCM82633A004352" });
    assert.equal(V.checkVin("1M8GDM9AXKP042788").ok, true); // check digit X
    assert.equal(V.checkVin("11111111111111111").ok, true);
  });
  it("tidies pasted VINs: lower case, spaces and dashes", () => {
    assert.deepEqual(V.checkVin(" 1hgcm8-2633a 004352 "), { ok: true, vin: "1HGCM82633A004352" });
  });
  it("refuses a wrong check digit", () => {
    assert.deepEqual(V.checkVin("1HGCM82643A004352"), { ok: false, vin: "1HGCM82643A004352", problem: "check_digit" });
  });
  it("refuses a single mistyped character elsewhere", () => {
    assert.equal(V.checkVin("1HGCM82633A004353").problem, "check_digit");
  });
  it("refuses the wrong length and I, O or Q", () => {
    assert.equal(V.checkVin("1HGCM82633A00435").problem, "length");
    assert.equal(V.checkVin("1HGCM82633A00435O").problem, "characters");
    assert.equal(V.checkVin("IHGCM82633A004352").problem, "characters");
  });
});

describe("send warnings", () => {
  const base = {
    stickerCents: 3_089_500,
    priceCents: 2_810_000,
    vin: "1HGCM82633A004352",
    dealerAliasId: "alias-1",
    dealerName: "Sunrise Toyota",
    searchStatus: "searching",
  };
  const other = (o) => ({ id: "o1", vin: null, dealerAliasId: "alias-2", dealerName: "Lakeside Toyota", status: "pending", createdAt: "2026-10-20T00:00:00Z", ...o });

  it("raises nothing for a clean offer", () => {
    assert.deepEqual(W.offerWarnings(base, [other()]), []);
  });
  it("warns above or at the sticker", () => {
    assert.deepEqual(W.offerWarnings({ ...base, priceCents: 3_089_500 }, []), [
      { code: "above_sticker", priceCents: 3_089_500, stickerCents: 3_089_500 },
    ]);
  });
  it("warns on the same VIN, however it was typed, unless that offer was withdrawn", () => {
    const dup = other({ vin: "1hgcm82633a004352", dealerName: "Lakeside Toyota" });
    assert.deepEqual(W.offerWarnings(base, [dup]), [
      { code: "duplicate_vin", dealerName: "Lakeside Toyota", createdAt: "2026-10-20T00:00:00Z" },
    ]);
    assert.deepEqual(W.offerWarnings(base, [{ ...dup, status: "withdrawn" }]), []);
  });
  it("still warns on a VIN from a declined offer", () => {
    assert.equal(W.offerWarnings(base, [other({ vin: base.vin, status: "customer_declined" })])[0].code, "duplicate_vin");
  });
  it("warns when the same dealer has an open offer, by dealer id, else by name", () => {
    assert.equal(W.offerWarnings(base, [other({ dealerAliasId: "alias-1", dealerName: "Different spelling" })])[0].code, "duplicate_dealer");
    assert.equal(
      W.offerWarnings({ ...base, dealerAliasId: null }, [other({ dealerAliasId: null, dealerName: " sunrise toyota " })])[0].code,
      "duplicate_dealer"
    );
  });
  it("doesn't count a declined or withdrawn offer from that dealer as open", () => {
    assert.deepEqual(W.offerWarnings(base, [other({ dealerAliasId: "alias-1", status: "customer_declined" })]), []);
    assert.deepEqual(W.offerWarnings(base, [other({ dealerAliasId: "alias-1", status: "withdrawn" })]), []);
  });
  it("trusts dealer ids over names when both offers have one", () => {
    assert.deepEqual(W.offerWarnings(base, [other({ dealerAliasId: "alias-9", dealerName: "Sunrise Toyota" })]), []);
  });
  it("warns when the search isn't searching", () => {
    for (const s of ["purchased", "cancelled", "switched", "paused"]) {
      assert.deepEqual(W.offerWarnings({ ...base, searchStatus: s }, []), [{ code: "inactive_search", searchStatus: s }]);
    }
  });
  it("lists every warning together, and send needs each one ticked", () => {
    const all = W.offerWarnings(
      { ...base, priceCents: 3_100_000, searchStatus: "paused" },
      [other({ vin: base.vin, dealerAliasId: "alias-1" })]
    );
    assert.deepEqual(all.map((w) => w.code), ["above_sticker", "duplicate_vin", "duplicate_dealer", "inactive_search"]);
    assert.deepEqual(W.unconfirmedWarnings(all, ["above_sticker", "inactive_search"]), ["duplicate_vin", "duplicate_dealer"]);
    assert.deepEqual(W.unconfirmedWarnings(all, [...W.WARNING_CODES]), []);
  });
  it("uses exactly the codes the database allows", () => {
    assert.deepEqual([...W.WARNING_CODES], ["above_sticker", "duplicate_vin", "duplicate_dealer", "inactive_search"]);
  });
});
