import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAdminHostTransferInput,
  tryParseAdminVpsServiceBlock,
} from "../parse-managed-service-input.js";

describe("tryParseAdminVpsServiceBlock", () => {
  it("parses multiline admin paste", () => {
    const block = tryParseAdminVpsServiceBlock(`@thejavasea
ID vm: 230
Tarif: Mega 1
Ip: 45.74.7.131`);
    assert.ok(block);
    assert.equal(block!.username, "thejavasea");
    assert.equal(block!.vmid, 230);
    assert.equal(block!.plan, "Mega 1");
    assert.equal(block!.ip, "45.74.7.131");
  });
});

describe("parseAdminHostTransferInput", () => {
  it("fills price and expiry from plan catalog for block input", () => {
    const parsed = parseAdminHostTransferInput(`@user
ID vm: 230
Tarif: Mega 1
Ip: 45.74.7.131`);
    assert.equal(parsed.hostId, "230");
    assert.equal(parsed.plan, "Mega 1");
    assert.equal(parsed.ip, "45.74.7.131");
    assert.equal(parsed.price, 159);
    assert.ok(parsed.expiresAt.getTime() > Date.now());
  });
});
