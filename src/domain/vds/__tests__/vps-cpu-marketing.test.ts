import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultVpsMarketingCpuLabel,
  isVpsMarketingCpuKey,
  resolveVpsMarketingCpuLabel,
  VPS_MARKETING_CPU_DEFAULT,
  VPS_MARKETING_CPU_OPTIONS,
} from "../vps-cpu-marketing.js";

describe("vps-cpu-marketing", () => {
  it("defaults key and default label helper", () => {
    assert.equal(VPS_MARKETING_CPU_DEFAULT, "xeon-e5-2699v4");
    assert.equal(defaultVpsMarketingCpuLabel(), "Xeon E5-2699v4");
  });

  it("returns null when key missing or unknown", () => {
    assert.equal(resolveVpsMarketingCpuLabel(null), null);
    assert.equal(resolveVpsMarketingCpuLabel(undefined), null);
    assert.equal(resolveVpsMarketingCpuLabel("nope"), null);
  });

  it("resolves EPYC and Xeon labels", () => {
    assert.equal(isVpsMarketingCpuKey("epyc-7551p"), true);
    assert.equal(resolveVpsMarketingCpuLabel("epyc-7551p"), "AMD EPYC 7551P");
    assert.equal(resolveVpsMarketingCpuLabel("xeon-e5-2699v4"), "Xeon E5-2699v4");
  });

  it("has exactly two options with one default", () => {
    assert.equal(VPS_MARKETING_CPU_OPTIONS.length, 2);
    assert.equal(VPS_MARKETING_CPU_OPTIONS.filter((o) => o.isDefault).length, 1);
  });
});
