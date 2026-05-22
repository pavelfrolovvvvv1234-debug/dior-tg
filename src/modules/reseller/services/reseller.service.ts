import type { Api } from "grammy";
import type { DataSource } from "typeorm";
import Reseller, { ResellerPlan, ResellerStatus } from "../../../entities/Reseller.js";
import ResellerApiKey, {
  ResellerApiKeyStatus,
  ResellerApiKeyType,
} from "../../../entities/ResellerApiKey.js";
import User from "../../../entities/User.js";
import { RESELLER_PLAN_LIMITS, RESELLER_API_BASE_URL } from "../domain/reseller-plans.js";
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
      `# Add to /root/dior-tg/.env (merge into JSON maps):`,
      `RESELLER_API_ENABLED=1`,
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
    reseller.webhookSecretHash = webhook.hash;
    reseller.ipWhitelist = [];
    reseller.lastActivityAt = new Date();

    await this.dataSource.getRepository(Reseller).save(reseller);

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

    return {
      apiKey: publicKey,
      prefix,
      envSnippet: `${this.buildEnvSnippet(resellerId, publicKey, "<unchanged>")}\n# Signing secret unchanged`,
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
      "<b>Limits</b>",
      `• Max VPS: ${limits.maxVps}`,
      `• API rate: ${limits.apiRatePerMinute}/min`,
      "",
      "Headers: <code>x-api-key</code>, optional HMAC <code>x-signature</code>, <code>x-timestamp</code>, <code>x-nonce</code>",
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

export { slugifyResellerId };
