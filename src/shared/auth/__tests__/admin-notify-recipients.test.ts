import { describe, it } from "node:test";
import assert from "node:assert";
import { uniquePositiveTelegramIds } from "../admin-notify-recipients.js";

describe("admin notify recipients", () => {
  it("dedupes and drops invalid telegram ids", () => {
    assert.deepStrictEqual(
      uniquePositiveTelegramIds([100, 100, 0, -1, NaN, 200.5, 300]),
      [100, 300]
    );
  });
});
