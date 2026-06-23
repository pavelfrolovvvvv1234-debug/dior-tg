import crypto from "crypto";
import type { Api } from "grammy";
import type { DataSource } from "typeorm";
import Reseller, { ResellerPlan, ResellerStatus } from "../../../entities/Reseller.js";
import ResellerApiKey, {
  ResellerApiKeyStatus,
  ResellerApiKeyType,
} from "../../../entities/ResellerApiKey.js";
import User, { Role, UserStatus } from "../../../entities/User.js";
import { RESELLER_PLAN_LIMITS, RESELLER_API_BASE_URL } from "../domain/reseller-plans.js";
import { getResellerAuthRuntime } from "./reseller-auth-runtime.js";
import {
  generateApiKeyPair,
  generateReferralCode,
  generateSigningSecret,
  generateWebhookSecret,
} from "./reseller-crypto.js";
import { ResellerAuditService } from "./reseller-audit.service.js";
import {
  registerRuntimeApiKey,
  registerRuntimeSigningSecret,
  registerRuntimeWebhookSecret,
  reloadResellerAuthRuntime,
} from "./reseller-auth-runtime.js";

export type CreateResellerInput = {
  resellerId: string;
  telegramId?: number | null;
  telegramUsername?: string | null;
  displayName?: string | null;
  email?: string | null;
  company?: string | null;
  plan: ResellerPlan;
};

export type CreateResellerResult = {
  reseller: Reseller;
  apiKey: string;
  signingSecret: string;
  webhookSecret: string;
  referralCode: string;
  envSnippet: string;
};

export type RotateKeyResult = {
  apiKey: string;
  prefix: string;
  signingSecret: string;
  envSnippet: string;
};

function slugifyResellerId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return s.slice(0, 48) || `reseller_${Date.now()}`;
}

export class ResellerService {
  private readonly audit: ResellerAuditService;

  constructor(private readonly dataSource: DataSource) {
    this.audit = new ResellerAuditService(dataSource);
  }

  async findById(id: string): Promise<Reseller | null> {
    return this.dataSource.getRepository(Reseller).findOne({ where: { id } });
  }

  async findByTelegramId(telegramId: number): Promise<Reseller | null> {
    return this.dataSource.getRepository(Reseller).findOne({ where: { telegramId } });
  }

  async getActiveApiKeyPrefix(resellerId: string): Promise<string | null> {
    const row = await this.dataSource.getRepository(ResellerApiKey).findOne({
      where: { resellerId, status: ResellerApiKeyStatus.Active },
      order: { id: "DESC" },
    });
    return row?.keyPrefix ?? null;
  }

  /**
   * Create or repair a reseller profile for a legacy partner id (VPS tagged in DB, no resellers row).
   */
  async ensureLegacyProfile(
    resellerId: string,
    telegramUsername?: string | null
  ): Promise<{
    reseller: Reseller;
    created: boolean;
    signingSecret: string;
    newApiKey?: string;
  }> {
    const id = slugifyResellerId(resellerId);
    const limits = RESELLER_PLAN_LIMITS[ResellerPlan.Starter];
    const repo = this.dataSource.getRepository(Reseller);
    let reseller = await repo.findOne({ where: { id } });
    let created = false;

    const username = (telegramUsername ?? id).trim().replace(/^@/, "").toLowerCase();
    const userRepo = this.dataSource.getRepository(User);
    let botUser = await userRepo.findOne({ where: { telegramUsername: username } });
    if (!botUser) {
      const rows = await userRepo
        .createQueryBuilder("u")
        .where("LOWER(u.telegramUsername) = LOWER(:username)", { username })
        .getMany();
      botUser = rows[0] ?? null;
    }

    const signing = generateSigningSecret();
    const webhook = generateWebhookSecret();

    if (reseller) {
      if (botUser && !reseller.telegramId) reseller.telegramId = botUser.telegramId;
      if (!reseller.telegramUsername) reseller.telegramUsername = username;
      if (!reseller.apiSigningSecret?.trim()) {
        reseller.apiSigningSecret = signing.raw;
        reseller.signingSecretHash = signing.hash;
      }
      if (!reseller.referralCode) reseller.referralCode = generateReferralCode(id);
      reseller.status = ResellerStatus.Active;
      await repo.save(reseller);
    } else {
      created = true;
      reseller = repo.create({
        id,
        displayName: `@${username}`,
        telegramId: botUser?.telegramId ?? null,
        telegramUsername: username,
        email: null,
        company: null,
        status: ResellerStatus.Active,
        plan: ResellerPlan.Starter,
        profitPercent: limits.profitPercent,
        maxVps: limits.maxVps,
        apiRatePerMinute: limits.apiRatePerMinute,
        referralCode: generateReferralCode(id),
        signingSecretHash: signing.hash,
        apiSigningSecret: signing.raw,
        webhookSecretHash: webhook.hash,
        webhookSigningSecret: webhook.raw,
        ipWhitelist: [],
        lastActivityAt: new Date(),
      });
      await repo.save(reseller);
    }

    let newApiKey: string | undefined;
    const keyRepo = this.dataSource.getRepository(ResellerApiKey);
    const activeKey = await keyRepo.findOne({
      where: { resellerId: id, status: ResellerApiKeyStatus.Active },
    });
    if (!activeKey) {
      const { publicKey, prefix, hash } = generateApiKeyPair();
      const row = new ResellerApiKey();
      row.resellerId = id;
      row.keyType = ResellerApiKeyType.Production;
      row.status = ResellerApiKeyStatus.Active;
      row.keyPrefix = prefix;
      row.keyHash = hash;
      row.rateLimitPerMinute = reseller.apiRatePerMinute || limits.apiRatePerMinute;
      row.scopes = ["services:read", "services:write"];
      await keyRepo.save(row);
      registerRuntimeApiKey(id, publicKey);
      newApiKey = publicKey;
    }

    const signingSecret = reseller.apiSigningSecret?.trim() ?? signing.raw;
    registerRuntimeSigningSecret(id, signingSecret);
    await reloadResellerAuthRuntime(this.dataSource);

    return { reseller, created, signingSecret, newApiKey };
  }

