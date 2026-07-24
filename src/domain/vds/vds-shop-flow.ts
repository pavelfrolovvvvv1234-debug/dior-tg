/**
 * Premium multi-step VPS/VDS purchase UI (type → tier → plans → card → OS / buy).
 */

import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { SessionData } from "../../shared/types/session.js";
import prices from "../../helpers/prices.js";
import { getAppDataSource } from "../../infrastructure/db/datasource.js";
import User, { Role } from "../../entities/User.js";
import VirtualDedicatedServer, { generatePassword, generateRandomName } from "../../entities/VirtualDedicatedServer.js";
import {
  assertVdsCatalogLength,
  STANDARD_VPS_LOCATION_KEYS,
  VDS_INDEX_TIER,
  VDS_SHOP_PAGE_SIZE,
  type VpsShopTier,
} from "./vds-shop-config.js";
import { showTopupForMissingAmount } from "../../helpers/deposit-money.js";
import { showProgress } from "../../ui/utils/animations.js";
import { buildVpsReadyCopyKeyboard } from "../../ui/utils/copy-keyboard.js";
import { DedicatedProvisioningService } from "../dedicated/DedicatedProvisioningService.js";
import { DedicatedOrderPaymentStatus } from "../../entities/DedicatedServerOrder.js";
import { isMissingFluentTranslation } from "../../shared/i18n/fluent-missing.js";
import { notifyStaffChats } from "../../helpers/notifier.js";
import { DEDICATED_LOCATION_KEYS, DEDICATED_OS_KEYS } from "../dedicated/dedicated-shop-config.js";
import { getOrderPriceForUser } from "../../shared/pricing/order-discount.js";
import { getProxmoxTemplateMap, isProxmoxEnabled } from "../../app/config.js";
import { ProxmoxProvider } from "../../infrastructure/vmmanager/ProxmoxProvider.js";
import ms from "../../lib/multims.js";
import {
  buildPremiumVpsReadyHtml,
  escapeHtml,
  getVpsCpuModelForRate as getVpsCpuModel,
  type PremiumVpsReadyPayload,
} from "./vps-onboarding-messages.js";
import { resolveVdsLoginForOs } from "../../shared/vmm-os-display.js";
import { canAutoProvisionVpsAtLocation } from "../../shared/proxmox/location-targets.js";
import { Logger } from "../../app/logger.js";
import {
  canProvisionHostVdsNow,
  getHostVdsLocationProvisionHints,
  getHostVdsShopLocationKeys,
  isPlanSelectable,
  isLocationSelectable,
  resolveLocationStatus,
  resolvePlanAtLocationStatus,
  resolvePlanGlobalStatus,
  useHostVdsStockUi,
  type HostVdsStockStatus,
} from "../../infrastructure/hostvds/hostvds-catalog.js";
import { HostVdsApiError } from "../../infrastructure/hostvds/openstack-client.js";
import {
  isVpsMarketingCpuKey,
  resolveVpsMarketingCpuLabel,
  defaultVpsMarketingCpuLabel,
  VPS_MARKETING_CPU_DEFAULT,
  VPS_MARKETING_CPU_OPTIONS,
  type VpsMarketingCpuKey,
} from "./vps-cpu-marketing.js";

/** Prefer marketing CPU for bulletproof checkout; otherwise catalog model. */
function resolveShopCpuModel(
  session: SessionData,
  rate: { cpuModel?: string }
): string {
  if (session.other.vdsRate?.bulletproof) {
    return (
      resolveVpsMarketingCpuLabel(session.other.vdsRate.shopCpuKey) ??
      defaultVpsMarketingCpuLabel()
    );
  }
  return getVpsCpuModel(rate);
}

const TIER_ORDER: VpsShopTier[] = ["start", "standard", "performance", "enterprise"];

/** Remove the OS-picker message so the hint text does not stay above provisioning / ready. */
async function deleteVpsOsPickerMessage(ctx: AppContext): Promise<void> {
  const chatId = ctx.chat?.id;
  const msg = ctx.callbackQuery?.message;
  if (!chatId || !msg || !("message_id" in msg)) return;
  await ctx.api.deleteMessage(chatId, msg.message_id).catch(() => {});
}

/** Proxmox createVM waits on clone/resize tasks (minutes); ISP VMManager is fast — keep a short safety cap there only. */
function vpsCreateVmRaceTimeoutMs(): number {
  return isProxmoxEnabled() ? 0 : 30_000;
}

const isUniqueVdsIdConflictError = (error: unknown): boolean => {
  const message = String((error as { message?: string })?.message ?? error ?? "");
  return (
    message.includes("UNIQUE constraint failed: vdslist.vdsId") ||
    message.includes("duplicate key value violates unique constraint") ||
    message.includes("vdslist_vdsid_key")
  );
};

function appendVpsShopPrimeAndBack(kb: InlineKeyboard, ctx: AppContext, backData: string): void {
  kb.text(ctx.t("prime-discount-vds"), "vsh:prime").row();
  kb.text(ctx.t("button-back"), backData).row();
}

function appendVpsShopBackOnly(kb: InlineKeyboard, ctx: AppContext, backData: string): void {
  kb.text(ctx.t("button-back"), backData).row();
}

const renderMultiline = (text: string): string => text.replace(/\\n/g, "\n");
const VPS_LOCATION_AUTO_ONLY_KEY = "nl-amsterdam";

/** Users with an in-flight Proxmox provision (prevents double-charge). */
const vpsProvisioningUserIds = new Set<number>();
/** Sync lock by Telegram id — set before any await to block double-tap races. */
const vpsProvisioningTelegramIds = new Set<number>();

function resetVpsShopCheckoutSession(session: SessionData): void {
  ensureVpsShopSession(session);
  session.other.vdsRate.selectedRateId = -1;
  session.other.vdsRate.selectedOs = -1;
  session.other.vdsRate.pendingOsKey = null;
  session.other.vdsRate.shopCpuKey = null;
  if (session.other.dedicatedOrder) {
    session.other.dedicatedOrder.step = "idle";
    session.other.dedicatedOrder.selectedLocationKey = undefined;
  }
}

function vpsLocationLabel(ctx: AppContext, locationKey: string): string {
  const vpsKey = `vps-location-${locationKey}`;
  const vpsLabel = ctx.t(vpsKey as "vps-location-ru");
  if (!isMissingFluentTranslation(vpsLabel, vpsKey)) return vpsLabel;
  const dedKey = `dedicated-location-${locationKey}`;
  const dedLabel = ctx.t(dedKey as "dedicated-location-nl-amsterdam");
  if (!isMissingFluentTranslation(dedLabel, dedKey)) return dedLabel;
  return locationKey;
}

