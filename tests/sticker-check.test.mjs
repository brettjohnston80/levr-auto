// Sticker (Total SRP) checks on Log Offer, and the withdrawn-offer rule (Brett, 2026-10-17).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
const S = await import("../src/lib/sticker-check.ts");
const G = await import("../src/lib/guarantee.ts");

const camryLE = { trim: "LE", lowCents: 3_089_500, highCents: 3_372_000 }; // $30,895 to $33,720

describe("linked listing", () => {
  it("is quiet when the typed sticker matches the listing to within $100", () => {
    assert.deepEqual(S.stickerWarnings(3_400_000, 3_409_000, null), []);
  });
  it("warns, showing both numbers, when it differs by more than $100", () => {
    const [w] = S.stickerWarnings(3_650_000, 3_406_500, null);
    assert.equal(w.kind, "listing");
    assert.match(w.message, /\$36,500/);
    assert.match(w.message, /\$34,065/);
  });
});

describe("our data's range", () => {
  it("is quiet inside the range, and inside the tolerances", () => {
    assert.deepEqual(S.stickerWarnings(3_200_000, null, camryLE), []);
    assert.deepEqual(S.stickerWarnings(3_089_500 - 50_000, null, camryLE), []); // $500 below: allowed
    assert.deepEqual(S.stickerWarnings(3_372_000 + 505_800, null, camryLE), []); // 15% of $33,720 = $5,058 above: allowed
  });
  it("warns below base + destination by more than $500", () => {
    const [w] = S.stickerWarnings(2_950_000, null, camryLE);
    assert.equal(w.kind, "below_range");
    assert.match(w.message, /\$29,500/);
    assert.match(w.message, /\$30,895/);
  });
  it("warns well above the top of the range (a dealer addendum, say)", () => {
    const [w] = S.stickerWarnings(3_900_000, null, camryLE);
    assert.equal(w.kind, "above_range");
    assert.match(w.message, /\$39,000/);
    assert.match(w.message, /\$30,895–\$33,720/);
  });
  it("uses the greater of $5,000 or 15% above a cheap trim", () => {
    const cheap = { trim: "LX", lowCents: 2_000_000, highCents: 2_000_000 };
    assert.deepEqual(S.stickerWarnings(2_000_000 + 499_900, null, cheap), []);
    assert.equal(S.stickerWarnings(2_000_000 + 500_100, null, cheap)[0].kind, "above_range");
  });
  it("can warn on both the listing and our data", () => {
    assert.deepEqual(S.stickerWarnings(3_900_000, 3_300_000, camryLE).map((w) => w.kind), ["listing", "above_range"]);
  });
  it("still flags a bad listing value that the typed sticker matches (the $438,800 Telluride)", () => {
    // VIN 5XYPDES12VG039194: MarketCheck msrp $438,800; our 2027 X-Line SX is $56,035 with destination.
    const telluride = { trim: "X-Line SX", lowCents: 5_603_500, highCents: 5_603_500 };
    const w = S.stickerWarnings(43_880_000, 43_880_000, S.findStickerRange([telluride], "X-Line SX"));
    assert.deepEqual(w.map((x) => x.kind), ["above_range"]);
    assert.match(w[0].message, /\$438,800/);
    assert.match(w[0].message, /\$56,035/);
  });
  it("says nothing with no sticker typed", () => {
    assert.deepEqual(S.stickerWarnings(null, 3_300_000, camryLE), []);
  });
});

describe("finding the trim's range", () => {
  it("matches on the trim name, ignoring case and punctuation", () => {
    assert.equal(S.findStickerRange([camryLE, { trim: "XSE", lowCents: 1, highCents: 2 }], " le ").trim, "LE");
    assert.equal(S.findStickerRange([{ trim: "Sport-L", lowCents: 1, highCents: 2 }], "sport l").trim, "Sport-L");
  });
  it("returns nothing for a blank or unknown trim", () => {
    assert.equal(S.findStickerRange([camryLE], ""), null);
    assert.equal(S.findStickerRange([camryLE], "Nightshade"), null);
  });
});

describe("most factory options a trim can add", () => {
  const o = (category, priceCents, extra = {}) => ({ category, availability: "standalone", priceCents, packageName: null, packagePriceCents: null, dealerInstalled: false, ...extra });
  it("takes the dearest paint and interior, every package once and standalone features", () => {
    const opts = [
      o("exterior_color", 0, { availability: "standard" }), o("exterior_color", 47_500), o("exterior_color", 42_500),
      o("interior", 0, { availability: "standard" }),
      o("feature", null, { availability: "package_only", packageName: "Cold Weather", packagePriceCents: 61_000 }),
      o("feature", null, { availability: "package_only", packageName: "Cold Weather", packagePriceCents: 61_000 }),
      o("feature", 87_000),
    ];
    assert.equal(S.maxFactoryOptionsCents(opts), 47_500 + 61_000 + 87_000);
  });
  it("ignores dealer-installed, unavailable, standard and unpriced items", () => {
    const opts = [o("feature", 39_900, { dealerInstalled: true }), o("feature", 50_000, { availability: "unavailable" }), o("feature", 10_000, { availability: "standard" }), o("feature", null)];
    assert.equal(S.maxFactoryOptionsCents(opts), 0);
  });
});

describe("withdrawn offers and the guarantee (Brett, 2026-10-17: kept as is)", () => {
  it("a delivered below-sticker offer counts, whether or not it was later withdrawn", () => {
    const offer = { isBelowMsrp: true, deliveredAt: "2026-10-01T12:00:00Z", customerRespondedAt: null, vehicleSoldAt: null };
    assert.equal(G.evaluateOfferGuaranteeContribution(offer), "counts");
    assert.equal(G.evaluateOfferGuaranteeContribution({ ...offer, withdrawnAt: "2026-10-01T13:00:00Z" }), "counts");
  });
});
