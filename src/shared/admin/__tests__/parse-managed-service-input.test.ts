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

  it("parses full block with Group, Price and Data", () => {
    const block = tryParseAdminVpsServiceBlock(`@thejavasea
ID vm: 230
Group: Regular
Tarif: Mega 1
Price: 120
Data: 24.07.26
Ip: 45.74.7.131`);
    assert.ok(block);
    assert.equal(block!.username, "thejavasea");
    assert.equal(block!.vmid, 230);
    assert.equal(block!.group, "Regular");
    assert.equal(block!.plan, "Mega 1");
    assert.equal(block!.price, 120);
    assert.equal(block!.ip, "45.74.7.131");
    assert.ok(block!.expiresAt);
    assert.equal(block!.expiresAt!.getUTCFullYear(), 2026);
    assert.equal(block!.expiresAt!.getUTCMonth(), 6);
    assert.equal(block!.expiresAt!.getUTCDate(), 24);
  });

  it("accepts Abuse group and дата alias", () => {
    const block = tryParseAdminVpsServiceBlock(`ID vm: 100
Group: Abuse
Tarif: Lite 1
дата: 01.01.27
Ip: 1.2.3.4`);
    assert.ok(block);
    assert.equal(block!.group, "Abuse");
    assert.equal(block!.expiresAt!.getUTCFullYear(), 2027);
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
    assert.equal(parsed.group, "Abuse");
    assert.equal(parsed.isBulletproof, true);
    assert.ok(parsed.expiresAt.getTime() > Date.now());
  });

  it("uses Regular group price when Price omitted", () => {
    const parsed = parseAdminHostTransferInput(`@user
ID vm: 230
Group: Regular
Tarif: Mega 1
Data: 15.08.26
Ip: 45.74.7.131`);
    assert.equal(parsed.group, "Regular");
    assert.equal(parsed.isBulletproof, false);
    assert.equal(parsed.expiresAt.getUTCDate(), 15);
    assert.equal(parsed.expiresAt.getUTCMonth(), 7);
    // Mega 1 standard (default) price from catalog
    assert.equal(parsed.price, 59);
  });

  it("keeps explicit Price with Data and Group", () => {
    const parsed = parseAdminHostTransferInput(`@user
ID vm: 230
Group: Abuse
Tarif: Mega 1
Price: 120
Data: 24.07.26
Ip: 45.74.7.131`);
    assert.equal(parsed.price, 120);
    assert.equal(parsed.isBulletproof, true);
    assert.equal(parsed.expiresAt.getUTCFullYear(), 2026);
    assert.equal(parsed.expiresAt.getUTCMonth(), 6);
    assert.equal(parsed.expiresAt.getUTCDate(), 24);
  });
});
