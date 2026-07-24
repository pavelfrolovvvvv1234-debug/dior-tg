import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLocationSelectable,
  isPlanSelectable,
  loadHostVdsCatalog,
  resolveLocationStatus,
  resolvePlanAtLocationStatus,
  resolvePlanGlobalStatus,
} from "../hostvds-catalog.js";

describe("hostvds-catalog", () => {
  it("loads bundled locations with stock statuses", () => {
    const c = loadHostVdsCatalog(true);
    assert.ok(c.locations.length >= 5);
    assert.equal(resolveLocationStatus("lv-riga-2"), "available");
    assert.equal(resolveLocationStatus("us-silicon-valley"), "sold_out");
    assert.equal(resolveLocationStatus("hk-hongkong"), "unavailable");
  });

  it("plan at location inherits location status", () => {
    assert.equal(resolvePlanAtLocationStatus("lv-riga-2", 0), "available");
    assert.equal(isLocationSelectable("lv-riga-2", 0), true);
    assert.equal(isLocationSelectable("us-silicon-valley", 0), false);
  });

  it("plan is selectable if any location has stock", () => {
    assert.equal(resolvePlanGlobalStatus(0), "available");
    assert.equal(isPlanSelectable(0), true);
  });
});
