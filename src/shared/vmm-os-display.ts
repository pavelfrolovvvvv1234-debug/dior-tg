/**
 * Readable labels and VPS/VDS OS picker ordering for VMmanager template slugs.
 */

export type VmmOsTemplateLike = {
  id: number;
  name: string;
  adminonly?: boolean;
  state?: string;
  repository?: string;
};

/** Fedora slot in the picker grid (right column, row 4). */
const FEDORA_PICKER_SORT_INDEX = 7;

/**
 * Interleaved left/right columns: Ubuntu…Rocky on the left, CentOS…Windows on the right.
 * Keys are normalized slugs (see {@link normalizeVmmOsSlug}).
 */
const VPS_OS_PICKER_SORT_BY_SLUG: ReadonlyMap<string, number> = new Map([
  ["ubuntu2404", 0],
  ["centosstream9", 1],
  ["centos9", 1],
  ["ubuntu2204", 2],
  ["centosstream8", 3],
  ["centos8", 3],
  ["ubuntu2004", 4],
  ["oraclelinux9", 5],
  ["oracle9", 5],
  ["debian13", 6],
  ["debian12", 8],
  ["winserver2022", 9],
  ["debian11", 10],
  ["winserver2019", 11],
  ["almalinux9", 12],
  ["alma9", 12],
  ["winserver2016", 13],
  ["almalinux8", 14],
  ["alma8", 14],
  ["winserver2012r2", 15],
  ["winserver2012", 15],
  ["rockylinux9", 16],
  ["rockylinux8", 18],
  ["windows10pro", 17],
  ["win10pro", 17],
  ["windows10", 17],
  ["win10", 17],
  ["windows11pro", 19],
  ["win11pro", 19],
  ["windows11", 19],
  ["win11", 19],
]);

export function normalizeVmmOsSlug(raw: string): string {
  const lower = raw.trim().toLowerCase().replace(/[-_\s]+/g, "");
  if (lower === "alma8") return "almalinux8";
  if (lower === "alma9") return "almalinux9";
  return lower;
}

function getVpsOsPickerSortIndex(slug: string): number | null {
  return VPS_OS_PICKER_SORT_BY_SLUG.get(slug) ?? null;
}

function isActiveVmmOsTemplate(os: VmmOsTemplateLike): boolean {
  return (
    !os.adminonly &&
    os.name !== "NoOS" &&
    os.state === "active" &&
    os.repository !== "ISPsystem LXD"
  );
}

/**
 * Templates for VPS purchase / reinstall keyboards in display order (20 slots, 10 rows × 2).
 * Optional `allowedIds`: when non-empty, only templates with matching IDs are included.
 */
export function filterAndSortOsTemplatesForVpsPicker<T extends VmmOsTemplateLike>(
  list: T[],
  options?: { allowedIds?: Set<number> }
): T[] {
  const allowedIds = options?.allowedIds;
  const restrictById = allowedIds != null && allowedIds.size > 0;

  const bySlot = new Map<number, T>();
  let bestFedora: T | null = null;
  let bestFedoraVersion = -1;

  for (const os of list) {
    if (!isActiveVmmOsTemplate(os)) continue;
    if (restrictById && !allowedIds!.has(os.id)) continue;

    const slug = normalizeVmmOsSlug(os.name);
    const fedoraMatch = slug.match(/^fedora(\d+)$/);
    if (fedoraMatch) {
      const version = Number.parseInt(fedoraMatch[1], 10);
      if (version > bestFedoraVersion) {
        bestFedoraVersion = version;
        bestFedora = os;
      }
      continue;
    }

    const sortIndex = getVpsOsPickerSortIndex(slug);
    if (sortIndex == null) continue;
    if (!bySlot.has(sortIndex)) {
      bySlot.set(sortIndex, os);
    }
  }

  if (bestFedora) {
    bySlot.set(FEDORA_PICKER_SORT_INDEX, bestFedora);
  }

  return [...bySlot.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, os]) => os);
}

export function humanizeVmmOsName(raw: string): string {
  const s = raw.trim();
  if (!s) {
    return raw;
  }
  const lower = normalizeVmmOsSlug(s);

  const ubuntu = lower.match(/^ubuntu(\d{2})(\d{2})$/);
  if (ubuntu) {
    const ver = `${ubuntu[1]}.${ubuntu[2]}`;
    const lts = new Set(["20.04", "22.04", "24.04"]);
    return `Ubuntu ${ver}${lts.has(ver) ? " LTS" : ""}`;
  }

  const debian = lower.match(/^debian(\d+)$/);
  if (debian) {
    return `Debian ${debian[1]}`;
  }

  const rocky = lower.match(/^rockylinux(\d+)$/);
  if (rocky) {
    return `Rocky Linux ${rocky[1]}`;
  }

  const alma = lower.match(/^almalinux(\d+)$/);
  if (alma) {
    return `AlmaLinux ${alma[1]}`;
  }

  const oracle = lower.match(/^oraclelinux(\d+)$/);
  if (oracle) {
    return `Oracle Linux ${oracle[1]}`;
  }

  const centosStream = lower.match(/^centosstream(\d+)$/);
  if (centosStream) {
    return `CentOS Stream ${centosStream[1]}`;
  }

  const centos = lower.match(/^centos(\d+)$/);
  if (centos) {
    return `CentOS Stream ${centos[1]}`;
  }

  const win2012r2 = lower.match(/^winserver2012r2$/);
  if (win2012r2) {
    return "Windows Server 2012 R2";
  }

  const win2012 = lower.match(/^winserver2012$/);
  if (win2012) {
    return "Windows Server 2012 R2";
  }

  const win = lower.match(/^winserver(\d{4})$/);
  if (win) {
    return `Windows Server ${win[1]}`;
  }

  const winAlt = lower.match(/^windows[_-]?server[_-]?(\d{4})$/);
  if (winAlt) {
    return `Windows Server ${winAlt[1]}`;
  }

  if (/^win(?:dows)?10(?:pro)?$/.test(lower)) {
    return "Windows 10 Pro";
  }

  if (/^win(?:dows)?11(?:pro)?$/.test(lower)) {
    return "Windows 11 Pro";
  }

  const fedora = lower.match(/^fedora(\d+)$/);
  if (fedora) {
    return "Fedora (latest)";
  }

  const alpine = lower.match(/^alpine(\d)(\d{2})$/);
  if (alpine) {
    return `Alpine Linux ${alpine[1]}.${alpine[2]}`;
  }

  const cloudos = lower.match(/^opencloudos(\d+)$/);
  if (cloudos) {
    return `OpenCloudOS ${cloudos[1]}`;
  }

  const opensuseLeap = lower.match(/^opensuse[_-]?leap[_-]?(\d+(?:\.\d+)?)$/);
  if (opensuseLeap) {
    return `openSUSE Leap ${opensuseLeap[1]}`;
  }

  const tumble = lower.match(/^opensuse[_-]?tumbleweed$/);
  if (tumble) {
    return "openSUSE Tumbleweed";
  }

  const generic = lower.match(/^([a-z]+)(\d+(?:\.\d+)?)$/);
  if (generic) {
    const word = generic[1];
    const prettyWord = word.charAt(0).toUpperCase() + word.slice(1);
    return `${prettyWord} ${generic[2]}`;
  }

  return s
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .trim();
}
