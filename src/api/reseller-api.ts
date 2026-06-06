import crypto from "crypto";
import { isIPv4 } from "node:net";
import express, { type NextFunction, type Request, type Response } from "express";
import axios, { type AxiosError } from "axios";
import type { Api, RawApi } from "grammy";
import { QueryFailedError, type DataSource, type Repository } from "typeorm";
import { z } from "zod";
import User, { Role, UserStatus } from "../entities/User.js";
import VirtualDedicatedServer, { generatePassword, generateRandomName } from "../entities/VirtualDedicatedServer.js";
import type { ListItem } from "./vmmanager.js";
import type { VmProvider } from "../infrastructure/vmmanager/provider.js";
import { resolveStaffNotifyTelegramIds } from "../shared/auth/admin-notify-recipients.js";
import { retry } from "../shared/utils/retry.js";
import { getSharedRedis, rateLimitAllow } from "../infrastructure/redis/client.js";
import {
  beginIdempotentRequest,
  claimNonceOnce,
  completeIdempotentRequest,
  pruneMemorySecurityCaches,
  releaseIdempotentRequest,
} from "../infrastructure/redis/reseller-security-store.js";
import { ensureResellerWalletSchema } from "../infrastructure/db/ensure-reseller-wallet-schema.js";
import { AppError, ExternalApiError } from "../shared/errors/index.js";
import { buildVdsProxmoxDescriptionLine } from "../shared/vds-proxmox-label.js";
import { resolveVdsLoginForOs } from "../shared/vmm-os-display.js";
import { getResellerAuthRuntime } from "../modules/reseller/services/reseller-auth-runtime.js";
import {
  assertResellerCanAfford,
  debitResellerBalance,
  getResellerBillingUser,
} from "../modules/reseller/services/reseller-billing.js";
import ResellerAuditLog from "../entities/ResellerAuditLog.js";
import { getDefaultProxmoxTemplateVmid } from "../app/config.js";
import {
  buildOpenApiDoc,
  getPlansMap,
  listResellerBillingAddons,
  listResellerLocations,
  listResellerOsTemplates,
  listResellerPlans,
  mapGuestMetrics,
  mapService,
  RESELLER_API_ERROR_CODES,
  RESELLER_WEBHOOK_EVENTS,
} from "./reseller-api-catalog.js";
import {
  listResellerBillingTransactions,
  recordResellerWalletDebit,
} from "../modules/reseller/services/reseller-wallet-ledger.js";
import {
  deleteProvisionedVmWithRetry,
  fetchLiveServiceIpv4,
  loadOwnedService,
  mergeServiceIpv4Addresses,
  providerHas,
  purchaseResellerExtraIpv4,
  respondVmNotSupported,
  scheduleBackupCompletion,
} from "./reseller-api-vm-ops.js";

type ResellerAuthInfo = {
  resellerId: string;
  apiKey: string;
  signingSecret: string;
  allowedIps: string[];
  webhookUrl: string | null;
  webhookSecret: string | null;
  rateLimitPerMinute: number;
};

type AuthRequest = Request & {
  rawBody?: string;
  resellerAuth?: ResellerAuthInfo;
  requestId?: string;
};

type ResellerApiOptions = {
  dataSource: DataSource;
  vmProvider: VmProvider;
  botApi: Api<RawApi>;
};

async function getInfoVmResilient(
  vmProvider: VmProvider,
  vmid: number,
  attempts = 4,
  pauseMs = 400
): Promise<ListItem | undefined> {
  let last: ListItem | undefined;
  for (let i = 0; i < attempts; i++) {
    last = await vmProvider.getInfoVM(vmid).catch(() => undefined);
    if (last) return last;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
  return last;
}

type WebhookEventType =
  | "service_created"
  | "service_imported"
  | "service_started"
  | "service_stopped"
  | "service_rebooted"
  | "service_password_reset"
  | "service_password_set"
  | "service_renewed"
  | "service_reinstall_started"
  | "service_reinstall_completed"
  | "service_status_changed"
  | "service_deleted"
  | "payment_failed"
  | "backup_completed"
  | "service_extra_ipv4_added";

type WebhookPayload = {
  event: WebhookEventType;
  resellerId: string;
  timestamp: string;
  data: Record<string, unknown>;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitState>();

const createSchema = z.object({
  rateName: z.string().min(1),
  clientExternalId: z.string().min(1).max(128),
  osId: z.number().int().positive().optional(),
  name: z.string().min(1).max(128).optional(),
  displayName: z.string().min(1).max(128).optional(),
});

const importExistingSchema = z.object({
  vmid: z.number().int().positive(),
  rateName: z.string().min(1),
  clientExternalId: z.string().min(1).max(128),
  expireAt: z.string().min(1),
  ip: z.string().min(1).max(64).optional(),
  osId: z.number().int().positive().optional(),
  displayName: z.string().min(1).max(128).optional(),
});

const actionSetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

const actionRenewSchema = z.object({
  months: z.number().int().positive().optional(),
});

const actionReinstallSchema = z.object({
  osId: z.number().int().positive().optional(),
  password: z.string().min(8).max(128).optional(),
  sshKey: z.string().max(8192).optional(),
});

const reinstallEndpointSchema = actionReinstallSchema;

const sshKeysSchema = z.object({
  keys: z.array(z.string().min(16).max(8192)).min(1).max(16),
});

const snapshotCreateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).optional(),
});

const dnsUpdateSchema = z.object({
  nameservers: z.array(z.string().min(1).max(64)).min(1).max(4),
});

const firewallReplaceSchema = z.object({
  rules: z
    .array(
      z.object({
        enable: z.boolean().optional(),
        action: z.enum(["ACCEPT", "DROP", "REJECT"]),
        type: z.enum(["in", "out", "group"]),
        proto: z.string().max(16).optional(),
        dport: z.string().max(32).optional(),
        sport: z.string().max(32).optional(),
        source: z.string().max(128).optional(),
        dest: z.string().max(128).optional(),
        comment: z.string().max(128).optional(),
      })
    )
    .max(64),
});

const deleteByIpSchema = z.object({
  ip: z.string().min(1).max(64),
});