  formatPartnerApiHelp(reseller: Reseller, keyPrefix: string | null): string {
    const keyOnly = getResellerAuthRuntime().apiKeyOnly[reseller.id] === true;
    const signing = reseller.apiSigningSecret?.trim();
    const keyLine = keyPrefix
      ? `API key prefix: <code>${keyPrefix}…</code> (full key shown once at issue — use admin Rotate if lost)`
      : "API key: not issued yet — ask support to rotate key";

    if (keyOnly) {
      return [
        "<b>DiorHost Reseller API</b>",
        "",
        `Partner ID: <code>${reseller.id}</code>`,
        keyLine,
        "",
        "<b>Auth:</b> header <code>x-api-key</code> only (HMAC not required for your account).",
        "Balance, rate limits and VPS quota still apply.",
        "",
        `Base: ${RESELLER_API_BASE_URL}`,
        `Docs: ${RESELLER_API_BASE_URL}/reseller/docs`,
        "",
        "Billing: top up balance in this bot (Profile → Deposit).",
      ].join("\n");
    }

    return [
      "<b>DiorHost Reseller API</b>",
      "",
      `Partner ID: <code>${reseller.id}</code>`,
      keyLine,
      signing
        ? `Signing secret (HMAC): <code>${signing}</code>`
        : "Signing secret: missing — contact @diorhost support",
      "",
      `<b>Auth</b> (required on every request):`,
      "<code>x-api-key</code>, <code>x-timestamp</code> (unix sec), <code>x-nonce</code> (UUID), <code>x-signature</code>",
      "",
      "<b>GET signature</b> (e.g. /reseller/v1/services):",
      "<code>x-signature = hex(HMAC_SHA256(signing_secret, \"&lt;timestamp&gt;.\"))</code>",
      "Body is empty — note the trailing dot after timestamp.",
      "",
      `Base: ${RESELLER_API_BASE_URL}`,
      `Docs: ${RESELLER_API_BASE_URL}/reseller/docs`,
      "",
      "Billing: top up balance in this bot (Profile → Deposit).",
    ].join("\n");
  }

  async listAll(): Promise<Reseller[]> {
    return this.dataSource.getRepository(Reseller).find({
      order: { createdAt: "DESC" },
    });
  }

  async resolveTelegramInput(input: string): Promise<{
    telegramId: number | null;
    telegramUsername: string | null;
    suggestedId: string;
  }> {
    const trimmed = input.trim();
    if (/^\d{5,20}$/.test(trimmed)) {
      const telegramId = Number.parseInt(trimmed, 10);
      return {
        telegramId,
        telegramUsername: null,
        suggestedId: slugifyResellerId(`tg_${telegramId}`),
      };
    }
    const username = trimmed.replace(/^@/, "").toLowerCase();
    const user = await this.dataSource.getRepository(User).findOne({
      where: { telegramUsername: username },
    });
    if (user) {
      return {
        telegramId: user.telegramId,
        telegramUsername: username,
        suggestedId: slugifyResellerId(username),
      };
    }
    return {
      telegramId: null,
      telegramUsername: username,
      suggestedId: slugifyResellerId(username),
    };
  }

