import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIpConfig0,
  parseIpFromIpConfig,
  pickFreeIpv4Candidate,
} from "../ip-allocation.js";

describe("ip-allocation", () => {
  it("parses ip from ipconfig0", () => {
    assert.equal(parseIpFromIpConfig("ip=45.74.7.165/24,gw=45.74.7.1"), "45.74.7.165");
  });

  it("picks first free host in configured range", () => {
    const used = new Set(["45.74.7.100", "45.74.7.101"]);
    const ip = pickFreeIpv4Candidate({
      cidr: "45.74.7.0/24",
      gateway: "45.74.7.1",
      usedIps: used,
      ipStart: 100,
      ipEnd: 110,
    });
    assert.equal(ip, "45.74.7.102");
  });

  it("skips gateway and broadcast", () => {
    const ip = pickFreeIpv4Candidate({
      cidr: "45.74.7.0/24",
      gateway: "45.74.7.1",
      usedIps: new Set(),
      ipStart: 1,
      ipEnd: 1,
    });
    assert.equal(ip, undefined);
  });

  it("builds ipconfig0 string", () => {
    assert.equal(
      buildIpConfig0("45.74.7.165", "45.74.7.0/24", "45.74.7.1"),
      "ip=45.74.7.165/24,gw=45.74.7.1"
    );
  });
});
