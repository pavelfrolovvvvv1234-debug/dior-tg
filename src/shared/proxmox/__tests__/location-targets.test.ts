import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  VPS_DEFAULT_AUTO_LOCATION,
  canAutoProvisionVpsAtLocation,
  parseLocationKeyFromProvisionerComment,
  resolveProxmoxLocationTarget,
} from "../location-targets.js";

describe("proxmox location targets", () => {
  const prevNodes = process.env.PROXMOX_LOCATION_NODES_JSON;

  beforeEach(() => {
    delete process.env.PROXMOX_LOCATION_NODES_JSON;
  });

  afterEach(() => {
    if (prevNodes === undefined) delete process.env.PROXMOX_LOCATION_NODES_JSON;
    else process.env.PROXMOX_LOCATION_NODES_JSON = prevNodes;
  });

  it("allows only default NL location without node map", () => {
    assert.equal(canAutoProvisionVpsAtLocation(VPS_DEFAULT_AUTO_LOCATION), true);
    assert.equal(canAutoProvisionVpsAtLocation("usa"), false);
    assert.equal(canAutoProvisionVpsAtLocation("de-germany"), false);
  });

  it("allows mapped locations from env", () => {
    process.env.PROXMOX_LOCATION_NODES_JSON = JSON.stringify({
      usa: "pve-usa",
      "nl-amsterdam": "pve01",
    });
    assert.equal(canAutoProvisionVpsAtLocation("usa"), true);
    assert.equal(canAutoProvisionVpsAtLocation("nl-amsterdam"), true);
    assert.equal(canAutoProvisionVpsAtLocation("tr-istanbul"), false);
  });

  it("parses loc key from provisioner comment", () => {
    assert.equal(
      parseLocationKeyFromProvisionerComment("UserID:1,Mega 1,loc:usa,os:ubuntu2204"),
      "usa"
    );
    assert.equal(parseLocationKeyFromProvisionerComment("Reseller:r1,Client:c1"), undefined);
  });

  it("resolves node override for mapped location", () => {
    process.env.PROXMOX_LOCATION_NODES_JSON = JSON.stringify({ usa: "pve-usa" });
    const target = resolveProxmoxLocationTarget("usa", {
      node: "pve01",
      bridge: "vmbr0",
      storage: "local-lvm",
    });
    assert.equal(target.node, "pve-usa");
    assert.equal(target.bridge, "vmbr0");
  });
});
