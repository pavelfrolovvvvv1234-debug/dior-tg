import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterAndSortOsTemplatesForVpsPicker,
  humanizeVmmOsName,
} from "../vmm-os-display.js";

const mockOs = (name: string, id: number) => ({
  id,
  name,
  adminonly: false,
  state: "active" as const,
  repository: "ISPsystem",
});

describe("filterAndSortOsTemplatesForVpsPicker", () => {
  it("orders templates in the two-column grid (left then right per row)", () => {
    const list = [
      mockOs("winserver2019", 1),
      mockOs("ubuntu2404", 2),
      mockOs("debian11", 3),
      mockOs("centosstream9", 4),
      mockOs("ubuntu2204", 5),
      mockOs("fedora41", 6),
      mockOs("fedora40", 7),
      mockOs("NoOS", 8),
    ];

    const sorted = filterAndSortOsTemplatesForVpsPicker(list);
    assert.deepEqual(
      sorted.map((o) => o.name),
      ["ubuntu2404", "centosstream9", "ubuntu2204", "fedora41", "debian11", "winserver2019"]
    );
  });

  it("respects allowedIds when provided", () => {
    const list = [mockOs("ubuntu2404", 10), mockOs("ubuntu2204", 11)];
    const sorted = filterAndSortOsTemplatesForVpsPicker(list, {
      allowedIds: new Set([11]),
    });
    assert.deepEqual(
      sorted.map((o) => o.id),
      [11]
    );
  });
});

describe("humanizeVmmOsName", () => {
  it("uses catalog labels for stream CentOS and Windows desktop", () => {
    assert.equal(humanizeVmmOsName("centos9"), "CentOS Stream 9");
    assert.equal(humanizeVmmOsName("centosstream8"), "CentOS Stream 8");
    assert.equal(humanizeVmmOsName("winserver2012r2"), "Windows Server 2012 R2");
    assert.equal(humanizeVmmOsName("windows11"), "Windows 11 Pro");
    assert.equal(humanizeVmmOsName("fedora42"), "Fedora (latest)");
  });
});