  buildEnvSnippet(resellerId: string, apiKey: string, signingSecret: string): string {
    return [
      `# Credentials are stored in the database — .env JSON maps are optional.`,
      `RESELLER_API_ENABLED=1`,
      `# Optional legacy env: RESELLER_API_KEYS_JSON / RESELLER_API_SIGNING_SECRETS_JSON`,
      `# "${resellerId}": "${apiKey}"`,
      `# signing: "${signingSecret}"`,
    ].join("\n");
  }

  async createReseller(
    input: CreateResellerInput,
    actor: { userId: number; telegramId: number }
  ): Promise<CreateResellerResult> {
    const id = slugifyResellerId(input.resellerId);
    const existing = await this.findById(id);
    if (existing) {
      throw new Error("reseller_exists");
    }

    const limits = RESELLER_PLAN_LIMITS[input.plan];
    const { publicKey, secretKey, prefix, hash } = generateApiKeyPair();
    const signing = generateSigningSecret();
    const webhook = generateWebhookSecret();
    const referralCode = generateReferralCode(id);

    const reseller = new Reseller();
    reseller.id = id;
    reseller.displayName = input.displayName ?? input.telegramUsername ?? id;
    reseller.telegramId = input.telegramId ?? null;
    reseller.telegramUsername = input.telegramUsername ?? null;
    reseller.email = input.email ?? null;
    reseller.company = input.company ?? null;
    reseller.status = ResellerStatus.Active;
    reseller.plan = input.plan;
    reseller.profitPercent = limits.profitPercent;
    reseller.maxVps = limits.maxVps;
    reseller.apiRatePerMinute = limits.apiRatePerMinute;
    reseller.referralCode = referralCode;
    reseller.signingSecretHash = signing.hash;
    reseller.apiSigningSecret = signing.raw;
    reseller.webhookSecretHash = webhook.hash;
    reseller.webhookSigningSecret = webhook.raw;
    reseller.ipWhitelist = [];
    reseller.lastActivityAt = new Date();

    await this.dataSource.getRepository(Reseller).save(reseller);

    if (reseller.telegramId) {
      const userRepo = this.dataSource.getRepository(User);
      let botUser = await userRepo.findOneBy({ telegramId: reseller.telegramId });
      if (!botUser) {
        botUser = userRepo.create({
          telegramId: reseller.telegramId,
          telegramUsername: reseller.telegramUsername,
          role: Role.User,
          status: UserStatus.User,
          lang: "en",
          isBanned: false,
          balance: 0,
          referralBalance: 0,
        });
        await userRepo.save(botUser);
      } else if (reseller.telegramUsername && !botUser.telegramUsername) {
        botUser.telegramUsername = reseller.telegramUsername;
        await userRepo.save(botUser);
      }
    }

    const apiKeyRow = new ResellerApiKey();
    apiKeyRow.resellerId = id;
    apiKeyRow.keyType = ResellerApiKeyType.Production;
    apiKeyRow.status = ResellerApiKeyStatus.Active;
    apiKeyRow.keyPrefix = prefix;
    apiKeyRow.keyHash = hash;
    apiKeyRow.rateLimitPerMinute = limits.apiRatePerMinute;
    apiKeyRow.scopes = ["services:read", "services:write"];
    await this.dataSource.getRepository(ResellerApiKey).save(apiKeyRow);

    registerRuntimeApiKey(id, publicKey);
    registerRuntimeSigningSecret(id, signing.raw);
    registerRuntimeWebhookSecret(id, webhook.raw);
    await reloadResellerAuthRuntime(this.dataSource);

    await this.audit.log({
      resellerId: id,
      actorUserId: actor.userId,
      actorTelegramId: actor.telegramId,
      action: "reseller.created",
      detail: `plan=${input.plan}`,
    });
    await this.audit.log({
      resellerId: id,
      actorUserId: actor.userId,
      actorTelegramId: actor.telegramId,
      action: "api_key.generated",
      targetType: "api_key",
      targetId: String(apiKeyRow.id),
    });

    const envSnippet = this.buildEnvSnippet(id, publicKey, signing.raw);

    return {
      reseller,
      apiKey: publicKey,
      signingSecret: signing.raw,
      webhookSecret: webhook.raw,
      referralCode,
      envSnippet,
    };
  }

