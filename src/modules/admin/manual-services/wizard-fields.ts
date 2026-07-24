/**
 * Wizard field definitions per service type.
 *
 * @module modules/admin/manual-services/wizard-fields
 */

import type { AdminManualServiceType } from "./types.js";

export interface WizardFieldDef {
  key: string;
  /** Fluent message id for prompt */
  promptKey: string;
  optional?: boolean;
  /** Hint shown under prompt (fluent id) */
  hintKey?: string;
}

const domainFields: WizardFieldDef[] = [
  { key: "domain", promptKey: "admin-cs-field-domain", hintKey: "admin-cs-hint-domain-idn" },
  { key: "expiresAt", promptKey: "admin-cs-field-expires", hintKey: "admin-cs-hint-date" },
  { key: "ns1", promptKey: "admin-cs-field-ns1", optional: true },
  { key: "ns2", promptKey: "admin-cs-field-ns2", optional: true },
  { key: "notes", promptKey: "admin-cs-field-notes", optional: true },
];

const vdsFields: WizardFieldDef[] = [
  { key: "ipv4", promptKey: "admin-cs-field-ipv4" },
  { key: "login", promptKey: "admin-cs-field-login" },
  { key: "password", promptKey: "admin-cs-field-password" },
  { key: "provider", promptKey: "admin-cs-field-provider" },
  { key: "osLabel", promptKey: "admin-cs-field-os" },
  { key: "sshPort", promptKey: "admin-cs-field-ssh-port", optional: true },
  { key: "vmid", promptKey: "admin-cs-field-vmid", optional: true, hintKey: "admin-cs-hint-vmid" },
  { key: "rateName", promptKey: "admin-cs-field-rate" },
  {
    key: "group",
    promptKey: "admin-cs-field-group",
    optional: true,
    hintKey: "admin-cs-hint-group",
  },
  { key: "expireAt", promptKey: "admin-cs-field-expires", hintKey: "admin-cs-hint-date" },
  { key: "cpuCount", promptKey: "admin-cs-field-cpu" },
  { key: "ramGb", promptKey: "admin-cs-field-ram" },
  { key: "diskGb", promptKey: "admin-cs-field-disk" },
  { key: "renewalPrice", promptKey: "admin-cs-field-price" },
  { key: "notes", promptKey: "admin-cs-field-notes", optional: true },
];

const dedicatedFields: WizardFieldDef[] = [
  { key: "ipv4", promptKey: "admin-cs-field-ipv4" },
  { key: "provider", promptKey: "admin-cs-field-provider" },
  { key: "login", promptKey: "admin-cs-field-login" },
  { key: "password", promptKey: "admin-cs-field-password" },
  { key: "rackLocation", promptKey: "admin-cs-field-rack" },
  { key: "hardwareInfo", promptKey: "admin-cs-field-hardware" },
  { key: "monthlyPrice", promptKey: "admin-cs-field-monthly", optional: true },
  { key: "paidUntil", promptKey: "admin-cs-field-paid-until", optional: true, hintKey: "admin-cs-hint-date" },
  { key: "notes", promptKey: "admin-cs-field-notes", optional: true },
];

export function getWizardFields(type: AdminManualServiceType): WizardFieldDef[] {
  switch (type) {
    case "domain":
      return domainFields;
    case "vds":
      return vdsFields;
    case "dedicated":
      return dedicatedFields;
    default:
      return [];
  }
}

export const SERVICE_TYPE_LABEL: Record<AdminManualServiceType, string> = {
  domain: "🌐 Domains",
  vds: "☁ VPS / VDS",
  dedicated: "🖥 Dedicated",
};