function getAllowedVpsLocationKeys(
  rate: { cpu?: number; ram?: number; ssd?: number },
  bulletproof: boolean
): string[] {
  if (!bulletproof) {
    if (useHostVdsStockUi()) return getHostVdsShopLocationKeys();
    return [...STANDARD_VPS_LOCATION_KEYS];
  }
  const cpu = Number(rate.cpu ?? 0);
  const ram = Number(rate.ram ?? 0);
  const ssd = Number(rate.ssd ?? 0);
  const isGlobalGeoTier = cpu >= 4 && ram >= 8 && ssd >= 80;
  if (!isGlobalGeoTier) return [VPS_LOCATION_AUTO_ONLY_KEY];
  return [...DEDICATED_LOCATION_KEYS];
}

function stockStatusLabel(ctx: AppContext, status: HostVdsStockStatus): string {
  if (status === "sold_out") return ctx.t("hostvds-status-sold-out");
  if (status === "unavailable") return ctx.t("hostvds-status-unavailable");
  return ctx.t("hostvds-status-available");
}

function hostVdsLocationButtonLabel(
  ctx: AppContext,
  locationKey: string,
  rateId: number
): { label: string; selectable: boolean } {
  const base = vpsLocationLabel(ctx, locationKey);
  if (!useHostVdsStockUi()) return { label: base, selectable: true };
  const status = resolvePlanAtLocationStatus(locationKey, rateId);
  if (status === "available") {
    return { label: `✅ ${base}`, selectable: true };
  }
  return {
    label: `🔒 ${base} · ${stockStatusLabel(ctx, status)}`,
    selectable: false,
  };
}

