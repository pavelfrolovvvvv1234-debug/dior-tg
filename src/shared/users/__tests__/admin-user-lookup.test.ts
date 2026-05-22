import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAdminUserLookupQuery,
  isNumericAdminLookupQuery,
} from "../admin-user-lookup.js";

describe("admin user lookup normalize", () => {
  it("strips spaces from numeric telegram id", () => {
    const q = normalizeAdminUserLookupQuery("8 183 990 986");
    assert.equal(q, "8183990986");
    assert.equal(isNumericAdminLookupQuery(q), true);
  });

  it("accepts @username", () => {
    assert.equal(normalizeAdminUserLookupQuery("@e11enx"), "@e11enx");
  });
});
