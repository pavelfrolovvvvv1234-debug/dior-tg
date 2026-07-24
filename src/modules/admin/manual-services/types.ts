/**
 * Admin manual service provisioning — domain types.
 *
 * @module modules/admin/manual-services/types
 */

export type AdminManualServiceType = "domain" | "vds" | "dedicated";

export interface AdminManualServiceDraftBase {
  notes?: string;
}

export interface DomainServiceDraft extends AdminManualServiceDraftBase {
  domain: string;
  registrar: string;
  expiresAt: string;
  ns1?: string;
  ns2?: string;
}

export interface VdsServiceDraft extends AdminManualServiceDraftBase {
  ipv4: string;
  login: string;
  password: string;
  provider: string;
  osLabel: string;
  sshPort?: number;
  vmid?: number;
  rateName: string;
  /** Abuse (bulletproof) or Regular. Default Abuse. */
  group?: string;
  expireAt: string;
  cpuCount: number;
  ramGb: number;
  diskGb: number;
  renewalPrice: number;
}

export interface DedicatedServiceDraft extends AdminManualServiceDraftBase {
  ipv4: string;
  provider: string;
  login: string;
  password: string;
  rackLocation: string;
  hardwareInfo: string;
  monthlyPrice?: number;
  paidUntil?: string;
}

export type AdminManualServiceDraft =
  | { type: "domain"; data: Partial<DomainServiceDraft> }
  | { type: "vds"; data: Partial<VdsServiceDraft> }
  | { type: "dedicated"; data: Partial<DedicatedServiceDraft> };

export type AdminCreateServiceWizardStep =
  | "type"
  | "form"
  | "user"
  | "review"
  | "creating"
  | "success";

export interface AdminCreateServiceSessionState {
  step: AdminCreateServiceWizardStep;
  serviceType: AdminManualServiceType | null;
  draft: Partial<DomainServiceDraft & VdsServiceDraft & DedicatedServiceDraft>;
  formFieldIndex: number;
  assignedUserId: number | null;
  assignedUserTelegramId: number | null;
  createdSummary: string | null;
  createdServiceRef: string | null;
  messageId: number | null;
  chatId: number | null;
}

export interface AdminManualServiceCreateResult {
  serviceType: AdminManualServiceType;
  serviceId: number;
  summary: string;
  userId: number;
}