function parseBooleanEnv(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function parseJsonRecord(raw: string | undefined): Record<string, unknown> {
  const source = (raw ?? "").trim();
  if (!source) return {};
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getResellerWebhooksMap(): Record<string, string> {
  const parsed = parseJsonRecord(process.env.RESELLER_WEBHOOKS_JSON);
  const out: Record<string, string> = {};
  for (const [resellerId, urlValue] of Object.entries(parsed)) {
    const url = String(urlValue ?? "").trim();
    if (resellerId.trim() && url.startsWith("http")) {
      out[resellerId.trim()] = url;
    }
  }
  return out;
}

function getResellerWebhookSecretsMap(): Record<string, string> {
  const parsed = parseJsonRecord(process.env.RESELLER_WEBHOOK_SECRETS_JSON);
  const out: Record<string, string> = {};
  for (const [resellerId, secretValue] of Object.entries(parsed)) {
    const secret = String(secretValue ?? "").trim();
    if (resellerId.trim() && secret.length >= 12) {
      out[resellerId.trim()] = secret;
    }
  }
  return out;
}

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function buildSignature(secret: string, timestamp: string, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getClientIp(req: Request): string {
  const trustProxy =
    process.env.TRUST_PROXY?.trim() === "1" || process.env.TRUST_PROXY?.trim() === "true";
  if (trustProxy) {
    const forwarded = String(req.header("x-forwarded-for") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)[0];
    if (forwarded) {
      return forwarded.replace(/^::ffff:/, "");
    }
  }
  const candidate = req.socket.remoteAddress || req.ip || "";
  return candidate.replace(/^::ffff:/, "");
}

function requireResellerAuth(
  signingSecretsMap: Record<string, string>,
  allowedIpsMap: Record<string, string[]>,
  webhookMap: Record<string, string>,
  webhookSecrets: Record<string, string>,
  rateLimitsMap: Record<string, number>
) {
  const maxSkewSeconds = Number.parseInt(process.env.RESELLER_API_MAX_SKEW_SECONDS ?? "300", 10) || 300;

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    void (async () => {
    const apiKey = String(req.header("x-api-key") ?? "").trim();
    if (!apiKey) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }
    const runtime = getResellerAuthRuntime();
    const resellerId = runtime.keysByHash[sha256Hex(apiKey)] ?? null;
    if (!resellerId) {
      res.status(403).json({ ok: false, error: "invalid_api_key" });
      return;
    }

    const allowedIps = allowedIpsMap[resellerId] ?? [];
    if (allowedIps.length > 0) {
      const clientIp = getClientIp(req);
      if (!allowedIps.includes(clientIp)) {
        res.status(403).json({ ok: false, error: "ip_not_allowed" });
        return;
      }
    }

    const signingSecret = signingSecretsMap[resellerId] ?? null;
    if (!signingSecret) {
      res.status(503).json({ ok: false, error: "hmac_signing_required_for_reseller" });
      return;
    }

    const timestamp = String(req.header("x-timestamp") ?? "").trim();
    const signature = String(req.header("x-signature") ?? "").trim();
    const nonce = String(req.header("x-nonce") ?? "").trim();
    if (!timestamp || !signature) {
      res.status(401).json({ ok: false, error: "missing_signature_headers" });
      return;
    }
    if (!nonce) {
      res.status(401).json({ ok: false, error: "missing_nonce_header" });
      return;
    }
    const ts = Number.parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > maxSkewSeconds) {
      res.status(401).json({ ok: false, error: "signature_timestamp_out_of_range" });
      return;
    }
    const rawBody = req.rawBody ?? "";
    const expected = buildSignature(signingSecret, timestamp, rawBody);
    if (!secureEqual(expected, signature)) {
      res.status(401).json({ ok: false, error: "invalid_signature" });
      return;
    }
    const nonceKey = `${resellerId}:${nonce}:${timestamp}`;
    const nonceOk = await claimNonceOnce(nonceKey, maxSkewSeconds);
    if (!nonceOk) {
      res.status(409).json({ ok: false, error: "nonce_already_used" });
      return;
    }

    const defaultMax = Number.parseInt(process.env.RESELLER_API_RATE_MAX ?? "120", 10) || 120;
    const rateLimitPerMinute = rateLimitsMap[resellerId] ?? defaultMax;

    req.resellerAuth = {
      resellerId,
      apiKey,
      signingSecret,
      allowedIps,
      webhookUrl: webhookMap[resellerId] ?? null,
      webhookSecret: webhookSecrets[resellerId] ?? null,
      rateLimitPerMinute,
    };
    next();
    })().catch((err) => {
      console.error("[Reseller API] auth middleware error", err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: "internal_error" });
      }
    });
  };
}

async function requireRateLimit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const resellerId = req.resellerAuth?.resellerId;
  if (!resellerId) {
    res.status(500).json({ ok: false, error: "missing_reseller_context" });
    return;
  }
  const windowSec = Number.parseInt(process.env.RESELLER_API_RATE_WINDOW_SEC ?? "60", 10) || 60;
  const maxReq = req.resellerAuth!.rateLimitPerMinute;

  const allowed = await rateLimitAllow(`reseller:${resellerId}`, maxReq, windowSec);
  if (!allowed) {
    res.setHeader("Retry-After", String(windowSec));
    res.status(429).json({ ok: false, error: "rate_limit_exceeded", retryAfterSec: windowSec });
    return;
  }

  const now = Date.now();
  const state = rateLimitStore.get(resellerId);
  if (!state || now >= state.resetAt) {
    rateLimitStore.set(resellerId, { count: 1, resetAt: now + windowSec * 1000 });
    next();
    return;
  }
  if (state.count >= maxReq) {
    const retryAfter = Math.max(1, Math.ceil((state.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ ok: false, error: "rate_limit_exceeded", retryAfterSec: retryAfter });
    return;
  }
  state.count += 1;
  next();
}

function requestMeta(req: AuthRequest): { requestId: string } {
  return { requestId: req.requestId || "n/a" };
}

