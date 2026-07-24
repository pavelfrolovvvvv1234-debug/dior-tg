import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  canAutoProvisionStandardOnHostVds,
  isHostVdsEnabled,
  readHostVdsConfig,
} from "../hostvds-config.js";

describe("hostvds-config", () => {
  const prev: Record<string, string | undefined> = {};
  const keys = [
    "HOSTVDS_AUTH_URL",
    "HOSTVDS_USERNAME",
    "HOSTVDS_PASSWORD",
    "HOSTVDS_PROJECT_NAME",
    "HOSTVDS_NETWORK_ID",
    "HOSTVDS_IMAGE_MAP",
    "HOSTVDS_LOCATION_KEYS",
  ];

  before(() => {
    for (const k of keys) prev[k] = process.env[k];
  });

  after(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("disabled without credentials", () => {
    for (const k of keys) delete process.env[k];
    assert.equal(isHostVdsEnabled(), false);
    assert.equal(canAutoProvisionStandardOnHostVds("ru"), false);
  });

  it("enabled with full config", () => {
    process.env.HOSTVDS_AUTH_URL = "https://example.com:5000/v3";
    process.env.HOSTVDS_USERNAME = "u";
    process.env.HOSTVDS_PASSWORD = "p";
    process.env.HOSTVDS_PROJECT_NAME = "proj";
    process.env.HOSTVDS_NETWORK_ID = "net-1";
    process.env.HOSTVDS_IMAGE_MAP = JSON.stringify({ ubuntu2404: "img-1" });
    process.env.HOSTVDS_LOCATION_KEYS = "ru,by";
    assert.equal(isHostVdsEnabled(), true);
    assert.equal(canAutoProvisionStandardOnHostVds("ru"), true);
    assert.equal(canAutoProvisionStandardOnHostVds("ab"), false);
    const c = readHostVdsConfig();
    assert.ok(c);
    assert.equal(c!.imageMap.ubuntu2404, "img-1");
  });
});
