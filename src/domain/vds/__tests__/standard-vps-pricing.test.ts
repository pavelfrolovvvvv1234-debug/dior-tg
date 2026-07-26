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

  it("sell prices from default HostVDS costs (EUR→USD rate 1)", () => {
    assert.equal(getStandardVpsSellPriceUsd(0, 4), 2); // 0.99 * 2.2
    assert.equal(getStandardVpsSellPriceUsd(1, 8), 8); // 3.99 * 2
    assert.equal(getStandardVpsSellPriceUsd(2, 10), 8);
    assert.equal(getStandardVpsSellPriceUsd(3, 18), 30); // 19.99 * 1.5
    assert.equal(getStandardVpsSellPriceUsd(4, 35), 60);
    assert.equal(getStandardVpsSellPriceUsd(7, 95), 120);
    assert.equal(getStandardVpsSellPriceUsd(8, 139), 180);
    assert.equal(getStandardVpsSellPriceUsd(9, 179), 180);
  });
});