async function createVpsOrderTicket(
  ctx: AppContext,
  rateId: number,
  locationKey?: string,
  osKey?: string
): Promise<void> {
  const session = await ctx.session;
  ensureVpsShopSession(session);
  const pricesList = await prices();
  const rate = pricesList.virtual_vds?.[rateId];
  if (!rate) {
    await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
    return;
  }

  const dataSource = ctx.appDataSource ?? (await getAppDataSource());
  const usersRepo = dataSource.getRepository(User);
  const user = await usersRepo.findOneBy({ id: session.main.user.id });
  if (!user) {
    await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
    return;
  }

  const basePrice = session.other.vdsRate.bulletproof ? rate.price.bulletproof : rate.price.default;
  const price = await getOrderPriceForUser(dataSource, user.id, basePrice);
  if (user.balance < price) {
    await showTopupForMissingAmount(ctx, price - user.balance);
    return;
  }

  const { deductUserBalance, refundUserBalance } = await import(
    "../../shared/billing/balance-ops.js"
  );
  let deducted = false;
  try {
    const charged = await deductUserBalance(dataSource, user.id, price);
    user.balance = charged.balance;
    deducted = true;
    session.main.user.balance = user.balance;

    const provisioningService = new DedicatedProvisioningService(dataSource);
    const idempotencyKey = ctx.callbackQuery?.id
      ? `tgcb:${ctx.callbackQuery.id}`
      : `vps:${session.main.user.id}:${rateId}:${Date.now()}`;
    const category = session.other.vdsRate.bulletproof ? "bulletproof" : "standard";
    const locationLabel = locationKey ? vpsLocationLabel(ctx, locationKey) : "N/A";
    const osLabel = osKey ? ctx.t(`dedicated-os-${osKey}` as any) : "N/A";

    const buyerIsStaff = user.role === Role.Admin || user.role === Role.Moderator;
    const created = await provisioningService.createPaidOrderAndTicket({
      userId: user.id,
      telegramUserId: ctx.from?.id ?? null,
      telegramUsername: ctx.from?.username ?? null,
      fullName: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || null,
      customerLanguage: session.main.locale,
      paymentAmount: price,
      paymentMethod: "balance",
      paymentStatus: DedicatedOrderPaymentStatus.PAID,
      balanceUsedAmount: price,
      idempotencyKey,
      excludeFromUserStats: buyerIsStaff,
      config: {
        productId: `vps-${rateId}`,
        productName: rate.name ?? `VPS #${rateId}`,
        category,
        cpuCores: Number(rate.cpu ?? 0) || null,
        ram: rate.ram != null ? String(rate.ram) : null,
        storageType: "SSD",
        storageSize: rate.ssd != null ? `${rate.ssd} GB` : null,
        uplinkSpeed: rate.network != null ? `${rate.network}` : null,
        locationKey: locationKey ?? null,
        locationLabel,
        osKey: osKey ?? null,
        osLabel,
        cpuModel: resolveShopCpuModel(session, rate as { cpuModel?: string }),
        ddosProtection: session.other.vdsRate.bulletproof ? "enhanced" : "standard",
        deploymentNotes: session.other.vdsRate.bulletproof
          ? `Bulletproof VPS — staff provisioning if auto-deploy unavailable. CPU label: ${resolveShopCpuModel(session, rate as { cpuModel?: string })} (marketing).`
          : "Standard VPS — manual ticket provisioning (RU/BY/AB only).",
      },
    });

    const order = created.order;
    const ticket = created.ticket;

    const buyerText = renderMultiline(
      ctx.t("dedicated-provisioning-ticket-created", {
        ticketId: ticket.id,
        orderId: order.id,
        serviceName: escapeHtml(rate.name ?? `VPS #${rateId}`),
        location: escapeHtml(locationLabel),
        os: escapeHtml(osLabel),
      })
    );
    await ctx.reply(buyerText, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    resetVpsShopCheckoutSession(session);

    if (!buyerIsStaff) {
      const staffText = renderMultiline(
        ctx.t("provisioning-staff-notification", {
          ticketId: ticket.id,
          orderId: order.id,
          userId: user.id,
          amount: price,
          serviceName: rate.name ?? `VPS #${rateId}`,
          location: locationLabel,
          os: osLabel,
        })
      );
      const staffKeyboard = new InlineKeyboard()
        .text(ctx.t("button-open"), `prov_view_${ticket.id}`)
        .text(ctx.t("button-close"), `ticket_notify_close_${ticket.id}`);
      await notifyStaffChats(ctx.api, dataSource, {
        text: staffText,
        replyMarkup: staffKeyboard,
        contextLabel: `provisioning ticket #${ticket.id} (VPS order #${order.id})`,
      });
    }
  } catch (error: any) {
    if (deducted) {
      try {
        const refunded = await refundUserBalance(dataSource, user.id, price);
        session.main.user.balance = refunded.balance;
      } catch {
        // ignore rollback failure, original error is still returned below
      }
    }
    await ctx
      .reply(ctx.t("error-unknown", { error: error?.message || "Unknown error" }), { parse_mode: "HTML" })
      .catch(() => {});
  }
}

async function createVpsOrderDirect(
  ctx: AppContext,
  rateId: number,
  locationKey?: string,
  osKey?: string
): Promise<boolean> {
  const telegramId = Number(ctx.from?.id ?? 0);
  if (telegramId > 0) {
    if (vpsProvisioningTelegramIds.has(telegramId)) {
      await ctx
        .reply("⏳ Уже идёт создание VPS — дождитесь завершения или отправьте /start.", {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        })
        .catch(() => {});
      return true;
    }
    vpsProvisioningTelegramIds.add(telegramId);
  }

  try {
  const session = await ctx.session;
  ensureVpsShopSession(session);
  const userId = session.main.user.id;
  if (vpsProvisioningUserIds.has(userId)) {
    await ctx
      .reply("⏳ Уже идёт создание VPS — дождитесь завершения или отправьте /start.", {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      })
      .catch(() => {});
    return true;
  }
  vpsProvisioningUserIds.add(userId);
  try {
    const pricesList = await prices();
    const rate = pricesList.virtual_vds?.[rateId];
    if (!rate) {
      await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
      return false;
    }
    if (!osKey) {
      await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
      return false;
    }

    const templateMap = getProxmoxTemplateMap();
    const osId = Number(templateMap[osKey] ?? 0);
    if (!Number.isFinite(osId) || osId <= 0) {
      await ctx
        .reply("Эта ОС пока не подключена для авто-развёртывания в Proxmox.", { parse_mode: "HTML" })
        .catch(() => {});
      return false;
    }

    const dataSource = ctx.appDataSource ?? (await getAppDataSource());
    const usersRepo = dataSource.getRepository(User);
    const vdsRepo = dataSource.getRepository(VirtualDedicatedServer);
    const user = await usersRepo.findOneBy({ id: session.main.user.id });
    if (!user) {
      await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
      return false;
    }

    const basePrice = session.other.vdsRate.bulletproof ? rate.price.bulletproof : rate.price.default;
    const price = await getOrderPriceForUser(dataSource, user.id, basePrice);
    if (user.balance < price) {
      await showTopupForMissingAmount(ctx, price - user.balance);
      return true;
    }

    let deducted = false;
    const chatId = ctx.chat?.id;
    const waitText = ctx.t("vds-provisioning-wait");
    const waitMessage = chatId
      ? await ctx
          .reply(waitText, {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
          })
          .catch(() => undefined)
      : undefined;

    const touchProgress = async (progress: number): Promise<void> => {
      if (!waitMessage || !chatId) return;
      await showProgress(ctx, waitMessage.message_id, waitText, progress).catch(() => {});
    };

    try {
    await touchProgress(0.06);
    user.balance -= price;
    await usersRepo.save(user);
    deducted = true;
    session.main.user.balance = user.balance;

    const maxProvisionAttempts = 3;
    let savedVds: VirtualDedicatedServer | null = null;
    let savedIp = "0.0.0.0";
    let lastProvisionError: unknown;
    let lastVmName = "";
    let lastVmDisplayName = "";

    for (let attempt = 1; attempt <= maxProvisionAttempts; attempt++) {
      await touchProgress(0.12 + (attempt - 1) * 0.08);
      const generatedPassword = generatePassword(12);
      const vmName = generateRandomName(13);
      const cpuLabel = resolveShopCpuModel(session, rate as { cpuModel?: string });
      const comment = `UserID:${user.id},${rate.name},loc:${locationKey ?? "n/a"},os:${osKey},cpu:${cpuLabel},try:${attempt}`;
      const createPromise = ctx.vmmanager.createVM(
        vmName,
        generatedPassword,
        rate.cpu,
        rate.ram,
        osId,
        comment,
        rate.ssd,
        1,
        rate.network,
        rate.network
      );
      const raceMs = vpsCreateVmRaceTimeoutMs();
      const vmResult =
        raceMs > 0
          ? await Promise.race([
              createPromise,
              new Promise<false>((resolve) => setTimeout(() => resolve(false), raceMs)),
            ])
          : await createPromise;
      if (!vmResult) {
        const proxmoxDetail =
          ctx.vmmanager instanceof ProxmoxProvider
            ? ctx.vmmanager.getLastCreateVmFailure()
            : null;
        lastProvisionError = new Error(proxmoxDetail ?? "createVM returned false");
        continue;
      }

      await touchProgress(0.52);

      let vmInfo: any | undefined;
      for (let i = 0; i < 6; i++) {
        vmInfo = await ctx.vmmanager.getInfoVM(vmResult.id);
        if (vmInfo) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      let ipv4Addrs: { list: Array<{ ip_addr: string }> } | undefined;
      for (let i = 0; i < 20; i++) {
        ipv4Addrs = await ctx.vmmanager.getIpv4AddrVM(vmResult.id);
        const ipCandidate = ipv4Addrs?.list?.[0]?.ip_addr;
        if (ipCandidate && ipCandidate !== "0.0.0.0" && ipCandidate !== "127.0.0.1") break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      const ip = ipv4Addrs?.list?.[0]?.ip_addr ?? "0.0.0.0";

      await touchProgress(0.78);

      const vds = new VirtualDedicatedServer();
      vds.vdsId = vmResult.id;
      vds.login = resolveVdsLoginForOs({ osKey, osId });
      vds.password = generatedPassword;
      vds.ipv4Addr = ip;
      vds.cpuCount = rate.cpu;
      vds.networkSpeed = rate.network;
      vds.isBulletproof = session.other.vdsRate.bulletproof;
      vds.payDayAt = null;
      vds.ramSize = rate.ram;
      vds.diskSize = rate.ssd;
      vds.lastOsId = osId;
      vds.rateName = rate.name;
      vds.expireAt = new Date(Date.now() + ms("30d"));
      vds.targetUserId = user.id;
      vds.renewalPrice = price;
      vds.autoRenewEnabled = true;
      vds.adminBlocked = false;
      vds.managementLocked = false;
      vds.extraIpv4Count = 0;
      try {
        savedVds = await vdsRepo.save(vds);
        savedIp = ip;
        lastVmName = vmName;
        lastVmDisplayName = (vmInfo?.name && String(vmInfo.name).trim()) || vmName;
        break;
      } catch (error) {
        if (isUniqueVdsIdConflictError(error) && attempt < maxProvisionAttempts) {
          lastProvisionError = error;
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
        throw error;
      }
    }

    if (!savedVds) {
      const reason = String((lastProvisionError as { message?: string })?.message ?? "").trim();
      if (
        reason.includes("createVM returned false") ||
        reason.includes("Proxmox createVM") ||
        reason.includes("no free IPv4") ||
        reason.includes("clone failed")
      ) {
        throw new Error(
          reason && !reason.includes("createVM returned false")
            ? `Не удалось создать VPS: ${reason}`
            : "Не удалось создать VPS на стороне Proxmox (clone/resize/задача). Проверь логи бота и задачи в Proxmox."
        );
      }
      const baseMessage = "Failed to save VPS after retrying VMID conflicts";
      throw new Error(reason ? `${baseMessage}: ${reason}` : baseMessage);
    }

    const regionLabel = locationKey
      ? ctx.t(`dedicated-location-${locationKey}` as any)
      : ctx.t("vps-premium-region-auto");
    const osLabel = ctx.t(`dedicated-os-${osKey}` as any);
    const payload: PremiumVpsReadyPayload = {
      vmName: lastVmDisplayName || lastVmName || `vm-${savedVds.vdsId}`,
      vdsId: savedVds.vdsId,
      regionLabel,
      planName: rate.name ?? `VPS #${rateId}`,
      cpu: rate.cpu,
      ramGb: rate.ram,
      diskGb: rate.ssd,
      networkMbps: rate.network,
      cpuModel: resolveShopCpuModel(session, rate as { cpuModel?: string }),
      osLabel,
      osKey,
      ipv4: savedIp,
      login: savedVds.login,
      password: savedVds.password,
    };
    const readyHtml = buildPremiumVpsReadyHtml(ctx, payload);
    if (waitMessage && chatId) {
      await ctx.api.deleteMessage(chatId, waitMessage.message_id).catch(() => {});
    }
    await ctx.reply(readyHtml, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: buildVpsReadyCopyKeyboard(ctx, payload),
    }).catch(() => {});

    void import("../../modules/automations/engine/event-bus.js").then(({ emit }) => {
      emit({
        event: "service.created",
        userId: user.id,
        serviceType: "vds",
        serviceId: savedVds.id,
        timestamp: new Date(),
      });
    });

    resetVpsShopCheckoutSession(session);
    return true;
  } catch (error: any) {
    if (waitMessage && chatId) {
      await ctx.api
        .editMessageText(chatId, waitMessage.message_id, ctx.t("vps-provisioning-failed"), {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        })
        .catch(() => {});
    }
    if (deducted) {
      try {
        user.balance += price;
        await usersRepo.save(user);
        session.main.user.balance = user.balance;
      } catch {
        // ignore rollback failure
      }
    }
    await ctx
      .reply(ctx.t("error-unknown", { error: error?.message || "Unknown error" }), { parse_mode: "HTML" })
      .catch(() => {});
    // Do not fall back to ticket flow after a failed auto-provision:
    // it can double-charge users and creates the illusion of "manual provisioning" for VPS.
    return true;
  }
  } finally {
    vpsProvisioningUserIds.delete(userId);
  }
  } finally {
    if (telegramId > 0) {
      vpsProvisioningTelegramIds.delete(telegramId);
    }
  }
}

async function showVpsLocationPicker(ctx: AppContext, rateId: number): Promise<void> {
  const session = await ctx.session;
  ensureVpsShopSession(session);
  session.other.vdsRate.selectedRateId = rateId;
  const pricesList = await prices();
  const rate = pricesList.virtual_vds?.[rateId];
  if (!rate) {
    await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
    return;
  }
  const bulletproof = session.other.vdsRate.bulletproof;
  const allowedLocationKeys = getAllowedVpsLocationKeys(rate, bulletproof);
  const kb = new InlineKeyboard();
  const stockUi = !bulletproof && useHostVdsStockUi();

  for (const key of allowedLocationKeys) {
    if (stockUi) {
      const { label, selectable } = hostVdsLocationButtonLabel(ctx, key, rateId);
      if (selectable) {
        kb.text(label, `vsh:loc:${key}`).row();
      } else {
        kb.text(label, `vsh:loc_na:${key}`).row();
      }
    } else {
      kb.text(vpsLocationLabel(ctx, key), `vsh:loc:${key}`).row();
    }
  }
  kb.text(ctx.t("button-back"), `vsh:card:${rateId}`).row();

  const title = stockUi
    ? ctx.t("hostvds-location-select-title")
    : ctx.t("dedicated-location-select-title");

  await ctx.editMessageText(title, {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

async function showVpsOsPicker(ctx: AppContext, rateId: number, locationKey: string): Promise<void> {
  const session = await ctx.session;
  ensureVpsShopSession(session);
  if (!session.other.dedicatedOrder) {
    session.other.dedicatedOrder = { step: "idle", requirements: undefined };
  }
  session.other.dedicatedOrder.selectedLocationKey = locationKey;
  session.other.vdsRate.selectedRateId = rateId;

  if (session.main.user.id > 0) {
    const pricesList = await prices();
    const rate = pricesList.virtual_vds?.[rateId];
    if (rate) {
      void import("../../modules/notifications/index.js").then(({ trackVpsCheckoutFunnel }) =>
        trackVpsCheckoutFunnel(ctx.appDataSource, session.main.user.id, rate.name)
      );
    }
  }

  const kb = new InlineKeyboard();
  for (const key of DEDICATED_OS_KEYS) {
    kb.text(ctx.t(`dedicated-os-${key}` as any), `vsh:os:${key}`).row();
  }
  kb.text(ctx.t("button-back"), `vsh:loc_back:${rateId}`).row();
  const osTitle = session.other.vdsRate.bulletproof
    ? ctx.t("vds-shop-os-select-bulletproof")
    : ctx.t("dedicated-os-select-title");
  await ctx.editMessageText(osTitle, {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

/** Bulletproof-only: marketing CPU label before charge (does not change real hardware). */
async function showVpsCpuPicker(ctx: AppContext, rateId: number): Promise<void> {
  const session = await ctx.session;
  ensureVpsShopSession(session);
  session.other.vdsRate.selectedRateId = rateId;
  if (!session.other.vdsRate.shopCpuKey) {
    session.other.vdsRate.shopCpuKey = VPS_MARKETING_CPU_DEFAULT;
  }

  const kb = new InlineKeyboard();
  for (const opt of VPS_MARKETING_CPU_OPTIONS) {
    const btn = opt.isDefault
      ? ctx.t("vds-shop-cpu-btn-default", { label: opt.label })
      : ctx.t("vds-shop-cpu-btn-alt", { label: opt.label });
    kb.text(btn, `vsh:cpu:${opt.key}`).row();
  }
  kb.text(ctx.t("button-back"), `vsh:cpu_back:${rateId}`).row();

  await ctx.editMessageText(ctx.t("vds-shop-cpu-select"), {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Standard (non-bulletproof) auto-provision via HostVDS OpenStack.
 * Does not touch Proxmox / createVpsOrderDirect.
 */
async function createStandardVpsOrderHostVds(
  ctx: AppContext,
  rateId: number,
  locationKey: string,
  osKey: string
): Promise<boolean> {
  const telegramId = Number(ctx.from?.id ?? 0);
  if (telegramId > 0) {
    if (vpsProvisioningTelegramIds.has(telegramId)) {
      await ctx
        .reply("⏳ Уже идёт создание VPS — дождитесь завершения или отправьте /start.", {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        })
        .catch(() => {});
      return true;
    }
    vpsProvisioningTelegramIds.add(telegramId);
  }

  let userId = 0;
  try {
    const session = await ctx.session;
    ensureVpsShopSession(session);
    userId = session.main.user.id;
    if (vpsProvisioningUserIds.has(userId)) {
      await ctx
        .reply("⏳ Уже идёт создание VPS — дождитесь завершения или отправьте /start.", {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        })
        .catch(() => {});
      return true;
    }
    vpsProvisioningUserIds.add(userId);

    try {
      const {
        allocateHostVdsLocalVmid,
        provisionHostVdsServer,
        rollbackHostVdsServer,
      } = await import("../../infrastructure/hostvds/HostVdsProvisioner.js");
      const { HYPERVISOR_HOSTVDS, HOSTVDS_LOCAL_VMID_BASE } = await import(
        "../../infrastructure/hostvds/hostvds-config.js"
      );

      const pricesList = await prices();
      const rate = pricesList.virtual_vds?.[rateId];
      if (!rate || !osKey) {
        await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
        return false;
      }

      const dataSource = ctx.appDataSource ?? (await getAppDataSource());
      const usersRepo = dataSource.getRepository(User);
      const vdsRepo = dataSource.getRepository(VirtualDedicatedServer);
      const user = await usersRepo.findOneBy({ id: session.main.user.id });
      if (!user) {
        await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
        return false;
      }

      const basePrice = rate.price.default;
      const price = await getOrderPriceForUser(dataSource, user.id, basePrice);
      if (user.balance < price) {
        await showTopupForMissingAmount(ctx, price - user.balance);
        return true;
      }

      let deducted = false;
      const chatId = ctx.chat?.id;
      const waitText = ctx.t("vds-provisioning-wait");
      const waitMessage = chatId
        ? await ctx
            .reply(waitText, {
              parse_mode: "HTML",
              link_preview_options: { is_disabled: true },
            })
            .catch(() => undefined)
        : undefined;

      const touchProgress = async (progress: number): Promise<void> => {
        if (!waitMessage || !chatId) return;
        await showProgress(ctx, waitMessage.message_id, waitText, progress).catch(() => {});
      };

      try {
        await touchProgress(0.08);
        user.balance -= price;
        await usersRepo.save(user);
        deducted = true;
        session.main.user.balance = user.balance;

        const generatedPassword = generatePassword(12);
        const vmName = generateRandomName(13);
        await touchProgress(0.2);

        const hints = getHostVdsLocationProvisionHints(locationKey);
        const provisioned = await provisionHostVdsServer({
          hostname: vmName,
          password: generatedPassword,
          osKey,
          rateId,
          cpu: rate.cpu,
          ramGb: rate.ram,
          diskGb: rate.ssd,
          locationKey,
          userId: user.id,
          availabilityZone: hints.availabilityZone,
          networkId: hints.networkId,
        });

        await touchProgress(0.85);

        let savedVds: VirtualDedicatedServer | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const maxRow = await vdsRepo
            .createQueryBuilder("v")
            .select("MAX(v.vdsId)", "max")
            .where("v.vdsId >= :base", { base: HOSTVDS_LOCAL_VMID_BASE })
            .getRawOne();
          const localVdsId = allocateHostVdsLocalVmid(
            maxRow?.max != null ? Number(maxRow.max) : null
          );

          const vds = new VirtualDedicatedServer();
          vds.vdsId = localVdsId;
          vds.login = resolveVdsLoginForOs({ osKey });
          vds.password = provisioned.adminPassword || generatedPassword;
          vds.ipv4Addr = provisioned.ipv4;
          vds.cpuCount = rate.cpu;
          vds.networkSpeed = rate.network;
          vds.isBulletproof = false;
          vds.payDayAt = null;
          vds.ramSize = rate.ram;
          vds.diskSize = rate.ssd;
          vds.lastOsId = 0;
          vds.rateName = rate.name;
          vds.expireAt = new Date(Date.now() + ms("30d"));
          vds.targetUserId = user.id;
          vds.renewalPrice = price;
          vds.autoRenewEnabled = true;
          vds.adminBlocked = false;
          vds.managementLocked = false;
          vds.extraIpv4Count = 0;
          vds.hypervisor = HYPERVISOR_HOSTVDS;
          vds.providerServerId = provisioned.providerServerId;
          vds.displayName = provisioned.hostname || vmName;

          try {
            savedVds = await vdsRepo.save(vds);
            break;
          } catch (saveErr: unknown) {
            const msg = String((saveErr as { message?: string })?.message ?? saveErr);
            const uniqueConflict =
              msg.includes("UNIQUE") ||
              msg.includes("duplicate") ||
              msg.includes("vdslist_vdsid");
            if (uniqueConflict && attempt < 3) {
              Logger.warn("[HostVDS] local vdsId conflict, retrying allocate", {
                attempt,
                localVdsId,
              });
              continue;
            }
            Logger.error(
              "[HostVDS] DB save failed after OpenStack create — rolling back server",
              { providerServerId: provisioned.providerServerId, error: msg }
            );
            await rollbackHostVdsServer(provisioned.providerServerId);
            throw saveErr;
          }
        }

        if (!savedVds) {
          await rollbackHostVdsServer(provisioned.providerServerId);
          throw new Error("Failed to persist HostVDS row after retries");
        }

        const regionLabel = ctx.t(`vps-location-${locationKey}` as any);
        const osLabel = ctx.t(`dedicated-os-${osKey}` as any);
        const payload: PremiumVpsReadyPayload = {
          vmName: savedVds.displayName || vmName,
          vdsId: savedVds.vdsId,
          regionLabel: isMissingFluentTranslation(regionLabel, `vps-location-${locationKey}`)
            ? locationKey
            : regionLabel,
          planName: rate.name ?? `VPS #${rateId}`,
          cpu: rate.cpu,
          ramGb: rate.ram,
          diskGb: rate.ssd,
          networkMbps: rate.network,
          cpuModel: getVpsCpuModel(rate as { cpuModel?: string }),
          osLabel,
          osKey,
          ipv4: savedVds.ipv4Addr,
          login: savedVds.login,
          password: savedVds.password,
        };

        if (waitMessage && chatId) {
          await ctx.api.deleteMessage(chatId, waitMessage.message_id).catch(() => {});
        }
        await ctx
          .reply(buildPremiumVpsReadyHtml(ctx, payload), {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
            reply_markup: buildVpsReadyCopyKeyboard(ctx, payload),
          })
          .catch(() => {});

        void import("../../modules/automations/engine/event-bus.js").then(({ emit }) => {
          emit({
            event: "service.created",
            userId: user.id,
            serviceType: "vds",
            serviceId: savedVds.id,
            timestamp: new Date(),
          });
        });

        resetVpsShopCheckoutSession(session);
        return true;
      } catch (error: unknown) {
        const detail =
          error instanceof HostVdsApiError
            ? `${error.code}: ${error.message}`
            : error instanceof Error
              ? error.message
              : "Unknown error";
        Logger.error("[HostVDS] standard VPS provision failed", new Error(detail));
        if (waitMessage && chatId) {
          await ctx.api
            .editMessageText(chatId, waitMessage.message_id, ctx.t("vps-provisioning-failed"), {
              parse_mode: "HTML",
              link_preview_options: { is_disabled: true },
            })
            .catch(() => {});
        }
        if (deducted) {
          try {
            user.balance += price;
            await usersRepo.save(user);
            session.main.user.balance = user.balance;
            Logger.info("[HostVDS] balance refunded after failed provision", {
              userId: user.id,
              amount: price,
            });
          } catch (refundErr: unknown) {
            Logger.error(
              "[HostVDS] CRITICAL: refund failed after provision error — manual balance fix required",
              refundErr instanceof Error
                ? refundErr
                : new Error(String(refundErr)),
              { userId: user.id, amount: price }
            );
          }
        }
        await ctx
          .reply(ctx.t("error-unknown", { error: String(detail).slice(0, 300) }), {
            parse_mode: "HTML",
          })
          .catch(() => {});
        return true;
      }
    } finally {
      vpsProvisioningUserIds.delete(userId);
    }
  } finally {
    if (telegramId > 0) {
      vpsProvisioningTelegramIds.delete(telegramId);
    }
  }
}

async function finalizeVpsOrderAfterOs(
  ctx: AppContext,
  rateId: number,
  locationKey: string,
  osKey: string
): Promise<void> {
  const session = await ctx.session;
  ensureVpsShopSession(session);

  // Abuse-resistant: existing Proxmox auto-provision — unchanged.
  if (
    session.other.vdsRate.bulletproof &&
    isProxmoxEnabled() &&
    canAutoProvisionVpsAtLocation(locationKey)
  ) {
    await createVpsOrderDirect(ctx, rateId, locationKey, osKey);
    return;
  }

  // Standard VPS: HostVDS OpenStack when configured and in stock for this plan+location.
  if (!session.other.vdsRate.bulletproof) {
    if (canProvisionHostVdsNow(locationKey, rateId)) {
      await createStandardVpsOrderHostVds(ctx, rateId, locationKey, osKey);
      return;
    }
  }

  await createVpsOrderTicket(ctx, rateId, locationKey, osKey);
}

function ensureVpsShopSession(session: SessionData): void {
  if (!session.other.vdsRate) {
    session.other.vdsRate = {
      bulletproof: false,
      selectedRateId: -1,
      selectedOs: -1,
      shopTier: null,
      shopListPage: 0,
      pendingOsKey: null,
      shopCpuKey: null,
    };
  }
  if (session.other.vdsRate.shopListPage == null) session.other.vdsRate.shopListPage = 0;
  if (session.other.vdsRate.pendingOsKey === undefined) session.other.vdsRate.pendingOsKey = null;
  if (session.other.vdsRate.shopCpuKey === undefined) session.other.vdsRate.shopCpuKey = null;
}

export function getVdsIndicesForTier(list: unknown[], tier: VpsShopTier): number[] {
  const out: number[] = [];
  list.forEach((_, id) => {
    if (VDS_INDEX_TIER[id] === tier) out.push(id);
  });
  return out;
}

function formatUsdShort(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

async function compactPlanButtonLabel(
  ctx: AppContext,
  rate: { name: string; cpu: number; ram: number; ssd: number },
  basePrice: number
): Promise<string> {
  const ds = ctx.appDataSource ?? (await getAppDataSource());
  const session = await ctx.session;
  const price = await getOrderPriceForUser(ds, session.main.user.id, basePrice);
  const p = formatUsdShort(price);
  return `${rate.name} • ${rate.cpu}C / ${rate.ram}GB / ${rate.ssd}GB  |  $${p}`;
}

/** Step 1: VPS type (uses grammY vdsTypeMenu). */
export async function showVpsShopStep1(ctx: AppContext): Promise<void> {
  const session = await ctx.session;
  ensureVpsShopSession(session);
  session.other.vdsRate.shopTier = null;
  session.other.vdsRate.shopListPage = 0;
  session.other.vdsRate.selectedRateId = -1;
  session.other.vdsRate.selectedOs = -1;
  session.other.vdsRate.pendingOsKey = null;
  session.other.vdsRate.shopCpuKey = null;

  const { vdsTypeMenu } = await import("../../helpers/services-menu.js");
  await ctx.editMessageText(ctx.t("vds-shop-step1-text"), {
    parse_mode: "HTML",
    reply_markup: vdsTypeMenu,
    link_preview_options: { is_disabled: true },
  });
}

/** Step 2: tier */
export async function showVpsShopStep2Tier(ctx: AppContext): Promise<void> {
  const session = await ctx.session;
  ensureVpsShopSession(session);
  session.other.vdsRate.shopTier = null;
  session.other.vdsRate.shopListPage = 0;
  await showVpsShopStep3List(ctx, 0);
}

/** Step 3: plan list */
export async function showVpsShopStep3List(ctx: AppContext, page?: number): Promise<void> {
  const session = await ctx.session;
  ensureVpsShopSession(session);
  const vr = session.other.vdsRate;
  const tier = vr.shopTier;
  const p = page ?? vr.shopListPage ?? 0;
  vr.shopListPage = p;

  const pricesList = await prices();
  const list = pricesList.virtual_vds ?? [];
  assertVdsCatalogLength(list.length);

  const ids =
    tier == null ? list.map((_, idx) => idx) : getVdsIndicesForTier(list, tier);
  const totalPages = Math.max(1, Math.ceil(ids.length / VDS_SHOP_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, p), totalPages - 1);
  vr.shopListPage = safePage;
  const start = safePage * VDS_SHOP_PAGE_SIZE;
  const slice = ids.slice(start, start + VDS_SHOP_PAGE_SIZE);

  const header = vr.bulletproof
    ? `<b>${ctx.t("vds-shop-bulletproof-list-header")}</b>`
    : `<b>${ctx.t("vds-shop-standard-list-header")}</b>`;

  let body = `${header}\n\n${ctx.t("vds-shop-step3-prompt")}`;
  const stockUi = !vr.bulletproof && useHostVdsStockUi();
  if (stockUi) {
    body += `\n\n${ctx.t("hostvds-plan-stock-hint")}`;
  }
  if (ids.length > VDS_SHOP_PAGE_SIZE) {
    body += `\n\n${ctx.t("vds-shop-list-page", { current: safePage + 1, total: totalPages })}`;
  }

  const kb = new InlineKeyboard();
  for (const id of slice) {
    const rate = list[id]!;
    const base = vr.bulletproof ? rate.price.bulletproof : rate.price.default;
    let label = await compactPlanButtonLabel(ctx, rate, base);
    if (stockUi) {
      const st = resolvePlanGlobalStatus(id);
      if (st !== "available") {
        label = `🔒 ${label} · ${stockStatusLabel(ctx, st)}`;
        kb.text(label.slice(0, 64), `vsh:sel_na:${id}`).row();
        continue;
      }
      label = `✅ ${label}`;
    }
    kb.text(label.slice(0, 64), `vsh:sel:${id}`).row();
  }

  if (totalPages > 1) {
    const prev = safePage <= 0 ? totalPages - 1 : safePage - 1;
    const next = safePage >= totalPages - 1 ? 0 : safePage + 1;
    kb.text(ctx.t("vds-shop-page-prev"), `vsh:page:${prev}`)
      .text(ctx.t("vds-shop-page-next"), `vsh:page:${next}`)
      .row();
  }

  appendVpsShopPrimeAndBack(kb, ctx, "vsh:back:services");

  await ctx.editMessageText(body, {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

/** Step 4: compact card */
export async function showVpsShopStep4Card(ctx: AppContext, rateId: number): Promise<void> {
  const session = await ctx.session;
  ensureVpsShopSession(session);
  const pricesList = await prices();
  const rate = pricesList.virtual_vds?.[rateId];
  if (!rate) {
    await ctx.answerCallbackQuery({ text: ctx.t("error-unknown", { error: "?" }).slice(0, 200), show_alert: true }).catch(() => {});
    return;
  }

  const vr = session.other.vdsRate;
  vr.selectedRateId = rateId;
  const basePrice = vr.bulletproof ? rate.price.bulletproof : rate.price.default;
  const dataSource = ctx.appDataSource ?? (await getAppDataSource());
  const price = await getOrderPriceForUser(dataSource, session.main.user.id, basePrice);

  const text = ctx.t("vds-shop-card", {
    title: rate.name,
    cpu: rate.cpu,
    ram: rate.ram,
    storage: rate.ssd,
    network: rate.network,
    price,
  });

  const kb = new InlineKeyboard();
  const stockUi = !vr.bulletproof && useHostVdsStockUi();
  if (stockUi && !isPlanSelectable(rateId)) {
    const st = resolvePlanGlobalStatus(rateId);
    kb.text(
      `🔒 ${ctx.t("vds-shop-order")} · ${stockStatusLabel(ctx, st)}`,
      `vsh:sel_na:${rateId}`
    ).row();
  } else {
    kb.text(ctx.t("vds-shop-order"), `vsh:ord:${rateId}`).row();
  }
  kb
    .text(ctx.t("vds-shop-details"), `vsh:det:${rateId}`)
    .row();
  appendVpsShopBackOnly(kb, ctx, `vsh:back:list`);

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

export async function showVpsShopFullDetails(ctx: AppContext, rateId: number): Promise<void> {
  const session = await ctx.session;
  const pricesList = await prices();
  const rate = pricesList.virtual_vds?.[rateId];
  if (!rate) return;

  const vr = session.other.vdsRate;
  const basePrice = vr.bulletproof ? rate.price.bulletproof : rate.price.default;
  const dataSource = ctx.appDataSource ?? (await getAppDataSource());
  const price = await getOrderPriceForUser(dataSource, session.main.user.id, basePrice);

  const text = ctx.t("vds-rate-full-view", {
    rateName: rate.name,
    price,
    cpuModel: getVpsCpuModel(rate as { cpuModel?: string }),
    ram: rate.ram,
    disk: rate.ssd,
    cpu: rate.cpu,
    network: rate.network,
    abuse: vr.bulletproof ? ctx.t("bulletproof-on") : ctx.t("bulletproof-off"),
  });

  const kb = new InlineKeyboard();
  appendVpsShopBackOnly(kb, ctx, `vsh:card:${rateId}`);

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

export function registerVpsShopHandlers(bot: Bot<AppContext>): void {
  bot.callbackQuery(/^vsh:tier:(start|standard|performance|enterprise)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const tier = ctx.match![1] as VpsShopTier;
    const session = await ctx.session;
    ensureVpsShopSession(session);
    session.other.vdsRate.shopTier = tier;
    session.other.vdsRate.shopListPage = 0;
    await showVpsShopStep3List(ctx, 0);
  });

  bot.callbackQuery(/^vsh:page:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const page = Number.parseInt(ctx.match![1]!, 10);
    const session = await ctx.session;
    ensureVpsShopSession(session);
    session.other.vdsRate.shopListPage = page;
    await showVpsShopStep3List(ctx, page);
  });

  bot.callbackQuery(/^vsh:sel:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const id = Number.parseInt(ctx.match![1]!, 10);
    const session = await ctx.session;
    if (!session.other.vdsRate.bulletproof && useHostVdsStockUi() && !isPlanSelectable(id)) {
      const st = resolvePlanGlobalStatus(id);
      await ctx
        .answerCallbackQuery({
          text: ctx.t("hostvds-toast-plan-unavailable", {
            status: stockStatusLabel(ctx, st),
          }).slice(0, 200),
          show_alert: true,
        })
        .catch(() => {});
      return;
    }
    await showVpsShopStep4Card(ctx, id);
  });

  bot.callbackQuery(/^vsh:ord:(\d+)$/, async (ctx) => {
    const id = Number.parseInt(ctx.match![1]!, 10);
    const session = await ctx.session;
    ensureVpsShopSession(session);
    if (!session.other.vdsRate.bulletproof && useHostVdsStockUi() && !isPlanSelectable(id)) {
      const st = resolvePlanGlobalStatus(id);
      await ctx
        .answerCallbackQuery({
          text: ctx.t("hostvds-toast-plan-unavailable", {
            status: stockStatusLabel(ctx, st),
          }).slice(0, 200),
          show_alert: true,
        })
        .catch(() => {});
      return;
    }
    await ctx.answerCallbackQuery().catch(() => {});
    await showVpsLocationPicker(ctx, id);
  });

  bot.callbackQuery(/^vsh:sel_na:(\d+)$/, async (ctx) => {
    const id = Number.parseInt(ctx.match![1]!, 10);
    const st = resolvePlanGlobalStatus(id);
    await ctx
      .answerCallbackQuery({
        text: ctx.t("hostvds-toast-plan-unavailable", {
          status: stockStatusLabel(ctx, st),
        }).slice(0, 200),
        show_alert: true,
      })
      .catch(() => {});
  });

  bot.callbackQuery(/^vsh:loc_na:([a-z0-9-]+)$/, async (ctx) => {
    const locationKey = ctx.match![1]!;
    const session = await ctx.session;
    const rateId = session.other.vdsRate.selectedRateId;
    const st =
      rateId >= 0
        ? resolvePlanAtLocationStatus(locationKey, rateId)
        : resolveLocationStatus(locationKey);
    await ctx
      .answerCallbackQuery({
        text: ctx.t("hostvds-toast-location-unavailable", {
          status: stockStatusLabel(ctx, st),
        }).slice(0, 200),
        show_alert: true,
      })
      .catch(() => {});
  });

  bot.callbackQuery(/^vsh:loc:([a-z0-9-]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const locationKey = ctx.match![1]!;
    const session = await ctx.session;
    const rateId = session.other.vdsRate.selectedRateId;
    if (rateId < 0) {
      await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
      return;
    }
    const pricesList = await prices();
    const rate = pricesList.virtual_vds?.[rateId];
    if (!rate) {
      await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
      return;
    }
    const allowedLocationKeys = getAllowedVpsLocationKeys(rate, session.other.vdsRate.bulletproof);
    if (!allowedLocationKeys.includes(locationKey)) {
      await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
      return;
    }
    if (!session.other.vdsRate.bulletproof && useHostVdsStockUi()) {
      if (!isLocationSelectable(locationKey, rateId)) {
        const st = resolvePlanAtLocationStatus(locationKey, rateId);
        await ctx
          .answerCallbackQuery({
            text: ctx.t("hostvds-toast-location-unavailable", {
              status: stockStatusLabel(ctx, st),
            }).slice(0, 200),
            show_alert: true,
          })
          .catch(() => {});
        return;
      }
    }
    await showVpsOsPicker(ctx, rateId, locationKey);
  });

  bot.callbackQuery(/^vsh:loc_back:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const rateId = Number.parseInt(ctx.match![1]!, 10);
    await showVpsLocationPicker(ctx, rateId);
  });

  bot.callbackQuery(/^vsh:os:([a-z0-9-]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const osKey = ctx.match![1]!;
    const session = await ctx.session;
    ensureVpsShopSession(session);
    const rateId = session.other.vdsRate.selectedRateId;
    const locationKey = session.other.dedicatedOrder?.selectedLocationKey;
    if (rateId < 0 || !locationKey) {
      await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
      return;
    }

    // Abuse-resistant: last marketing step — CPU label (hardware unchanged).
    if (session.other.vdsRate.bulletproof) {
      session.other.vdsRate.pendingOsKey = osKey;
      session.other.vdsRate.shopCpuKey = VPS_MARKETING_CPU_DEFAULT;
      await showVpsCpuPicker(ctx as AppContext, rateId);
      return;
    }

    await deleteVpsOsPickerMessage(ctx as AppContext);
    session.other.vdsRate.shopCpuKey = null;
    await finalizeVpsOrderAfterOs(ctx as AppContext, rateId, locationKey, osKey);
  });

  bot.callbackQuery(/^vsh:cpu:(xeon-e5-2699v4|epyc-7551p)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const cpuKey = ctx.match![1]!;
    if (!isVpsMarketingCpuKey(cpuKey)) {
      await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
      return;
    }
    const session = await ctx.session;
    ensureVpsShopSession(session);
    const rateId = session.other.vdsRate.selectedRateId;
    const locationKey = session.other.dedicatedOrder?.selectedLocationKey;
    const osKey = session.other.vdsRate.pendingOsKey;
    if (rateId < 0 || !locationKey || !osKey) {
      await ctx.reply(ctx.t("bad-error"), { parse_mode: "HTML" }).catch(() => {});
      return;
    }
    session.other.vdsRate.shopCpuKey = cpuKey as VpsMarketingCpuKey;
    await deleteVpsOsPickerMessage(ctx as AppContext);
    await finalizeVpsOrderAfterOs(ctx as AppContext, rateId, locationKey, osKey);
  });

  bot.callbackQuery(/^vsh:cpu_back:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const rateId = Number.parseInt(ctx.match![1]!, 10);
    const session = await ctx.session;
    ensureVpsShopSession(session);
    const locationKey = session.other.dedicatedOrder?.selectedLocationKey;
    session.other.vdsRate.pendingOsKey = null;
    session.other.vdsRate.shopCpuKey = null;
    if (!locationKey) {
      await showVpsLocationPicker(ctx as AppContext, rateId);
      return;
    }
    await showVpsOsPicker(ctx as AppContext, rateId, locationKey);
  });

  bot.callbackQuery(/^vsh:det:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const id = Number.parseInt(ctx.match![1]!, 10);
    await showVpsShopFullDetails(ctx, id);
  });

  bot.callbackQuery(/^vsh:card:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const id = Number.parseInt(ctx.match![1]!, 10);
    await showVpsShopStep4Card(ctx, id);
  });

  bot.callbackQuery("vsh:back:type", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await showVpsShopStep1(ctx);
  });

  bot.callbackQuery("vsh:back:tier", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const { servicesMenu } = await import("../../helpers/services-menu.js");
    await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
      parse_mode: "HTML",
      reply_markup: servicesMenu,
    });
  });

  bot.callbackQuery("vsh:back:services", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const { servicesMenu } = await import("../../helpers/services-menu.js");
    await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
      parse_mode: "HTML",
      reply_markup: servicesMenu,
    });
  });

  bot.callbackQuery("vsh:back:list", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    ensureVpsShopSession(session);
    await showVpsShopStep3List(ctx, session.other.vdsRate.shopListPage ?? 0);
  });

  bot.callbackQuery("vsh:prime", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const session = await ctx.session;
      ensureVpsShopSession(session);
      const tier = session.other.vdsRate.shopTier;
      const backCallback = tier ? "prime-back-to-vds-shop-list" : "prime-back-to-vds-shop-tier";
      const { getDomainsListWithPrimeScreen } = await import("../../ui/menus/amper-domains-menu.js");
      const { fullText, keyboard } = await getDomainsListWithPrimeScreen(ctx, { backCallback });
      await ctx.editMessageText(fullText, { reply_markup: keyboard, parse_mode: "HTML" });
    } catch (e: any) {
      await ctx.editMessageText(ctx.t("error-unknown", { error: e?.message || "Error" })).catch(() => {});
    }
  });
}
