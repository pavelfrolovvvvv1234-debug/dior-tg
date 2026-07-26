import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getStandardVpsSellPriceUsd,
  getVpsCatalogBasePrice,
  hostvdsMarkupFraction,
} from "../standard-vps-pricing.js";

describe("standard-vps-pricing", () => {
  it("markup tiers on HostVDS EUR cost only", () => {
    // 0–2€ → +120%, 2–4€ → +100%, 4–10€ → +70%, 10+€ → +50%
    assert.equal(hostvdsMarkupFraction(0.99), 1.2);
    assert.equal(hostvdsMarkupFraction(1.99), 1.2);
    assert.equal(hostvdsMarkupFraction(2), 1.0);
    assert.equal(hostvdsMarkupFraction(3.99), 1.0);
    assert.equal(hostvdsMarkupFraction(4), 0.7);
    assert.equal(hostvdsMarkupFraction(9.99), 0.7);
    assert.equal(hostvdsMarkupFraction(10), 0.5);
    assert.equal(hostvdsMarkupFraction(119.99), 0.5);
  });

  it("sell = EUR base × markup tier (unique ascending, standard only)", () => {
    // bases: 2,4,8,14,24,30,60,120,180,240
    // 2→×2.0=4; 4→×1.7=7; 8→×1.7=14; 14+→×1.5
    const sells = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) =>
      getStandardVpsSellPriceUsd(id, 0)
    );
    assert.deepEqual(sells, [4, 7, 14, 21, 36, 45, 90, 180, 270, 360]);
    const unique = new Set(sells);
    assert.equal(unique.size, sells.length, "no duplicate sell prices");
    for (let i = 1; i < sells.length; i++) {
      assert.ok(sells[i]! > sells[i - 1]!, `rate ${i} must cost more than ${i - 1}`);
    }
  });

  it("markup applies ONLY to standard VPS — bulletproof uses prices.json as-is", () => {
    const rate = { price: { default: 999, bulletproof: 65 } };
    assert.equal(getVpsCatalogBasePrice(rate, { bulletproof: true, rateId: 3 }), 65);
    assert.equal(getVpsCatalogBasePrice(rate, { bulletproof: false, rateId: 3 }), 21);
    assert.notEqual(
      getVpsCatalogBasePrice(rate, { bulletproof: true, rateId: 3 }),
      getVpsCatalogBasePrice(rate, { bulletproof: false, rateId: 3 })
    );
  });
});
