import { Role } from "../../../entities/User.js";

export type ResellerAdminAction =
  | "hub.view"
  | "reseller.list"
  | "reseller.create"
  | "reseller.detail"
  | "reseller.suspend"
  | "api_key.rotate"
  | "api_key.revoke"
  | "finance.view"
  | "analytics.view"
  | "abuse.view"
  | "abuse.act"
  | "logs.view"
  | "security.view";

const ROLE_PERMISSIONS: Record<Role, Set<ResellerAdminAction>> = {
  [Role.Admin]: new Set<ResellerAdminAction>([
    "hub.view",
    "reseller.list",
    "reseller.create",
    "reseller.detail",
    "reseller.suspend",
    "api_key.rotate",
    "api_key.revoke",
    "finance.view",
    "analytics.view",
    "abuse.view",
    "abuse.act",
    "logs.view",
    "security.view",
  ]),
  [Role.Moderator]: new Set<ResellerAdminAction>([
    "hub.view",
    "reseller.list",
    "reseller.detail",
    "analytics.view",
    "abuse.view",
    "logs.view",
  ]),
  [Role.User]: new Set(),
};

export function canResellerAdmin(role: Role, action: ResellerAdminAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

export function requireResellerAdmin(role: Role, action: ResellerAdminAction): boolean {
  return canResellerAdmin(role, action);
}
