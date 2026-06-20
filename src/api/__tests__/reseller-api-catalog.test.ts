import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveServiceStatus,
  listResellerBillingAddons,
  mapService,
  RESELLER_API_ERROR_CODES,
  RESELLER_WEBHOOK_EVENTS,
} from "../reseller-api-catalog.js";
import { mergeServiceIpv4Addresses, isPlaceholderIpv4 } from "../reseller-api-vm-ops.js";
import type VirtualDedicatedServer from "../../entities/VirtualDedicatedServer.js";

function baseVds(overrides: Partial<VirtualDedicatedServer> = {}): VirtualDedicatedServer {
  return {
    id: 1,
    vdsId: 101,
    login: "root",
    password: "secret",
    ipv4Addr: "203.0.113.10",
    cpuCount: 2,
    networkSpeed: 1000,
    isBulletproof: true,
    payDayAt: null,
    ramSize: 4,
    diskSize: 50,
    lastOsId: 900,
    rateName: "Lite 1",
    expireAt: new Date("2026-12-01T00:00:00.000Z"),
    targetUserId: 5,
    renewalPrice: 22.5,
    displayName: "client-1",
    bundleType: null,
    resellerId: "r_test",
    resellerClientId: "ext-1",
    autoRenewEnabled: true,
    adminBlocked: false,
    managementLocked: false,
    extraIpv4Count: 0,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    lastUpdateAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  } as VirtualDedicatedServer;
}

describe("mergeServiceIpv4Addresses", () => {
  it("dedupes primary and hypervisor IPs", () => {
    const merged = mergeServiceIpv4Addresses("203.0.113.10", [
      "203.0.113.10",
      "203.0.113.44",
      "0.0.0.0",
    ]);
    assert.deepEqual(merged, ["203.0.113.10", "203.0.113.44"]);
  });

  it("treats placeholder IPs as empty", () => {
    assert.equal(isPlaceholderIpv4("0.0.0.0"), true);
    assert.deepEqual(mergeServiceIpv4Addresses("0.0.0.0", ["203.0.113.44"]), ["203.0.113.44"]);
  });
});

describe("deriveServiceStatus", () => {
  it("maps hypervisor running to online", () => {
    assert.equal(deriveServiceStatus(baseVds(), "running"), "online");
  });

  it("maps management lock to suspended", () => {
    assert.equal(deriveServiceStatus(baseVds({ managementLocked: true }), "running"), "suspended");
  });
});

describe("mapService", () => {
  it("includes full ipv4 list and billing addons", () => {
    const item = mapService(baseVds({ extraIpv4Count: 1, lastOsId: 904 }), {
      ipv4Addresses: ["203.0.113.10", "203.0.113.44"],
      vmInfo: { state: "running" } as never,
    });
    assert.deepEqual(item.ipv4, ["203.0.113.10", "203.0.113.44"]);
    assert.equal(item.login, "Admin");
    assert.equal(item.billing.addons.extraIpv4.count, 1);
    assert.equal(item.billing.addons.extraIpv4.canPurchase, false);
    assert.equal(item.capabilities.ipv6.supported, false);
  });

  it("embeds traffic counters when metrics are present", () => {
    const item = mapService(baseVds(), {
      metrics: {
        networkInBytes: 100,
        networkOutBytes: 200,
        sampledAt: "2026-06-03T00:00:00.000Z",
      },
    });
    assert.equal(item.traffic.networkInBytes, 100);
    assert.equal(item.traffic.networkOutBytes, 200);
    assert.equal(item.traffic.countersAvailable, true);
  });
});

describe("catalog constants", () => {
  it("documents extra IPv4 and webhook events", () => {
    assert.ok(RESELLER_API_ERROR_CODES.includes("extra_ipv4_limit_reached"));
    assert.ok(RESELLER_WEBHOOK_EVENTS.includes("service_extra_ipv4_added"));
    assert.equal(listResellerBillingAddons().extraIpv4.maxPerService, 1);
  });
});