function withRequestId(req: AuthRequest, res: Response, next: NextFunction): void {
  const incoming = String(req.header("x-request-id") ?? "").trim();
  const requestId = incoming || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

function cleanupSecurityCaches(): void {
  pruneMemorySecurityCaches();
}

function idempotencyStoreKey(req: AuthRequest): string | null {
  const key = String(req.header("x-idempotency-key") ?? "").trim();
  if (!key || !req.resellerAuth) return null;
  return `${req.resellerAuth.resellerId}:${req.method}:${req.path}:${key}`;
}

function idempotencyBodyHash(req: AuthRequest): string {
  const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
  return sha256Hex(rawBody);
}

/** Returns true when the handler should stop (response already sent). */
async function runIdempotencyPrelude(req: AuthRequest, res: Response): Promise<boolean> {
  const storeKey = idempotencyStoreKey(req);
  if (!storeKey) return false;
  const bodyHash = idempotencyBodyHash(req);
  const begin = await beginIdempotentRequest(storeKey, bodyHash);
  if (begin.action === "conflict") {
    res.status(409).json({ ok: false, error: "idempotency_key_body_mismatch", ...requestMeta(req) });
    return true;
  }
  if (begin.action === "replay") {
    res.status(begin.statusCode).json({
      ...(begin.response as object),
      ...requestMeta(req),
      idempotentReplay: true,
    });
    return true;
  }
  if (begin.action === "in_progress") {
    res.status(409).json({
      ok: false,
      error: "idempotency_request_in_progress",
      ...requestMeta(req),
    });
    return true;
  }
  return false;
}

async function idempotencyComplete(req: AuthRequest, statusCode: number, response: unknown): Promise<void> {
  const storeKey = idempotencyStoreKey(req);
  if (!storeKey) return;
  await completeIdempotentRequest(storeKey, idempotencyBodyHash(req), statusCode, response);
}

async function idempotencyRelease(req: AuthRequest): Promise<void> {
  const storeKey = idempotencyStoreKey(req);
  if (!storeKey) return;
  await releaseIdempotentRequest(storeKey, idempotencyBodyHash(req));
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${issue?.path.join(".") || "body"}: ${issue?.message || "invalid_payload"}` };
  }
  return { ok: true, data: parsed.data };
}

function parseMonthsToDays(months: number): number {
  if (![1, 3, 6, 12].includes(months)) return 30;
  return months * 30;
}

function parsePositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parsePositiveIntEnv(key: string, fallback: number): number {
  const n = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const msg = String(err.message ?? "");
  return /unique|UNIQUE constraint|SQLITE_CONSTRAINT_UNIQUE/i.test(msg);
}

/** Poll hypervisor until VM has a real IPv4 (same idea as vds-shop-flow). */
async function pollResellerVmIpv4(vmProvider: VmProvider, vmid: number): Promise<string> {
  const maxAttempts = parsePositiveIntEnv("RESELLER_VDS_IP_POLL_MAX_ATTEMPTS", 20);
  const delayMs = parsePositiveIntEnv("RESELLER_VDS_IP_POLL_MS", 2000);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ipData = await vmProvider.getIpv4AddrVM(vmid).catch(() => undefined);
    const candidate = ipData?.list?.[0]?.ip_addr;
    if (candidate && candidate !== "0.0.0.0" && candidate !== "127.0.0.1") {
      return candidate;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  const last = await vmProvider.getIpv4AddrVM(vmid).catch(() => undefined);
  return last?.list?.[0]?.ip_addr ?? "0.0.0.0";
}

function stableNegativeId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(hash || 1);
  return -abs;
}

async function getOrCreateClientUser(
  dataSource: DataSource,
  resellerId: string,
  clientExternalId: string
): Promise<User> {
  const userRepo = dataSource.getRepository(User);
  const syntheticTelegramId = stableNegativeId(`${resellerId}:${clientExternalId}`);
  let user = await userRepo.findOneBy({ telegramId: syntheticTelegramId });
  if (user) return user;
  user = userRepo.create({
    telegramId: syntheticTelegramId,
    role: Role.User,
    status: UserStatus.User,
    lang: "en",
    isBanned: false,
    balance: 0,
    referralBalance: 0,
  });
  return await userRepo.save(user);
}

async function emitPaymentFailedWebhook(
  auth: ResellerAuthInfo,
  resellerId: string,
  context: Record<string, unknown>
): Promise<void> {
  await emitWebhook(auth, {
    event: "payment_failed",
    resellerId,
    timestamp: new Date().toISOString(),
    data: context,
  });
}

async function performServiceReinstall(
  options: ResellerApiOptions,
  vds: VirtualDedicatedServer,
  body: { osId?: number; password?: string; sshKey?: string }
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const osId = body.osId ?? (vds.lastOsId || getDefaultProxmoxTemplateVmid());
  const rootPw = body.password?.trim() || vds.password?.trim() || generatePassword(12);
  let result: unknown;
  try {
    result = await options.vmProvider.reinstallOS(
      vds.vdsId,
      osId,
      rootPw,
      buildVdsProxmoxDescriptionLine(vds)
    );
  } catch {
    return { ok: false, error: "reinstall_failed" };
  }
  if (!result) {
    return { ok: false, error: "reinstall_failed" };
  }
  let password = rootPw;
  if (
    typeof result === "object" &&
    result !== null &&
    "_rootPassword" in result &&
    typeof (result as { _rootPassword?: string })._rootPassword === "string"
  ) {
    const np = (result as { _rootPassword: string })._rootPassword;
    if (np) password = np;
  }
  vds.password = password;
  vds.lastOsId = osId;
  vds.login = resolveVdsLoginForOs({ osId });
  const sshKey = body.sshKey?.trim();
  if (sshKey) {
    if (!providerHas(options.vmProvider, "setSshKeys")) {
      return { ok: false, error: "ssh_key_not_supported" };
    }
    const ok = await options.vmProvider.setSshKeys(vds.vdsId, [sshKey]);
    if (!ok) return { ok: false, error: "ssh_key_apply_failed" };
  }
  return { ok: true, password };
}

async function emitWebhook(auth: ResellerAuthInfo, payload: WebhookPayload): Promise<void> {
  if (!auth.webhookUrl) return;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-reseller-id": auth.resellerId,
  };
  if (auth.webhookSecret) {
    const ts = String(Math.floor(Date.now() / 1000));
    headers["x-timestamp"] = ts;
    headers["x-signature"] = buildSignature(auth.webhookSecret, ts, body);
  }
  await axios.post(auth.webhookUrl, payload, { headers, timeout: 10000 }).catch(() => {});
}

function normalizeResellerIpv4(raw: string): string | null {
  const t = raw.trim();
  if (!isIPv4(t)) return null;
  return t;
}

async function performResellerServiceDelete(
  options: ResellerApiOptions,
  auth: ResellerAuthInfo,
  resellerId: string,
  vds: VirtualDedicatedServer,
  vdsRepo: Repository<VirtualDedicatedServer>,
  req: AuthRequest,
  res: Response
): Promise<void> {
  const itemSnapshot = mapService(vds);
  try {
    await retry(() => options.vmProvider.deleteVM(vds.vdsId), {
      maxAttempts: 3,
      delayMs: 2000,
      exponentialBackoff: true,
    });
  } catch {
    res.status(502).json({ ok: false, error: "delete_failed", ...requestMeta(req) });
    return;
  }
  await vdsRepo.delete({ id: vds.id });
  await emitWebhook(auth, {
    event: "service_deleted",
    resellerId,
    timestamp: new Date().toISOString(),
    data: itemSnapshot,
  });
  res.json({
    ok: true,
    deleted: { serviceId: vds.id, vmid: vds.vdsId, ip: vds.ipv4Addr },
  });
}

async function notifyAdminsAboutResellerVps(
  options: ResellerApiOptions,
  payload: {
    action: "created" | "imported";
    resellerId: string;
    clientExternalId: string;
    vds: VirtualDedicatedServer;
    login: string;
    password: string;
  }
): Promise<void> {
  const adminIds = await resolveStaffNotifyTelegramIds(options.dataSource);
  if (adminIds.length === 0) return;

  const price = Number(payload.vds.renewalPrice || 0);
  const text = [
    `🧩 <b>Reseller VPS ${payload.action === "created" ? "purchase" : "import"}</b>`,
    ``,
    `🏷 <b>Reseller:</b> ${payload.resellerId}`,
    `👤 <b>Client:</b> ${payload.clientExternalId}`,
    `🖥 <b>Service ID:</b> ${payload.vds.id}`,
    `🆔 <b>VMID:</b> ${payload.vds.vdsId}`,
    `🌍 <b>IP:</b> ${payload.vds.ipv4Addr || "0.0.0.0"}`,
    `📦 <b>Plan:</b> ${payload.vds.rateName}`,
    `💰 <b>Cost:</b> $${price.toFixed(2)} / 30d`,
    `📅 <b>Expires:</b> ${new Date(payload.vds.expireAt).toISOString()}`,
    ``,
    `🔐 <b>Access:</b>`,
    `👤 Login: <code>${payload.login}</code>`,
    `🔑 Password: <code>${payload.password}</code>`,
    ``,
    `⚙️ <b>Resources:</b> CPU ${payload.vds.cpuCount} | RAM ${payload.vds.ramSize}GB | Disk ${payload.vds.diskSize}GB | Net ${payload.vds.networkSpeed}Mbps`,
  ].join("\n");

  await Promise.all(
    adminIds.map((adminId) =>
      options.botApi
        .sendMessage(adminId, text, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        })
        .catch(() => {})
    )
  );
}

function unwrapAxiosFromChain(err: unknown): AxiosError | undefined {
  if (axios.isAxiosError(err)) return err;
  if (err instanceof ExternalApiError && err.originalError !== undefined) {
    return unwrapAxiosFromChain(err.originalError);
  }
  return undefined;
}

/** Safe excerpt from VMManager / Proxmox HTTP response for reseller diagnostics. */
function describeUpstreamFailure(err: unknown): { upstreamStatus?: number; upstreamDetail?: string } {
  const ax = unwrapAxiosFromChain(err);
  if (!ax?.response) return {};
  const status = ax.response.status;
  const data = ax.response.data as unknown;
  let upstreamDetail: string | undefined;
  if (data !== undefined && data !== null) {
    if (typeof data === "string") upstreamDetail = data.slice(0, 1200);
    else {
      try {
        upstreamDetail = JSON.stringify(data).slice(0, 1200);
      } catch {
        upstreamDetail = undefined;
      }
    }
  }
  return { upstreamStatus: status, upstreamDetail };
}

function clientCodeForAppError(err: AppError): string {
  if (err.code === "EXTERNAL_API_ERROR") return "upstream_error";
  return err.code.toLowerCase();
}

async function routeGuarded(req: AuthRequest, res: Response, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error: unknown) {
    if (error instanceof AppError) {
      const payload: Record<string, unknown> = {
        ok: false,
        error: clientCodeForAppError(error),
        ...requestMeta(req),
      };
      if (error.code === "EXTERNAL_API_ERROR") {
        Object.assign(payload, describeUpstreamFailure(error));
      }
      if (process.env.NODE_ENV !== "production" && error.message) {
        payload.message = error.message;
      }
      res.status(error.statusCode).json(payload);
      return;
    }
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "internal_error" : msg || "internal_error",
      ...requestMeta(req),
    });
  }
}

export function startResellerApiServer(options: ResellerApiOptions): void {
  const enabled = parseBooleanEnv(process.env.RESELLER_API_ENABLED);
  const runtime = getResellerAuthRuntime();
  if (!enabled || Object.keys(runtime.keysByHash).length === 0) return;

  if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL?.trim()) {
    console.warn(
      "[Reseller API] REDIS_URL is not set — idempotency and nonce replay protection use in-memory fallback (unsafe across restarts / multiple workers)"
    );
  }

  void ensureResellerWalletSchema(options.dataSource).catch((err) => {
    console.error("[Reseller API] ensureResellerWalletSchema failed", err);
  });

  const signingSecretsMap = runtime.signingSecrets;
  const allowedIpsMap = runtime.allowedIps;
  const webhookMap = { ...getResellerWebhooksMap(), ...runtime.webhooks };
  const webhookSecrets = { ...getResellerWebhookSecretsMap(), ...runtime.webhookSecrets };

  const app = express();
  app.set("trust proxy", true);
  app.use(withRequestId);
  app.use(
    express.json({
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as AuthRequest).rawBody = buf.toString("utf8");
      },
    })
  );

  app.get("/reseller/health", async (_req: Request, res: Response) => {
    const redis = await getSharedRedis();
    res.json({
      ok: true,
      service: "reseller-api",
      version: "1.2.0",
      redis: redis ? "connected" : "memory_fallback",
      provider: (process.env.VM_PROVIDER ?? "proxmox").trim().toLowerCase(),
    });
  });

  const exposeDocs =
    process.env.RESELLER_API_EXPOSE_DOCS?.trim() === "1" ||
    process.env.RESELLER_API_EXPOSE_DOCS?.trim() === "true";

  if (exposeDocs) {
    app.get("/reseller/openapi.json", (req: Request, res: Response) => {
      const host = req.header("host") || `localhost:${process.env.RESELLER_API_PORT ?? "3003"}`;
      const proto = (req.header("x-forwarded-proto") || req.protocol || "https").toString();
      res.json(buildOpenApiDoc(`${proto}://${host}`));
    });

    app.get("/reseller/docs", (_req: Request, res: Response) => {
      res.type("text/plain").send(
        [
          "DiorHost Reseller API docs:",
          "1) OpenAPI JSON: /reseller/openapi.json",
          "2) Endpoints base: /reseller/v1/*",
          "3) Auth: x-api-key + HMAC (x-timestamp, x-signature, x-nonce)",
        ].join("\n")
      );
    });
  }

  app.use(
    "/reseller/v1",
    requireResellerAuth(
      signingSecretsMap,
      allowedIpsMap,
      webhookMap,
      webhookSecrets,
      runtime.rateLimitPerMinute
    ),
    (req, res, next) => {
      void requireRateLimit(req as AuthRequest, res, next);
    }
  );

  app.get("/reseller/v1/plans", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      res.json({ ok: true, items: listResellerPlans(), ...requestMeta(req) });
    });
  });

  app.get("/reseller/v1/locations", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      res.json({ ok: true, items: listResellerLocations(), ...requestMeta(req) });
    });
  });

  app.get("/reseller/v1/os-templates", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const items = await listResellerOsTemplates(options.vmProvider);
      res.json({ ok: true, items, ...requestMeta(req) });
    });
  });

  app.get("/reseller/v1/billing/balance", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const billing = await getResellerBillingUser(options.dataSource, req.resellerAuth!.resellerId);
      if (!billing.ok) {
        res.status(403).json({ ok: false, error: billing.error, ...requestMeta(req) });
        return;
      }
      res.json({
        ok: true,
        balanceUsd: billing.user.balance,
        currency: "USD",
        ...requestMeta(req),
      });
    });
  });

  app.get("/reseller/v1/billing/transactions", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const resellerId = req.resellerAuth!.resellerId;
      const take = Math.min(200, Math.max(1, parsePositiveInt(req.query.limit) ?? 50));
      const txResult = await listResellerBillingTransactions(options.dataSource, resellerId, take);
      if (!txResult.ok) {
        res.status(403).json({ ok: false, error: txResult.error, ...requestMeta(req) });
        return;
      }
      res.json({ ok: true, items: txResult.items, ...requestMeta(req) });
    });
  });

  app.get("/reseller/v1/billing/addons", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      res.json({ ok: true, addons: listResellerBillingAddons(), ...requestMeta(req) });
    });
  });

  app.get("/reseller/v1/billing/ledger", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const resellerId = req.resellerAuth!.resellerId;
      const take = Math.min(100, Math.max(1, parsePositiveInt(req.query.limit) ?? 50));
      const repo = options.dataSource.getRepository(ResellerAuditLog);
      const rows = await repo.find({
        where: { resellerId },
        order: { id: "DESC" },
        take,
      });
      res.json({
        ok: true,
        items: rows.map((r) => ({
          id: r.id,
          action: r.action,
          detail: r.detail,
          targetType: r.targetType,
          targetId: r.targetId,
          createdAt: r.createdAt,
        })),
        note: "Control-plane audit only. Use GET /billing/transactions for wallet debits and bot top-ups.",
        ...requestMeta(req),
      });
    });
  });

  app.get("/reseller/v1/webhooks/events", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      res.json({
        ok: true,
        events: [...RESELLER_WEBHOOK_EVENTS],
        signing: "Optional HMAC on webhook POST: x-timestamp + x-signature over raw JSON body",
        ...requestMeta(req),
      });
    });
  });

  app.get("/reseller/v1/errors", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      res.json({ ok: true, codes: [...RESELLER_API_ERROR_CODES], ...requestMeta(req) });
    });
  });

  app.get("/reseller/v1/services", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const resellerId = req.resellerAuth!.resellerId;
      const vdsRepo = options.dataSource.getRepository(VirtualDedicatedServer);
      const services = await vdsRepo.find({
        where: { resellerId },
        order: { id: "DESC" },
        take: 500,
      });
      res.json({ ok: true, items: services.map((vds) => mapService(vds)) });
    });
  });

  app.post("/reseller/v1/services/import-existing", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      cleanupSecurityCaches();
      if (await runIdempotencyPrelude(req, res)) return;

      const bodyParsed = parseBody(importExistingSchema, req.body);
      if (!bodyParsed.ok) {
        await idempotencyRelease(req);
        res.status(400).json({ ok: false, error: bodyParsed.error, ...requestMeta(req) });
        return;
      }
      const body = bodyParsed.data;
      const auth = req.resellerAuth!;
      const resellerId = auth.resellerId;
      const vmid = body.vmid;
      const rateName = body.rateName.trim();
      const clientExternalId = body.clientExternalId.trim();
      const expiresAtRaw = body.expireAt.trim();

      if (!vmid || !rateName || !clientExternalId || !expiresAtRaw) {
        await idempotencyRelease(req);
        res.status(400).json({ ok: false, error: "vmid, rateName, clientExternalId, expireAt are required", ...requestMeta(req) });
        return;
      }

      const plansMap = getPlansMap();
      const plan = plansMap.get(rateName.toLowerCase());
      if (!plan) {
        await idempotencyRelease(req);
        res.status(400).json({ ok: false, error: "unknown_rate_name", ...requestMeta(req) });
        return;
      }

      const expireAt = new Date(expiresAtRaw);
      if (Number.isNaN(expireAt.getTime())) {
        await idempotencyRelease(req);
        res.status(400).json({ ok: false, error: "invalid_expireAt", ...requestMeta(req) });
        return;
      }

      const clientUser = await getOrCreateClientUser(options.dataSource, resellerId, clientExternalId);
      const vdsRepo = options.dataSource.getRepository(VirtualDedicatedServer);
      const existing = await vdsRepo.findOneBy({ vdsId: vmid });
      const password = generatePassword(12);
      await options.vmProvider.changePasswordVMCustom(vmid, password).catch(() => {});

      const entity = existing ?? vdsRepo.create();
      entity.vdsId = vmid;
      entity.login = resolveVdsLoginForOs({ osId: entity.lastOsId });
      entity.password = password;
      entity.ipv4Addr = String(body.ip ?? "0.0.0.0");
      entity.cpuCount = plan.cpu;
      entity.networkSpeed = plan.network;
      entity.isBulletproof = true;
      entity.payDayAt = null;
      entity.ramSize = plan.ram;
      entity.diskSize = plan.ssd;
      entity.lastOsId = body.osId ?? getDefaultProxmoxTemplateVmid();
      entity.rateName = plan.name;
      entity.expireAt = expireAt;
      entity.targetUserId = clientUser.id;
      entity.renewalPrice = Number(plan.price.bulletproof || plan.price.default || 0);
      entity.displayName = String(body.displayName ?? clientExternalId);
      entity.bundleType = null;
      entity.autoRenewEnabled = true;
      entity.adminBlocked = false;
      entity.managementLocked = false;
      entity.extraIpv4Count = 0;
      entity.resellerId = resellerId;
      entity.resellerClientId = clientExternalId;

      const saved = await vdsRepo.save(entity);
      const mapped = mapService(saved);
      await notifyAdminsAboutResellerVps(options, {
        action: "imported",
        resellerId,
        clientExternalId,
        vds: saved,
        login: saved.login,
        password,
      });
      await emitWebhook(auth, {
        event: "service_imported",
        resellerId,
        timestamp: new Date().toISOString(),
        data: mapped,
      });
      const response = { ok: true, item: mapped, credentials: { login: saved.login, password }, ...requestMeta(req) };
      await idempotencyComplete(req, 200, response);
      res.json(response);
    });
  });

  app.post("/reseller/v1/services/create", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      cleanupSecurityCaches();
      if (await runIdempotencyPrelude(req, res)) return;

      const bodyParsed = parseBody(createSchema, req.body);
      if (!bodyParsed.ok) {
        await idempotencyRelease(req);
        res.status(400).json({ ok: false, error: bodyParsed.error, ...requestMeta(req) });
        return;
      }
      const body = bodyParsed.data;
      const auth = req.resellerAuth!;
      const resellerId = auth.resellerId;
      const rateName = body.rateName.trim();
      const clientExternalId = body.clientExternalId.trim();
      if (!rateName || !clientExternalId) {
        await idempotencyRelease(req);
        res.status(400).json({ ok: false, error: "rateName and clientExternalId are required", ...requestMeta(req) });
        return;
      }

      const plansMap = getPlansMap();
      const plan = plansMap.get(rateName.toLowerCase());
      if (!plan) {
        await idempotencyRelease(req);
        res.status(400).json({ ok: false, error: "unknown_rate_name", ...requestMeta(req) });
        return;
      }

      const price = Number(plan.price.bulletproof || plan.price.default || 0);
      const afford = await assertResellerCanAfford(options.dataSource, resellerId, price);
      if (!afford.ok) {
        await idempotencyRelease(req);
        const status = afford.error === "insufficient_balance" ? 402 : 403;
        if (afford.error === "insufficient_balance") {
          await emitPaymentFailedWebhook(auth, resellerId, {
            action: "create",
            rateName,
            clientExternalId,
            required: afford.required,
            available: afford.available,
          });
        }
        res.status(status).json({
          ok: false,
          error: afford.error,
          required: afford.required,
          available: afford.available,
          hint:
            afford.error === "reseller_telegram_not_linked"
              ? "Link reseller Telegram in DIOR CONTROL (Add Reseller with @username), then top up balance in the bot."
              : "Top up balance in @diorhost_bot (Profile → Deposit) using the reseller Telegram account.",
          ...requestMeta(req),
        });
        return;
      }

      const osId = body.osId ?? getDefaultProxmoxTemplateVmid();
      const password = generatePassword(12);
      const name = String(body.name ?? generateRandomName(13));
      const vm = await options.vmProvider.createVM(
        name,
        password,
        plan.cpu,
        plan.ram,
        osId,
        `Reseller:${resellerId},Client:${clientExternalId},Plan:${plan.name}`,
        plan.ssd,
        1,
        plan.network,
        plan.network
      );
      if (!vm) {
        await idempotencyRelease(req);
        res.status(502).json({ ok: false, error: "vm_create_failed", ...requestMeta(req) });
        return;
      }

      const vmid = vm.id;
      const rollbackCreatedVm = async (): Promise<void> => {
        await deleteProvisionedVmWithRetry(options.vmProvider, vmid);
      };
      const vdsRepo = options.dataSource.getRepository(VirtualDedicatedServer);
      const existingByVmid = await vdsRepo.findOneBy({ vdsId: vmid });
      if (existingByVmid) {
        await rollbackCreatedVm();
        await idempotencyRelease(req);
        res.status(409).json({
          ok: false,
          error: "vmid_already_registered",
          vmid,
          ...requestMeta(req),
        });
        return;
      }

      const ip = await pollResellerVmIpv4(options.vmProvider, vmid);
      const clientUser = await getOrCreateClientUser(options.dataSource, resellerId, clientExternalId);
      const entity = vdsRepo.create({
        vdsId: vmid,
        login: resolveVdsLoginForOs({ osId }),
        password,
        ipv4Addr: ip,
        cpuCount: plan.cpu,
        networkSpeed: plan.network,
        isBulletproof: true,
        payDayAt: null,
        ramSize: plan.ram,
        diskSize: plan.ssd,
        lastOsId: osId,
        rateName: plan.name,
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        targetUserId: clientUser.id,
        renewalPrice: Number(plan.price.bulletproof || plan.price.default || 0),
        displayName: String(body.displayName ?? clientExternalId),
        bundleType: null,
        autoRenewEnabled: true,
        adminBlocked: false,
        managementLocked: false,
        extraIpv4Count: 0,
        resellerId,
        resellerClientId: clientExternalId,
      });
      let saved: VirtualDedicatedServer;
      try {
        const tx = await options.dataSource.transaction(async (em) => {
          const debit = await debitResellerBalance(em, resellerId, price);
          if (!debit.ok) {
            return { kind: "billing_failed" as const, error: debit.error, required: debit.required, available: debit.available };
          }
          const row = await em.save(VirtualDedicatedServer, entity);
          await recordResellerWalletDebit(em, resellerId, price, debit.user.balance, {
            type: "service_create",
            serviceId: row.id,
            vmid: row.vdsId,
            detail: plan.name,
          });
          return { kind: "saved" as const, saved: row };
        });
        if (tx.kind === "billing_failed") {
          await rollbackCreatedVm();
          await idempotencyRelease(req);
          res.status(402).json({
            ok: false,
            error: tx.error,
            required: tx.required,
            available: tx.available,
            ...requestMeta(req),
          });
          return;
        }
        saved = tx.saved;
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          await rollbackCreatedVm();
          await idempotencyRelease(req);
          res.status(409).json({
            ok: false,
            error: "vmid_duplicate",
            vmid,
            ...requestMeta(req),
          });
          return;
        }
        await rollbackCreatedVm();
        await idempotencyRelease(req);
        throw err;
      }
      const mapped = mapService(saved);
      await notifyAdminsAboutResellerVps(options, {
        action: "created",
        resellerId,
        clientExternalId,
        vds: saved,
        login: saved.login,
        password,
      });
      await emitWebhook(auth, {
        event: "service_created",
        resellerId,
        timestamp: new Date().toISOString(),
        data: mapped,
      });
      const response = { ok: true, item: mapped, credentials: { login: saved.login, password }, ...requestMeta(req) };
      await idempotencyComplete(req, 200, response);
      res.json(response);
    });
  });

  app.post("/reseller/v1/services/delete-by-ip", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const bodyParsed = parseBody(deleteByIpSchema, req.body);
      if (!bodyParsed.ok) {
        res.status(400).json({ ok: false, error: bodyParsed.error, ...requestMeta(req) });
        return;
      }
      const ipNorm = normalizeResellerIpv4(bodyParsed.data.ip);
      if (!ipNorm || ipNorm === "0.0.0.0") {
        res.status(400).json({ ok: false, error: "invalid_ip", ...requestMeta(req) });
        return;
      }
      const auth = req.resellerAuth!;
      const resellerId = auth.resellerId;
      const vdsRepo = options.dataSource.getRepository(VirtualDedicatedServer);
      const matches = await vdsRepo.find({
        where: { resellerId, ipv4Addr: ipNorm },
        take: 2,
      });
      if (matches.length === 0) {
        res.status(404).json({ ok: false, error: "service_not_found", ...requestMeta(req) });
        return;
      }
      if (matches.length > 1) {
        res.status(409).json({ ok: false, error: "ambiguous_ip", ...requestMeta(req) });
        return;
      }
      await performResellerServiceDelete(options, auth, resellerId, matches[0]!, vdsRepo, req, res);
    });
  });

  app.get("/reseller/v1/services/:id", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...requestMeta(req) });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...requestMeta(req) });
        return;
      }
      const info = await getInfoVmResilient(options.vmProvider, vds.vdsId);
      const metrics = await options.vmProvider.getGuestMetrics?.(vds.vdsId).catch(() => undefined);
      const ipv4Addresses = await fetchLiveServiceIpv4(options.vmProvider, vds);
      res.json({
        ok: true,
        item: mapService(vds, { vmInfo: info, metrics, ipv4Addresses }),
        ...requestMeta(req),
      });
    });
  });

  app.get("/reseller/v1/services/:id/metrics", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...requestMeta(req) });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...requestMeta(req) });
        return;
      }
      const raw = await options.vmProvider.getGuestMetrics?.(vds.vdsId);
      res.json({
        ok: true,
        serviceId,
        vmid: vds.vdsId,
        metrics: mapGuestMetrics(raw),
        ...requestMeta(req),
      });
    });
  });

  app.get("/reseller/v1/services/:id/network", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...requestMeta(req) });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...requestMeta(req) });
        return;
      }
      const ipv4Api = await options.vmProvider.getIpv4AddrVM(vds.vdsId).catch(() => undefined);
      const fromApi = (ipv4Api?.list ?? []).map((x) => x.ip_addr).filter(Boolean);
      const ipv4 = mergeServiceIpv4Addresses(vds.ipv4Addr, fromApi);
      const dns = providerHas(options.vmProvider, "getGuestDns")
        ? await options.vmProvider.getGuestDns(vds.vdsId)
        : undefined;
      const firewall = providerHas(options.vmProvider, "getFirewallRules")
        ? await options.vmProvider.getFirewallRules(vds.vdsId)
        : undefined;
      res.json({
        ok: true,
        serviceId,
        ipv4,
        ipv6: [],
        ipv6Supported: false,
        dns: dns ?? { nameservers: [] },
        firewall: firewall ?? [],
        addons: listResellerBillingAddons(),
        ...requestMeta(req),
      });
    });
  });

  app.put("/reseller/v1/services/:id/network/dns", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...meta });
        return;
      }
      if (!providerHas(options.vmProvider, "setGuestDns")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const parsed = parseBody(dnsUpdateSchema, req.body ?? {});
      if (!parsed.ok) {
        res.status(400).json({ ok: false, error: parsed.error, ...meta });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const ok = await options.vmProvider.setGuestDns(vds.vdsId, parsed.data.nameservers);
      if (!ok) {
        res.status(502).json({ ok: false, error: "dns_update_failed", ...meta });
        return;
      }
      res.json({ ok: true, dns: { nameservers: parsed.data.nameservers }, ...meta });
    });
  });

  app.get("/reseller/v1/services/:id/firewall", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...meta });
        return;
      }
      if (!providerHas(options.vmProvider, "getFirewallRules")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const rules = await options.vmProvider.getFirewallRules(vds.vdsId);
      res.json({ ok: true, rules: rules ?? [], ...meta });
    });
  });

  app.put("/reseller/v1/services/:id/firewall", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...meta });
        return;
      }
      if (!providerHas(options.vmProvider, "replaceFirewallRules")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const parsed = parseBody(firewallReplaceSchema, req.body ?? {});
      if (!parsed.ok) {
        res.status(400).json({ ok: false, error: parsed.error, ...meta });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const rules = parsed.data.rules.map((r, i) => ({
        pos: i,
        enable: r.enable !== false,
        action: r.action,
        type: r.type,
        proto: r.proto,
        dport: r.dport,
        sport: r.sport,
        source: r.source,
        dest: r.dest,
        comment: r.comment,
      }));
      const ok = await options.vmProvider.replaceFirewallRules(vds.vdsId, rules);
      if (!ok) {
        res.status(502).json({ ok: false, error: "firewall_update_failed", ...meta });
        return;
      }
      res.json({ ok: true, rules, ...meta });
    });
  });

  app.post("/reseller/v1/services/:id/network/ipv4", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      cleanupSecurityCaches();
      if (await runIdempotencyPrelude(req, res)) return;

      const auth = req.resellerAuth!;
      const resellerId = auth.resellerId;
      const meta = requestMeta(req);
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        await idempotencyRelease(req);
        res.status(400).json({ ok: false, error: "invalid_service_id", ...meta });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        await idempotencyRelease(req);
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }

      const result = await purchaseResellerExtraIpv4(
        options.dataSource,
        options.vmProvider,
        resellerId,
        vds
      );
      if (!result.ok) {
        await idempotencyRelease(req);
        if (result.error === "insufficient_balance") {
          await emitPaymentFailedWebhook(auth, resellerId, {
            action: "extra_ipv4",
            serviceId: vds.id,
            required: result.required,
            available: result.available,
          });
        }
        res.status(result.httpStatus).json({
          ok: false,
          error: result.error,
          required: result.required,
          available: result.available,
          ...meta,
        });
        return;
      }

      const ipv4Addresses = await fetchLiveServiceIpv4(options.vmProvider, result.vds);
      const item = mapService(result.vds, { ipv4Addresses });
      await emitWebhook(auth, {
        event: "service_extra_ipv4_added",
        resellerId,
        timestamp: new Date().toISOString(),
        data: {
          ...item,
          extraIp: result.extraIp,
          chargedUsd: result.monthlyPrice,
        },
      });

      const response = {
        ok: true,
        item,
        extraIp: result.extraIp,
        chargedUsd: result.monthlyPrice,
        renewalPriceUsd: Number(result.vds.renewalPrice || 0),
        ...meta,
      };
      await idempotencyComplete(req, 200, response);
      res.json(response);
    });
  });

  app.post("/reseller/v1/services/:id/network/reset", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...meta });
        return;
      }
      if (!providerHas(options.vmProvider, "resetNetworkConfig")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const ok = await options.vmProvider.resetNetworkConfig(vds.vdsId);
      if (!ok) {
        res.status(502).json({ ok: false, error: "network_reset_failed", ...meta });
        return;
      }
      const ipData = await options.vmProvider.getIpv4AddrVM(vds.vdsId).catch(() => undefined);
      const ip = ipData?.list?.[0]?.ip_addr;
      if (ip && ip !== "0.0.0.0") {
        vds.ipv4Addr = ip;
        await options.dataSource.getRepository(VirtualDedicatedServer).save(vds);
      }
      const ipv4Addresses = await fetchLiveServiceIpv4(options.vmProvider, vds);
      res.json({ ok: true, item: mapService(vds, { ipv4Addresses }), ...meta });
    });
  });

  app.get("/reseller/v1/services/:id/console", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...requestMeta(req) });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...requestMeta(req) });
        return;
      }
      const consoleInfo = await options.vmProvider.getVncConsole?.(vds.vdsId);
      if (!consoleInfo) {
        res.status(501).json({ ok: false, error: "not_supported_on_provider", ...requestMeta(req) });
        return;
      }
      res.json({ ok: true, console: consoleInfo, ...requestMeta(req) });
    });
  });

  app.post("/reseller/v1/services/:id/password/reset", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const auth = req.resellerAuth!;
      const resellerId = auth.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...requestMeta(req) });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...requestMeta(req) });
        return;
      }
      const password = await options.vmProvider.changePasswordVM(vds.vdsId);
      vds.password = password;
      await options.dataSource.getRepository(VirtualDedicatedServer).save(vds);
      await emitWebhook(auth, {
        event: "service_password_reset",
        resellerId,
        timestamp: new Date().toISOString(),
        data: mapService(vds),
      });
      res.json({ ok: true, credentials: { login: vds.login, password }, ...requestMeta(req) });
    });
  });

  app.post("/reseller/v1/services/:id/ssh-keys", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      if (!providerHas(options.vmProvider, "setSshKeys")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const parsed = parseBody(sshKeysSchema, req.body ?? {});
      if (!parsed.ok) {
        res.status(400).json({ ok: false, error: parsed.error, ...meta });
        return;
      }
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...meta });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const ok = await options.vmProvider.setSshKeys(vds.vdsId, parsed.data.keys);
      if (!ok) {
        res.status(502).json({ ok: false, error: "ssh_key_apply_failed", ...meta });
        return;
      }
      res.json({ ok: true, ...meta });
    });
  });

  app.get("/reseller/v1/services/:id/snapshots", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      if (!providerHas(options.vmProvider, "listSnapshots")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...meta });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const items = await options.vmProvider.listSnapshots(vds.vdsId);
      res.json({ ok: true, items: items ?? [], ...meta });
    });
  });

  app.post("/reseller/v1/services/:id/snapshots", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      if (!providerHas(options.vmProvider, "createSnapshot")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const parsed = parseBody(snapshotCreateSchema, req.body ?? {});
      if (!parsed.ok) {
        res.status(400).json({ ok: false, error: parsed.error, ...meta });
        return;
      }
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...meta });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const name = parsed.data.name ?? `snap-${Date.now()}`;
      const created = await options.vmProvider.createSnapshot(vds.vdsId, name, parsed.data.description);
      if (!created) {
        res.status(502).json({ ok: false, error: "snapshot_create_failed", ...meta });
        return;
      }
      res.json({ ok: true, snapshot: created, ...meta });
    });
  });

  app.delete("/reseller/v1/services/:id/snapshots/:snapname", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      if (!providerHas(options.vmProvider, "deleteSnapshot")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      const snapname = String(req.params.snapname ?? "").trim();
      if (!serviceId || !snapname) {
        res.status(400).json({ ok: false, error: "invalid_request", ...meta });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const ok = await options.vmProvider.deleteSnapshot(vds.vdsId, snapname);
      if (!ok) {
        res.status(502).json({ ok: false, error: "snapshot_delete_failed", ...meta });
        return;
      }
      res.json({ ok: true, deleted: snapname, ...meta });
    });
  });

  app.post("/reseller/v1/services/:id/snapshots/:snapname/restore", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      if (!providerHas(options.vmProvider, "rollbackSnapshot")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const resellerId = req.resellerAuth!.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      const snapname = String(req.params.snapname ?? "").trim();
      if (!serviceId || !snapname) {
        res.status(400).json({ ok: false, error: "invalid_request", ...meta });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const ok = await options.vmProvider.rollbackSnapshot(vds.vdsId, snapname);
      if (!ok) {
        res.status(502).json({ ok: false, error: "snapshot_restore_failed", ...meta });
        return;
      }
      res.json({ ok: true, restored: snapname, ...meta });
    });
  });

  app.post("/reseller/v1/services/:id/backups", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const meta = requestMeta(req);
      const auth = req.resellerAuth!;
      if (!providerHas(options.vmProvider, "createBackup")) {
        respondVmNotSupported(res, meta);
        return;
      }
      const resellerId = auth.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...meta });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found", ...meta });
        return;
      }
      const task = await options.vmProvider.createBackup(vds.vdsId);
      if (!task) {
        res.status(502).json({ ok: false, error: "backup_start_failed", ...meta });
        return;
      }
      scheduleBackupCompletion(options.vmProvider, task.taskId, (success) => {
        if (!success) return;
        void emitWebhook(auth, {
          event: "backup_completed",
          resellerId,
          timestamp: new Date().toISOString(),
          data: { ...mapService(vds), taskId: task.taskId, storage: task.storage },
        });
      });
      res.status(202).json({ ok: true, backup: task, ...meta });
    });
  });

  app.post("/reseller/v1/services/:id/reinstall", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      cleanupSecurityCaches();
      if (await runIdempotencyPrelude(req, res)) return;

      const auth = req.resellerAuth!;
      const resellerId = auth.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id", ...requestMeta(req) });
        return;
      }
      const bodyParsed = parseBody(reinstallEndpointSchema, req.body ?? {});
      if (!bodyParsed.ok) {
        await idempotencyRelease(req);
        res.status(400).json({ ok: false, error: bodyParsed.error, ...requestMeta(req) });
        return;
      }
      const vds = await loadOwnedService(options.dataSource, resellerId, serviceId);
      if (!vds) {
        await idempotencyRelease(req);
        res.status(404).json({ ok: false, error: "service_not_found", ...requestMeta(req) });
        return;
      }
      const reinstall = await performServiceReinstall(options, vds, bodyParsed.data);
      if (!reinstall.ok) {
        await idempotencyRelease(req);
        const status =
          reinstall.error === "ssh_key_not_supported" || reinstall.error === "ssh_key_apply_failed"
            ? 501
            : 502;
        res.status(status).json({ ok: false, error: reinstall.error, ...requestMeta(req) });
        return;
      }
      const vdsRepo = options.dataSource.getRepository(VirtualDedicatedServer);
      await vdsRepo.save(vds);
      await emitWebhook(auth, {
        event: "service_reinstall_started",
        resellerId,
        timestamp: new Date().toISOString(),
        data: { ...mapService(vds), osId: vds.lastOsId },
      });
      await emitWebhook(auth, {
        event: "service_reinstall_completed",
        resellerId,
        timestamp: new Date().toISOString(),
        data: mapService(vds),
      });
      const response = {
        ok: true,
        item: mapService(vds),
        credentials: { login: vds.login, password: reinstall.password },
        ...requestMeta(req),
      };
      await idempotencyComplete(req, 200, response);
      res.json(response);
    });
  });

  app.post("/reseller/v1/services/:id/actions/:action", async (req: AuthRequest, res: Response) => {
    await routeGuarded(req, res, async () => {
      const auth = req.resellerAuth!;
      const resellerId = auth.resellerId;
      const serviceId = parsePositiveInt(req.params.id);
      const action = String(req.params.action ?? "").trim().toLowerCase();
      if (!serviceId) {
        res.status(400).json({ ok: false, error: "invalid_service_id" });
        return;
      }
      const vdsRepo = options.dataSource.getRepository(VirtualDedicatedServer);
      const vds = await vdsRepo.findOneBy({ id: serviceId, resellerId });
      if (!vds) {
        res.status(404).json({ ok: false, error: "service_not_found" });
        return;
      }

      const emit = async (event: WebhookEventType, extra?: Record<string, unknown>) => {
        await emitWebhook(auth, {
          event,
          resellerId,
          timestamp: new Date().toISOString(),
          data: { ...mapService(vds), ...(extra ?? {}) },
        });
      };

      if (action === "start") {
        await options.vmProvider.startVM(vds.vdsId);
        await emit("service_started");
        await emit("service_status_changed", { status: "online" });
        res.json({ ok: true });
        return;
      }
      if (action === "stop") {
        await options.vmProvider.stopVM(vds.vdsId);
        await emit("service_stopped");
        await emit("service_status_changed", { status: "offline" });
        res.json({ ok: true });
        return;
      }
      if (action === "reboot") {
        await options.vmProvider.stopVM(vds.vdsId);
        await options.vmProvider.startVM(vds.vdsId);
        await emit("service_rebooted");
        res.json({ ok: true });
        return;
      }
      if (action === "reset-password") {
        const password = await options.vmProvider.changePasswordVM(vds.vdsId);
        vds.password = password;
        await vdsRepo.save(vds);
        await emit("service_password_reset");
        res.json({
          ok: true,
          credentials: {
            login: resolveVdsLoginForOs({ osId: vds.lastOsId, storedLogin: vds.login }),
            password,
          },
        });
        return;
      }
      if (action === "set-password") {
        const bodyParsed = parseBody(actionSetPasswordSchema, req.body);
        if (!bodyParsed.ok) {
          res.status(400).json({ ok: false, error: bodyParsed.error, ...requestMeta(req) });
          return;
        }
        const password = bodyParsed.data.password;
        const ok = await options.vmProvider.changePasswordVMCustom(vds.vdsId, password);
        if (!ok) {
          res.status(502).json({ ok: false, error: "password_set_failed" });
          return;
        }
        vds.password = password;
        await vdsRepo.save(vds);
        await emit("service_password_set");
        res.json({ ok: true });
        return;
      }
      if (action === "renew") {
        const bodyParsed = parseBody(actionRenewSchema, req.body ?? {});
        if (!bodyParsed.ok) {
          res.status(400).json({ ok: false, error: bodyParsed.error, ...requestMeta(req) });
          return;
        }
        const months = bodyParsed.data.months ?? 1;
        const renewPrice = Number(vds.renewalPrice || 0) * months;
        const affordRenew = await assertResellerCanAfford(options.dataSource, resellerId, renewPrice);
        if (!affordRenew.ok) {
          const status = affordRenew.error === "insufficient_balance" ? 402 : 403;
          if (affordRenew.error === "insufficient_balance") {
            await emitPaymentFailedWebhook(auth, resellerId, {
              action: "renew",
              serviceId: vds.id,
              required: affordRenew.required,
              available: affordRenew.available,
            });
          }
          res.status(status).json({
            ok: false,
            error: affordRenew.error,
            required: affordRenew.required,
            available: affordRenew.available,
            ...requestMeta(req),
          });
          return;
        }
        const days = parseMonthsToDays(months);
        const base = Math.max(Date.now(), new Date(vds.expireAt).getTime());
        const newExpire = new Date(base + days * 24 * 60 * 60 * 1000);
        const tx = await options.dataSource.transaction(async (em) => {
          const debit = await debitResellerBalance(em, resellerId, renewPrice);
          if (!debit.ok) {
            return { kind: "billing_failed" as const, error: debit.error, required: debit.required, available: debit.available };
          }
          vds.expireAt = newExpire;
          vds.payDayAt = null;
          vds.managementLocked = false;
          const row = await em.save(vds);
          await recordResellerWalletDebit(em, resellerId, renewPrice, debit.user.balance, {
            type: "service_renew",
            serviceId: row.id,
            vmid: row.vdsId,
            detail: `${months}m`,
          });
          return { kind: "saved" as const, saved: row };
        });
        if (tx.kind === "billing_failed") {
          res.status(402).json({
            ok: false,
            error: tx.error,
            required: tx.required,
            available: tx.available,
            ...requestMeta(req),
          });
          return;
        }
        await emit("service_renewed", { months });
        res.json({ ok: true, item: mapService(tx.saved) });
        return;
      }
      if (action === "reinstall") {
        const bodyParsed = parseBody(actionReinstallSchema, req.body ?? {});
        if (!bodyParsed.ok) {
          res.status(400).json({ ok: false, error: bodyParsed.error, ...requestMeta(req) });
          return;
        }
        const reinstall = await performServiceReinstall(options, vds, bodyParsed.data);
        if (!reinstall.ok) {
          const status =
            reinstall.error === "ssh_key_not_supported" || reinstall.error === "ssh_key_apply_failed"
              ? 501
              : 502;
          res.status(status).json({ ok: false, error: reinstall.error, ...requestMeta(req) });
          return;
        }
        await vdsRepo.save(vds);
        await emit("service_reinstall_started", { osId: vds.lastOsId });
        await emit("service_reinstall_completed");
        res.json({
          ok: true,
          credentials: { login: vds.login, password: reinstall.password },
          ...requestMeta(req),
        });
        return;
      }
      if (action === "delete") {
        await performResellerServiceDelete(options, auth, resellerId, vds, vdsRepo, req, res);
        return;
      }

      res.status(400).json({ ok: false, error: "unknown_action" });
    });
  });

  const port = Number.parseInt(process.env.RESELLER_API_PORT ?? "3003", 10) || 3003;
  app.listen(port, () => {
    console.log(`[Reseller API] listening on :${port}`);
  });
}
