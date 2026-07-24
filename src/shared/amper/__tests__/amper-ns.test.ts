import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  domainNsLookLikeAmperDns,
  normalizeNameserverHost,
} from "../amper-ns.js";

describe("amper-ns", () => {
  it("normalizes hosts", () => {
    assert.equal(normalizeNameserverHost("NS1.Example.COM."), "ns1.example.com");
  });

  it("detects Amper NS overlap", () => {
    assert.equal(
      domainNsLookLikeAmperDns("ns1.amper.lat", "ns2.other.com", ["ns1.amper.lat", "ns2.amper.lat"]),
      true
    );
    assert.equal(
      domainNsLookLikeAmperDns("ns1.cloudflare.com", "ns2.cloudflare.com", [
        "ns1.amper.lat",
        "ns2.amper.lat",
      ]),
      false
    );
  });
});
