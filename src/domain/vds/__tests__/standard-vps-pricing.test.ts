import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getStandardVpsSellPriceUsd,
  hostvdsMarkupFraction,
} from "../standard-vps-pricing.js";

describe("standard-vps-pricing", () => {
  it("markup tiers", () => {
    assert.equal(hostvdsMarkupFraction(0.99), 1.2);
    assert.equal(hostvdsMarkupFraction(1.99), 1.2);
    assert.equal(hostvdsMarkupFraction(2), 1.0);
    assert.equal(hostvdsMarkupFraction(3.99), 1.0);
    assert.equal(hostvdsMarkupFraction(4), 0.7);
    assert.equal(hostvdsMarkupFraction(9.99), 0.7);
    assert.equal(hostvdsMarkupFraction(10), 0.5);
    assert.equal(hostvdsMarkupFraction(119.99), 0.5);
  });

  it("sell prices are unique ascending ladder (EUR→USD rate 1)", () => {
    const sells = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) =>
      getStandardVpsSellPriceUsd(id, 0)
    );
    assert.deepEqual(sells, [2, 4, 8, 14, 24, 30, 60, 120, 180, 240]);
    const unique = new Set(sells);
    assert.equal(unique.size, sells.length, "no duplicate sell prices");
    for (let i = 1; i < sells.length; i++) {
      assert.ok(sells[i]! > sells[i - 1]!, `rate ${i} must cost more than ${i - 1}`);
    }
  });
});