  async rotateApiKey(
    resellerId: string,
    actor: { userId: number; telegramId: number }
  ): Promise<RotateKeyResult> {
    const reseller = await this.findById(resellerId);
    if (!reseller) throw new Error("reseller_not_found");

    await this.dataSource.getRepository(ResellerApiKey).update(
      { resellerId, status: ResellerApiKeyStatus.Active },
      { status: ResellerApiKeyStatus.Revoked }
    );

    const { publicKey, prefix, hash } = generateApiKeyPair();
    const row = new ResellerApiKey();
    row.resellerId = resellerId;
    row.keyType = ResellerApiKeyType.Production;
    row.status = ResellerApiKeyStatus.Active;
    row.keyPrefix = prefix;
    row.keyHash = hash;
    row.rateLimitPerMinute = reseller.apiRatePerMinute;
    row.scopes = ["services:read", "services:write"];
    await this.dataSource.getRepository(ResellerApiKey).save(row);

    registerRuntimeApiKey(resellerId, publicKey);
    await reloadResellerAuthRuntime(this.dataSource);

    await this.audit.log({
      resellerId,
      actorUserId: actor.userId,
      actorTelegramId: actor.telegramId,
      action: "api_key.rotated",
      targetType: "api_key",
      targetId: String(row.id),
    });

    const signingSecret = reseller.apiSigningSecret?.trim() ?? "";
    return {
      apiKey: publicKey,
      prefix,
      signingSecret,
      envSnippet: this.buildEnvSnippet(
        resellerId,
        publicKey,
        signingSecret || "<stored in database>"
      ),
    };
  }

  async setStatus(
    resellerId: string,
    status: ResellerStatus,
    actor: { userId: number; telegramId: number }
  ): Promise<void> {
    await this.dataSource.getRepository(Reseller).update({ id: resellerId }, { status });
    if (status === ResellerStatus.Suspended) {
      await this.dataSource.getRepository(ResellerApiKey).update(
        { resellerId, status: ResellerApiKeyStatus.Active },
        { status: ResellerApiKeyStatus.Suspended }
      );
    }
    await reloadResellerAuthRuntime(this.dataSource);
    await this.audit.log({
      resellerId,
      actorUserId: actor.userId,
      actorTelegramId: actor.telegramId,
      action: `reseller.status.${status}`,
    });
  }

  formatOnboardingMessage(result: CreateResellerResult): string {
    const r = result.reseller;
    const limits = RESELLER_PLAN_LIMITS[r.plan];
    return [
      "🎉 <b>Welcome to DiorHost Reseller Program</b>",
      "",
      `Partner ID: <code>${r.id}</code>`,
      `Plan: <b>${r.plan}</b>`,
      `Referral: <code>${result.referralCode}</code>`,
      "",
      "<b>API credentials</b> (store securely — shown once):",
      `Key: <code>${result.apiKey}</code>`,
      `Signing: <code>${result.signingSecret}</code>`,
      `Webhook secret: <code>${result.webhookSecret}</code>`,
      "",
      "<b>Endpoints</b>",
      `Base: ${RESELLER_API_BASE_URL}`,
      `Docs: ${RESELLER_API_BASE_URL}/reseller/docs`,
      `OpenAPI: ${RESELLER_API_BASE_URL}/reseller/openapi.json`,
      `Health: ${RESELLER_API_BASE_URL}/reseller/health`,
      "",
      "<b>Billing</b>",
      "Top up balance in @diorhost_bot (Profile → Deposit) on <b>this Telegram account</b>.",
      "Each API VPS create/renew charges your bot wallet (same prices as retail).",
      "",
      "Headers (all required): <code>x-api-key</code>, <code>x-timestamp</code>, <code>x-nonce</code>, <code>x-signature</code> (HMAC-SHA256 over <code>&lt;timestamp&gt;.&lt;raw_body&gt;</code>; GET uses empty body → <code>&lt;timestamp&gt;.</code>)",
      "",
      "Support: @diorhost",
    ].join("\n");
  }

  async sendOnboardingDm(botApi: Api, telegramId: number, html: string): Promise<boolean> {
    try {
      await botApi.sendMessage(telegramId, html, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export function generateAutoResellerId(): string {
  return `partner_${crypto.randomBytes(4).toString("hex")}`;
}

export { slugifyResellerId };
