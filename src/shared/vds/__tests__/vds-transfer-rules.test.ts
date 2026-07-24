import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  denyVdsUserTransfer,
  isDemoVdsForTransfer,
  vdsTransferDenialFluentKey,
} from "../vds-transfer-rules.js";

const baseVds = {
  targetUserId: 10,
  vdsId: 230,
  rateName: "Lite 3",
  managementLocked: false,
  adminBlocked: false,
  resellerId: null as number | string | null,
};

describe("denyVdsUserTransfer", () => {
  it("allows valid transfer", () => {
    assert.equal(
      denyVdsUserTransfer({
        vds: baseVds,
        fromUserId: 10,
        toUserId: 20,
        targetBanned: false,
      }),
      null
    );
  });

  it("rejects self transfer", () => {
    assert.equal(
      denyVdsUserTransfer({ vds: baseVds, fromUserId: 10, toUserId: 10 }),
      "self"
    );
  });

  it("rejects non-owner", () => {
    assert.equal(
      denyVdsUserTransfer({ vds: baseVds, fromUserId: 99, toUserId: 20 }),
      "not_owner"
    );
  });

  it("rejects locked and blocked", () => {
    assert.equal(
      denyVdsUserTransfer({
        vds: { ...baseVds, managementLocked: true },
        fromUserId: 10,
        toUserId: 20,
      }),
      "locked"
    );
    assert.equal(
      denyVdsUserTransfer({
        vds: { ...baseVds, adminBlocked: true },
        fromUserId: 10,
        toUserId: 20,
      }),
      "blocked"
    );
  });

  it("rejects demo and reseller", () => {
    assert.equal(
      denyVdsUserTransfer({
        vds: { ...baseVds, vdsId: 0 },
        fromUserId: 10,
        toUserId: 20,
      }),
      "demo"
    );
    assert.equal(
      denyVdsUserTransfer({
        vds: { ...baseVds, resellerId: "res-1" },
        fromUserId: 10,
        toUserId: 20,
      }),
      "reseller"
    );
  });

  it("rejects banned target", () => {
    assert.equal(
      denyVdsUserTransfer({
        vds: baseVds,
        fromUserId: 10,
        toUserId: 20,
        targetBanned: true,
      }),
      "target_banned"
    );
  });
});

describe("isDemoVdsForTransfer", () => {
  it("detects demo by vmid or rate name", () => {
    assert.equal(isDemoVdsForTransfer({ vdsId: 0, rateName: "Lite" }), true);
    assert.equal(isDemoVdsForTransfer({ vdsId: 10, rateName: "Demo Lite" }), true);
    assert.equal(isDemoVdsForTransfer({ vdsId: 10, rateName: "Lite 3" }), false);
  });
});

describe("vdsTransferDenialFluentKey", () => {
  it("maps codes to fluent keys", () => {
    assert.equal(vdsTransferDenialFluentKey("self"), "vds-transfer-self");
    assert.equal(vdsTransferDenialFluentKey("locked"), "vds-transfer-denied-locked");
  });
});
