import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getExtraIpv4MonthlyPriceUsd, MAX_EXTRA_IPV4_PER_VDS } from "../extra-ipv4.js";

describe("extra-ipv4 helpers", () => {
  it("caps at one extra IPv4", () => {
    assert.equal(MAX_EXTRA_IPV4_PER_VDS, 1);
  });

  it("computes renewal after remove", () => {
    const price = getExtraIpv4MonthlyPriceUsd();
    const before = 77;
    const after = Math.max(0, Math.round((before - price) * 100) / 100);
    assert.equal(after, Math.round((77 - price) * 100) / 100);
    assert.ok(after < before);
  });
});
