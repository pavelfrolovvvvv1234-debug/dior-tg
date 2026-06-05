import { Menu } from "@grammyjs/menu";
import { Not, IsNull } from "typeorm";
import { mainMenu } from "..";
import type { AppContext, AppConversation } from "../shared/types/context";
import DomainRequest, { DomainRequestStatus } from "@/entities/DomainRequest";
import Domain from "@/entities/Domain";
import { getAppDataSource } from "../infrastructure/db/datasource.js";
import { InlineKeyboard } from "grammy";
import VirtualDedicatedServer, {
  generatePassword,
} from "@/entities/VirtualDedicatedServer";
import { ListItem } from "@/api/vmmanager";
import { VdsService } from "@/domain/services/VdsService";
import { VdsRepository } from "@/infrastructure/db/repositories/VdsRepository";
import { BillingService } from "@/domain/billing/BillingService";
import { UserRepository } from "@/infrastructure/db/repositories/UserRepository";
import { TopUpRepository } from "@/infrastructure/db/repositories/TopUpRepository";
import { buildServiceInfoBlock } from "@/shared/service-panel";
import { ServicePaymentService } from "@/domain/billing/ServicePaymentService";
import { createInitialOtherSession } from "@/shared/session-initial.js";
import { showVpsVdsInServiceMenus } from "../app/config.js";
import { getVmManagerAllowedOsIds } from "../app/config.js";
import { escapeUserInput } from "./formatting.js";
import {
  filterAndSortOsTemplatesForVpsPicker,
  humanizeVmmOsName,
  resolveVdsLoginForOs,
} from "../shared/vmm-os-display.js";
import { clearedInlineKeyboard } from "../shared/cleared-inline-keyboard.js";
import { buildVdsProxmoxDescriptionLine } from "@/shared/vds-proxmox-label.js";
import { Logger } from "../app/logger.js";
import { getExtraIpv4MonthlyPriceUsd, MAX_EXTRA_IPV4_PER_VDS } from "../domain/vds/extra-ipv4.js";
import { providerHas } from "../api/reseller-api-vm-ops.js";

const isDemoVds = (vds: VirtualDedicatedServer): boolean => {
  const rateName = (vds.rateName || "").toLowerCase();
  return vds.vdsId <= 0 || rateName.includes("demo");
};

const getDemoVdsInfo = (): ListItem => {
  return { state: "active" } as ListItem;
};

/**
 * Fetch VDS power state from Proxmox with retries. Returns a safe fallback
 * (synthetic active state) when the VM is missing or VMManager is unavailable,
 * so the management view always renders. Used for admin-issued manual VPS
 * whose vmid is not provisioned in Proxmox.
 */
const resolveVdsManageInfo = async (
  ctx: AppContext,
  vds: VirtualDedicatedServer
): Promise<ListItem> => {
  if (isDemoVds(vds)) {
    return getDemoVdsInfo();
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const info = await ctx.vmmanager.getInfoVM(vds.vdsId);
      if (info) return info;
    } catch {
      // try next attempt
    }
  }
  return { state: "active" } as ListItem;
};

const replyDemoOperation = async (ctx: AppContext): Promise<void> => {
  await ctx.reply(ctx.t("demo-operation-not-available"));
};

const getStatusLabel = (
  ctx: AppContext,
  state: ListItem["state"]
): string => {
  if (state === "active") {
    return `🟢 ${ctx.t("status-active")}`;
  }
  if (state === "stopped") {
    return `⛔ ${ctx.t("status-suspended")}`;
  }
  return `🟡 ${ctx.t("status-pending")}`;
};

const isVdsAdminBlocked = (vds: VirtualDedicatedServer): boolean =>
  vds.adminBlocked === true;

const isVdsManagementBlocked = (vds: VirtualDedicatedServer): boolean =>
  vds.managementLocked === true || vds.adminBlocked === true;

export function hasPendingVdsManageText(session: {
  other?: { manageVds?: { pendingRenameVdsId?: number | null; pendingManualPasswordVdsId?: number | null } };
}): boolean {
  if (!session.other?.manageVds) return false;
  ensureManageVdsSession(session);
  const mv = session.other.manageVds;
  return (
    (mv.pendingRenameVdsId != null && mv.pendingRenameVdsId > 0) ||
    (mv.pendingManualPasswordVdsId != null && mv.pendingManualPasswordVdsId > 0)
  );
}

const isPlaceholderIpv4 = (ip?: string | null): boolean =>
  !ip || ip === "0.0.0.0" || ip === "127.0.0.1";

async function resolveSecondaryIpv4(
  ctx: AppContext,
  vds: VirtualDedicatedServer
): Promise<string | null> {
  if ((vds.extraIpv4Count ?? 0) < 1) return null;
  const data = await ctx.vmmanager.getIpv4AddrVM(vds.vdsId).catch(() => undefined);
  const ips =
    data?.list?.map((row) => row.ip_addr).filter((ip) => ip && !isPlaceholderIpv4(ip)) ?? [];
  return ips.find((ip) => ip !== vds.ipv4Addr) ?? ips[1] ?? null;
}

const canOfferExtraIpv4Purchase = (ctx: AppContext, vds: VirtualDedicatedServer): boolean =>
  !isDemoVds(vds) &&
  !isVdsManagementBlocked(vds) &&
  (vds.extraIpv4Count ?? 0) < MAX_EXTRA_IPV4_PER_VDS &&
  providerHas(ctx.vmmanager, "addIpv4ToHost");

/** Grammy Menu may pass payload as string or number depending on plugin/version. */
const parseMenuNumericPayload = (match: unknown): number => {
  if (typeof match === "string" && /^\d+$/.test(match)) {
    return Number.parseInt(match, 10);
  }
  if (typeof match === "number" && Number.isFinite(match)) {
    return match;
  }
  return NaN;
};

/** Show server list (not detail panel) when opening «Мои VDS» / active services. */
export function resetVdsManageListView(session: { other?: { manageVds?: Record<string, unknown> } }): void {
  ensureManageVdsSession(session);
  const mv = session.other!.manageVds as {
    page: number;
    lastPickedId: number;
    expandedId: number | null;
    showPassword: boolean;
    pendingRenameVdsId?: number | null;
    pendingManualPasswordVdsId?: number | null;
    pendingRenewMonths?: unknown;
    panelMode?: string;
  };
  mv.expandedId = null;
  mv.showPassword = false;
  mv.lastPickedId = -1;
  mv.panelMode = "main";
  mv.pendingRenameVdsId = null;
  mv.pendingManualPasswordVdsId = null;
  mv.pendingRenewMonths = null;
  (mv as { renameReturnPanelMode?: string }).renameReturnPanelMode = undefined;
}

const ensureManageVdsSession = (session: any): void => {
  if (!session.other) {
    session.other = createInitialOtherSession();
    return;
  }
  if (!session.other.manageVds) {
    session.other.manageVds = createInitialOtherSession().manageVds;
    return;
  }
  const state = session.other.manageVds;
  if (typeof state.page !== "number") state.page = 0;
  if (typeof state.lastPickedId !== "number") state.lastPickedId = -1;
  if (state.expandedId !== null && typeof state.expandedId !== "number") state.expandedId = null;
  if (typeof state.showPassword !== "boolean") state.showPassword = false;
  if (
    state.pendingRenameVdsId !== null &&
    state.pendingRenameVdsId !== undefined &&
    typeof state.pendingRenameVdsId !== "number"
  ) {
    state.pendingRenameVdsId = null;
  }
  if (state.pendingRenameVdsId === undefined) state.pendingRenameVdsId = null;
  if (
    state.pendingManualPasswordVdsId !== null &&
    state.pendingManualPasswordVdsId !== undefined &&
    typeof state.pendingManualPasswordVdsId !== "number"
  ) {
    state.pendingManualPasswordVdsId = null;
  }
  if (state.pendingManualPasswordVdsId === undefined) state.pendingManualPasswordVdsId = null;
  if (!Object.prototype.hasOwnProperty.call(state, "pendingRenewMonths")) {
    state.pendingRenewMonths = null;
  }
};

const prepareVdsInlineAction = async (
  ctx: AppContext,
  vdsId: number
): Promise<VirtualDedicatedServer | null> => {
  const session = await ctx.session;
  ensureManageVdsSession(session);
  session.other.manageVds.lastPickedId = vdsId;
  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const vds = await vdsRepo.findOneBy({ id: vdsId });
  if (!vds || Number(vds.targetUserId) !== Number(session.main.user.id)) {
    await ctx.reply(ctx.t("error-access-denied"));
    return null;
  }
  if (isDemoVds(vds)) {
    await replyDemoOperation(ctx);
    return null;
  }
  if (isVdsManagementBlocked(vds)) {
    await ctx.reply(ctx.t("vds-management-locked-notice"));
    return null;
  }
  return vds;
};

/** Rename allowed when subscription-locked; only admin block stops it. */
const prepareVdsRename = async (
  ctx: AppContext,
  vdsId: number
): Promise<VirtualDedicatedServer | null> => {
  const session = await ctx.session;
  ensureManageVdsSession(session);
  session.other.manageVds.lastPickedId = vdsId;
  const vdsRepo = new VdsRepository(ctx.appDataSource);
  const vds = await vdsRepo.findById(vdsId);
  if (!vds || Number(vds.targetUserId) !== Number(session.main.user.id)) {
    await ctx.reply(ctx.t("error-access-denied"));
    return null;
  }
  if (isDemoVds(vds)) {
    await replyDemoOperation(ctx);
    return null;
  }
  if (isVdsAdminBlocked(vds)) {
    await ctx.reply(ctx.t("vds-admin-blocked-notice"));
    return null;
  }
  return vds;
};

async function replyVdsManagePanel(
  ctx: AppContext,
  vdsId: number,
  panelMode: "main" | "more" | "renew" = "main"
): Promise<void> {
  const session = await ctx.session;
  ensureManageVdsSession(session);
  session.other.manageVds.expandedId = vdsId;
  session.other.manageVds.lastPickedId = vdsId;
  session.other.manageVds.showPassword = false;
  (session.other.manageVds as { panelMode?: string }).panelMode = panelMode;

  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const vds = await vdsRepo.findOneBy({ id: vdsId });
  if (!vds || Number(vds.targetUserId) !== Number(session.main.user.id)) {
    await ctx.reply(ctx.t("error-access-denied"));
    return;
  }

  const info = await resolveVdsManageInfo(ctx, vds);

  await ctx.reply(
    buildVdsManageText(ctx, vds, info, session.other.manageVds.showPassword),
    { parse_mode: "HTML", reply_markup: vdsManageServiceMenu }
  );
}

const startRenamePrompt = async (ctx: AppContext, vdsId: number): Promise<void> => {
  const session = await ctx.session;
  const vds = await prepareVdsRename(ctx, vdsId);
  if (!vds) return;
  ensureManageVdsSession(session);
  session.other.manageVds.pendingManualPasswordVdsId = null;
  const panelMode = (session.other.manageVds as { panelMode?: string }).panelMode || "main";
  (session.other.manageVds as { renameReturnPanelMode?: string }).renameReturnPanelMode = panelMode;
  session.other.manageVds.pendingRenameVdsId = vds.id;
  await ctx.reply(
    ctx.t("vds-rename-enter-name", {
      currentName: vds.displayName || vds.rateName || `VDS #${vds.id}`,
      minLength: 3,
      maxLength: 32,
    }),
    { parse_mode: "HTML" }
  );
};

const startManualPasswordPrompt = async (ctx: AppContext, vdsId: number): Promise<void> => {
  const session = await ctx.session;
  const vds = await prepareVdsInlineAction(ctx, vdsId);
  if (!vds) return;
  ensureManageVdsSession(session);
  session.other.manageVds.pendingRenameVdsId = null;
  session.other.manageVds.pendingManualPasswordVdsId = vds.id;
  await ctx.reply(ctx.t("vds-password-manual-prompt"), { parse_mode: "HTML" });
};


export const handlePendingVdsManageInput = async (ctx: AppContext): Promise<boolean> => {
  if (!ctx.message?.text || !ctx.hasChatType("private")) return false;
  const session = await ctx.session;
  if ((session.other as { adminServiceDraft?: unknown }).adminServiceDraft) {
    return false;
  }
  ensureManageVdsSession(session);
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return false;

  const renameId = session.other.manageVds.pendingRenameVdsId;
  const manualPassId = session.other.manageVds.pendingManualPasswordVdsId;
  if (!renameId && !manualPassId) return false;

  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

  if (renameId) {
    const newName = text;
    if (newName.length < 3 || newName.length > 32) {
      await ctx.reply(ctx.t("vds-rename-invalid-length", { minLength: 3, maxLength: 32 }));
      return true;
    }
    if (newName.includes("\n") || newName.includes("\r")) {
      await ctx.reply(ctx.t("vds-rename-no-linebreaks"));
      return true;
    }
    const vds = await vdsRepo.findOneBy({ id: renameId });
    if (!vds || Number(vds.targetUserId) !== Number(session.main.user.id)) {
      session.other.manageVds.pendingRenameVdsId = null;
      await ctx.reply(ctx.t("error-access-denied"));
      return true;
    }
    try {
      const vdsRepository = new VdsRepository(ctx.appDataSource);
      const userRepository = new UserRepository(ctx.appDataSource);
      const topUpRepository = new TopUpRepository(ctx.appDataSource);
      const billingService = new BillingService(ctx.appDataSource, userRepository, topUpRepository);
      const vdsService = new VdsService(ctx.appDataSource, vdsRepository, billingService, ctx.vmmanager);
      await vdsService.renameVds(renameId, session.main.user.id, newName);
      session.other.manageVds.pendingRenameVdsId = null;
      const returnPanel =
        (session.other.manageVds as { renameReturnPanelMode?: string }).renameReturnPanelMode === "more"
          ? "more"
          : "main";
      (session.other.manageVds as { renameReturnPanelMode?: string }).renameReturnPanelMode = undefined;
      await ctx.reply(ctx.t("vds-rename-success", { newName }), { parse_mode: "HTML" });
      await replyVdsManagePanel(ctx, renameId, returnPanel);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      await ctx.reply(ctx.t("error-unknown", { error: msg }));
    }
    return true;
  }

  if (manualPassId) {
    session.other.manageVds.pendingManualPasswordVdsId = null;
    if (text.length < 8 || text.length > 128) {
      await ctx.reply(ctx.t("vds-password-manual-invalid"));
      return true;
    }
    const vds = await vdsRepo.findOneBy({ id: manualPassId });
    if (!vds || Number(vds.targetUserId) !== Number(session.main.user.id)) {
      await ctx.reply(ctx.t("error-access-denied"));
      return true;
    }
    // Best-effort provider sync; manual admin-issued VPS will fail here
    // but the user still gets the new password stored in our DB so they
    // can use it (and the admin will reconcile the OS password offline).
    try {
      const ok = await ctx.vmmanager
        .changePasswordVMCustom(vds.vdsId, text)
        .catch((e) => {
          Logger.warn("changePasswordVMCustom failed; saving DB only", {
            vmid: vds.vdsId,
            error: e instanceof Error ? e.message : String(e),
          });
          return false;
        });
      if (!ok) {
        Logger.warn(
          "VM provider did not apply manual password; persisting to DB only",
          { vmid: vds.vdsId }
        );
      }
      vds.password = text;
      await vdsRepo.save(vds);
      await ctx.reply(ctx.t("vds-password-manual-success"), { parse_mode: "HTML" });
      const returnPanel =
        (session.other.manageVds as { panelMode?: string }).panelMode === "more" ? "more" : "main";
      await replyVdsManagePanel(ctx, manualPassId, returnPanel);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      await ctx.reply(ctx.t("error-unknown", { error: msg }));
    }
    return true;
  }

  return false;
};

const buildVdsManageText = (
  ctx: AppContext,
  vds: VirtualDedicatedServer | null,
  info: ListItem | null,
  showPassword: boolean,
  extraIpv4?: string | null
): string => {
  const header = `<strong>${ctx.t("vds-manage-title")}</strong>`;
  if (!vds || !info) {
    return header;
  }

  const os = ctx.osList?.list.find((os) => os.id == vds.lastOsId);
  const osName = os?.name || "N/A";

  const infoBlock = buildServiceInfoBlock(ctx, {
    ip: vds.ipv4Addr,
    login: resolveVdsLoginForOs({ osName, osId: vds.lastOsId, storedLogin: vds.login }),
    password: vds.password,
    showPassword,
    os: osName,
    statusLabel: getStatusLabel(ctx, info.state),
    createdAt: vds.createdAt,
    paidUntil: vds.expireAt,
    vmHostId: vds.vdsId,
  });

  const autoLine = ctx.t("vds-autorenew-line", {
    state:
      vds.autoRenewEnabled !== false
        ? ctx.t("vds-autorenew-on")
        : ctx.t("vds-autorenew-off"),
  });
  let lockLine = "";
  if (vds.adminBlocked) {
    lockLine = `\n\n${ctx.t("vds-admin-blocked-notice")}`;
  } else if (vds.managementLocked) {
    lockLine = `\n\n${ctx.t("vds-management-locked-notice")}`;
  }

  const extraIpLine =
    extraIpv4 && !isPlaceholderIpv4(extraIpv4)
      ? `\n<strong>${ctx.t("service-label-extra-ipv4")}:</strong> ${escapeUserInput(extraIpv4)}`
      : (vds.extraIpv4Count ?? 0) > 0
        ? `\n<i>${ctx.t("vds-extra-ipv4-active")}</i>`
        : "";

  return `${header}\n\n${infoBlock}${extraIpLine}\n\n${autoLine}${lockLine}`;
};

const updateVdsManageView = async (ctx: AppContext): Promise<void> => {
  const session = await ctx.session;
  ensureManageVdsSession(session);
  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const expandedId = session.other.manageVds.expandedId;
  if (!expandedId) {
    const panelMode = (session.other.manageVds as { panelMode?: string }).panelMode || "main";
    if (panelMode !== "main") {
      (session.other.manageVds as { panelMode?: string }).panelMode = "main";
    }
    await ctx.editMessageText(buildVdsManageText(ctx, null, null, false), {
      parse_mode: "HTML",
      reply_markup: vdsManageServiceMenu,
    });
    return;
  }
  const vds = await vdsRepo.findOneBy({ id: expandedId });
  if (!vds) {
    session.other.manageVds.expandedId = null;
    await ctx.editMessageText(buildVdsManageText(ctx, null, null, false), {
      parse_mode: "HTML",
      reply_markup: vdsManageServiceMenu,
    });
    return;
  }

  if (Number(vds.targetUserId) !== Number(session.main.user.id)) {
    session.other.manageVds.expandedId = null;
    (session.other.manageVds as any).panelMode = "main";
    session.other.manageVds.showPassword = false;
    await ctx.editMessageText(buildVdsManageText(ctx, null, null, false), {
      parse_mode: "HTML",
      reply_markup: vdsManageServiceMenu,
    });
    return;
  }

  const info = await resolveVdsManageInfo(ctx, vds);
  let secondaryIp: string | null = null;
  if (!isDemoVds(vds)) {
    // Refresh persisted IPv4 if it was unavailable at provisioning time.
    // Best-effort; failures here must never block opening the management card
    // (matters for admin-issued manual VPS whose vmid is not in Proxmox).
    try {
      const freshIpv4 = await ctx.vmmanager
        .getIpv4AddrVM(vds.vdsId)
        .catch(() => undefined);
      const freshIp = freshIpv4?.list?.[0]?.ip_addr;
      if (freshIp && !isPlaceholderIpv4(freshIp) && vds.ipv4Addr !== freshIp) {
        vds.ipv4Addr = freshIp;
        await vdsRepo.save(vds);
      }
    } catch (e) {
      Logger.warn("updateVdsManageView: IPv4 refresh failed", {
        vdsId: vds.id,
        vmid: vds.vdsId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    secondaryIp = await resolveSecondaryIpv4(ctx, vds);
  }

  await ctx.editMessageText(
    buildVdsManageText(ctx, vds, info, session.other.manageVds.showPassword, secondaryIp),
    {
      parse_mode: "HTML",
      reply_markup: vdsManageServiceMenu,
    }
  );
};

/** Open «Мои VDS» list (manage services) without Grammy submenu navigation glitches. */
export async function openVdsManageList(ctx: AppContext): Promise<void> {
  const session = await ctx.session;
  resetVdsManageListView(session);
  await updateVdsManageView(ctx);
}

const createVdsServiceInvoice = async (
  ctx: AppContext,
  vds: VirtualDedicatedServer
): Promise<void> => {
  const session = await ctx.session;
  const servicePayment = new ServicePaymentService(ctx.appDataSource);
  const description = `Оплата VPS #${vds.id}`;
  const invoice = await servicePayment.createServiceInvoice({
    userId: session.main.user.id,
    serviceType: "vds",
    serviceId: vds.id,
    amount: vds.renewalPrice,
    description,
    chatId: ctx.chatId,
  });

  const message = await ctx.reply(ctx.t("service-pay-message"), {
    reply_markup: new InlineKeyboard().url(
      ctx.t("button-pay"),
      invoice.payUrl
    ),
    parse_mode: "HTML",
  });

  await servicePayment.attachMessage(
    invoice.invoiceId,
    message.chat.id,
    message.message_id
  );
};

function buildManageServicesMenu(): Menu<AppContext> {
  let m = new Menu<AppContext>("manage-services-menu", {
    autoAnswer: false,
    onMenuOutdated: false,
  })
    .submenu(
      (ctx) => ctx.t("button-manage-domains"),
      "domain-manage-services-menu",
      async (ctx) => {
        await ctx.editMessageText(ctx.t("domains-manage"), {
          parse_mode: "HTML",
        });
      }
    )
    .row()
    .text(
      (ctx) => ctx.t("button-manage-cdn"),
      async (ctx) => {
        const session = await ctx.session;
        if (!session.other) (session as any).other = createInitialOtherSession();
        if (!session.other.cdn) session.other.cdn = { step: "idle" };
        session.other.cdn.fromManage = true;
        try {
          const { openCdnManageList } = await import("../ui/menus/cdn-menu.js");
          await openCdnManageList(ctx);
        } catch {
          await ctx.reply(ctx.t("cdn-error", { error: "Failed to open CDN list" }), {
            parse_mode: "HTML",
          });
        }
      }
    )
    .row()
    .submenu(
      (ctx) => ctx.t("button-manage-dedicated"),
      "dedicated-menu",
      async (ctx) => {
        await ctx.editMessageText(ctx.t("dedicated-menu-header"), {
          parse_mode: "HTML",
        });
      }
    )
    .row();

  if (showVpsVdsInServiceMenus()) {
    m = m
      .text((ctx) => ctx.t("button-my-vds"), async (ctx) => {
        await ctx.answerCallbackQuery().catch(() => {});
        try {
          await openVdsManageList(ctx);
        } catch (error) {
          Logger.error("openVdsManageList failed:", error);
          await ctx.reply(ctx.t("error-unknown", { error: "Failed to open VPS list" }), {
            parse_mode: "HTML",
          });
        }
      })
      .row();
  }

  return m.back(
    (ctx) => ctx.t("button-manage-services-back"),
    async (ctx) => {
      const session = await ctx.session;
      resetVdsManageListView(session);
      await ctx.editMessageText(ctx.t("welcome", { balance: session.main.user.balance }), {
        parse_mode: "HTML",
      });
    }
  );
}

export const manageServicesMenu = buildManageServicesMenu();
/** @deprecated Typo alias — use manageServicesMenu */
export const manageSerivcesMenu = manageServicesMenu;

const LIMIT_ON_PAGE = 10;

const emojiByStatus = (domainRequestStatus: DomainRequestStatus) => {
  switch (domainRequestStatus) {
    case DomainRequestStatus.InProgress:
      return "🔄";
    case DomainRequestStatus.Completed:
      return "✅";
    case DomainRequestStatus.Failed:
      return "❌";
  }
};

export const vdsReinstallOs = new Menu<AppContext>("vds-select-os-reinstall")
  .dynamic(async (ctx, range) => {
    const osList = ctx.osList;

    if (!osList) {
      await ctx.reply(ctx.t("bad-error"));
      return;
    }

    let count = 0;
    const allowedOsIds = getVmManagerAllowedOsIds();
    filterAndSortOsTemplatesForVpsPicker(osList.list, {
      allowedIds: allowedOsIds,
    }).forEach((os) => {
        const label = humanizeVmmOsName(os.name);
        range.text({ text: label, payload: `ros-${os.id}` }, async (ctx) => {
          await ctx.answerCallbackQuery().catch(() => {});
          const session = await ctx.session;
          ensureManageVdsSession(session);

          // Run function for create VM and buy it
          const id = session.other.manageVds.lastPickedId;

          const vdsRepo = ctx.appDataSource.getRepository(
            VirtualDedicatedServer
          );

          const vds = await vdsRepo.findOneBy({
            id: id,
          });

          if (vds) {
            if (Number(vds.targetUserId) !== Number(session.main.user.id)) {
              await ctx.reply(ctx.t("bad-error"));
              return;
            }
            if (isDemoVds(vds)) {
              await replyDemoOperation(ctx);
              return;
            }
            if (isVdsManagementBlocked(vds)) {
              await ctx.reply(ctx.t("vds-management-locked-notice"));
              return;
            }

            await ctx.editMessageText(ctx.t("await-please"), {
              parse_mode: "HTML",
              link_preview_options: { is_disabled: true },
              reply_markup: clearedInlineKeyboard(),
            });
            // Avoid ctx.menu.close() here: deferred editMessageReplyMarkup would restore the OS grid after the long reinstall.

            const rootPassword = vds.password?.trim() || generatePassword(12);
            const proxmoxMarker = buildVdsProxmoxDescriptionLine(vds);
            let reinstall: unknown;
            try {
              for (let attempt = 0; attempt < 4; attempt++) {
                reinstall = await ctx.vmmanager.reinstallOS(
                  vds.vdsId,
                  os.id,
                  rootPassword,
                  proxmoxMarker
                );
                if (reinstall) break;
              }
            } catch (error) {
              Logger.error("VDS reinstallOS failed", error);
              await ctx.reply(ctx.t("vds-reinstall-failed"), { parse_mode: "HTML" });
              return;
            }

            if (!reinstall) {
              await ctx.reply(ctx.t("vds-reinstall-failed"), { parse_mode: "HTML" });
              return;
            }

            if (
              typeof reinstall === "object" &&
              reinstall !== null &&
              "_rootPassword" in reinstall &&
              typeof (reinstall as { _rootPassword?: string })._rootPassword === "string"
            ) {
              const np = (reinstall as { _rootPassword: string })._rootPassword;
              if (np) vds.password = np;
            } else {
              vds.password = rootPassword;
            }
            vds.lastOsId = os.id;
            vds.login = resolveVdsLoginForOs({ osName: os.name, osId: os.id, storedLogin: vds.login });

            await vdsRepo.save(vds);
            await ctx.deleteMessage();
            await ctx.reply(ctx.t("vds-reinstall-started"));
          }
        });

        count++;
        if (count % 2 === 0) {
          range.row();
        }
      });

    if (count % 2 !== 0) {
      range.row();
    }
  })
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      const session = await ctx.session;
      ensureManageVdsSession(session);
      // Returning from OS list should land in "more" panel where reinstall is opened.
      (session.other.manageVds as any).panelMode = "more";
      await updateVdsManageView(ctx);
    }
  );

export const vdsManageSpecific = new Menu<AppContext>(
  "vds-manage-specific"
).dynamic(async (ctx, range) => {
  const session = await ctx.session;
  ensureManageVdsSession(session);

  const matchRaw = ctx.match as unknown;
  let vdsId = session.other.manageVds.lastPickedId;
  if (matchRaw != null && matchRaw !== "") {
    if (typeof matchRaw === "string" && /^\d+$/.test(matchRaw)) {
      vdsId = Number.parseInt(matchRaw, 10);
    } else if (typeof matchRaw === "number" && Number.isFinite(matchRaw)) {
      vdsId = matchRaw;
    }
  }

  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

  const vds = await vdsRepo.findOneBy({
    id: vdsId,
  });

  if (!vds) {
    await ctx.reply(ctx.t("bad-error"));
    return;
  }

  if (session.main.user.id != vds.targetUserId) {
    return;
  }

  const serviceId = vds.id;
  session.other.manageVds.lastPickedId = serviceId;

  const demoMode = isDemoVds(vds);
  const info = await resolveVdsManageInfo(ctx, vds);

  if (isVdsManagementBlocked(vds)) {
    const extra = vds.adminBlocked
      ? ctx.t("vds-admin-blocked-notice")
      : ctx.t("vds-management-locked-notice");
    try {
      await ctx.editMessageText(`${vdsInfoText(ctx, vds, info)}\n\n${extra}`, {
        parse_mode: "HTML",
      });
    } catch {
      /* noop */
    }
    range.text(ctx.t("button-back"), async (ctx) => {
      await ctx.deleteMessage().catch(() => {});
    });
    return;
  }

  range.copyText(ctx.t("vds-button-copy-password"), vds.password);

  if (!demoMode && info.state == "creating") {
    range.text(ctx.t("update-button"), async (ctx) => {
      ctx.menu.update();
    });
  } else {
    try {
      await ctx.editMessageText(vdsInfoText(ctx, vds, info), {
        parse_mode: "HTML",
      });
    } catch (err) {
      console.log("[Menu Manage VDS] Okay updated");
    }
  }

  if (info.state == "stopped") {
    range.text(
      {
        text: ctx.t("vds-button-start-machine"),
        payload: serviceId.toString(),
      },
      async (ctx) => {
        if (demoMode) {
          await replyDemoOperation(ctx);
          return;
        }
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = serviceId;

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: serviceId,
        });

        if (vds) {
          const result = await ctx.vmmanager.startVM(vds.vdsId);

          let info;

          for (let attempt = 0; attempt < 4; attempt++) {
            info = await ctx.vmmanager.getInfoVM(vds.vdsId);
            if (info) break;
          }

          if (!info) {
            await ctx.reply(ctx.t("failed-to-retrieve-info"));
            return;
          }

          info.state = "active";

          if (result) {
            await ctx.editMessageText(vdsInfoText(ctx, vds, info), {
              parse_mode: "HTML",
            });

            await new Promise((resolve) => setTimeout(resolve, 6000));
            ctx.menu.update();
          }
        }
      }
    );
  }

  if (info.state == "active") {
    range.text(
      {
        text: ctx.t("vds-button-stop-machine"),
        payload: serviceId.toString(),
      },
      async (ctx) => {
        if (demoMode) {
          await replyDemoOperation(ctx);
          return;
        }
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = serviceId;

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: serviceId,
        });

        if (vds) {
          const result = await ctx.vmmanager.stopVM(vds.vdsId);

          let info;

          while (info == undefined) {
            info = await ctx.vmmanager.getInfoVM(vds.vdsId);
          }

          info.state = "stopped";

          if (result) {
            await ctx.editMessageText(vdsInfoText(ctx, vds, info), {
              parse_mode: "HTML",
            });

            await new Promise((resolve) => setTimeout(resolve, 6000));
            ctx.menu.update();
          }
        }
      }
    );
  }

  if (info.state == "active" || info.state == "stopped" || demoMode) {
    range.row();
    range.text(
      {
        text: ctx.t("vds-button-regenerate-password"),
        payload: serviceId.toString(),
      },
      async (ctx) => {
        if (demoMode) {
          await replyDemoOperation(ctx);
          return;
        }
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = serviceId;

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: serviceId,
        });

        if (vds) {
          const result = await ctx.vmmanager.changePasswordVM(vds.vdsId);

          if (result) {
            vds.password = result;
            await vdsRepo.save(vds);

            await ctx.reply(
              ctx.t("vds-new-password", {
                password: vds.password,
              }),
              {
                parse_mode: "HTML",
              }
            );

            let info;

            while (info == undefined) {
              info = await ctx.vmmanager.getInfoVM(vds.vdsId);
            }

            await new Promise((resolve) => setTimeout(resolve, 6000));
            await ctx.editMessageText(vdsInfoText(ctx, vds, info), {
              parse_mode: "HTML",
            });
            ctx.menu.update();
          }
        }
      }
    );

    range.text(
      {
        text: ctx.t("vds-button-reinstall-os"),
        payload: serviceId.toString(),
      },
      async (ctx) => {
        if (demoMode) {
          await replyDemoOperation(ctx);
          return;
        }
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = serviceId;

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: serviceId,
        });

        if (vds) {
          ctx.menu.nav("vds-select-os-reinstall");
        }
      }
    );

    range.text(
      {
        text: ctx.t("vds-button-rename"),
        payload: serviceId.toString(),
      },
      async (ctx) => {
        await ctx.answerCallbackQuery().catch(() => {});
        await startRenamePrompt(ctx, serviceId);
      }
    );
  }

  range.row();

  range.text(ctx.t("button-back"), async (ctx) => {
    await ctx.deleteMessage();
    // await ctx.deleteMessage();
    // ctx.menu.close();
  });
});

/**
 * Conversation for renaming VDS.
 */
export async function renameVdsConversation(
  conversation: AppConversation,
  ctx: AppContext
) {
  let replyCtx: AppContext = ctx;
  const session = await ctx.session;
  ensureManageVdsSession(session);
  const vdsId = session.other.manageVds.lastPickedId;

  if (!vdsId || vdsId === -1) {
    await ctx.reply(ctx.t("error-invalid-context"));
    return;
  }

  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const vds = await vdsRepo.findOneBy({ id: vdsId });

  if (!vds || Number(vds.targetUserId) !== Number(session.main.user.id)) {
    await ctx.reply(ctx.t("error-access-denied"));
    return;
  }

  if (isDemoVds(vds)) {
    await ctx.reply(ctx.t("demo-operation-not-available"));
    return;
  }
  if (isVdsManagementBlocked(vds)) {
    await ctx.reply(ctx.t("vds-management-locked-notice"));
    return;
  }

  await ctx.reply(ctx.t("vds-rename-enter-name", {
    currentName: vds.displayName || vds.rateName || `VDS #${vds.id}`,
    minLength: 3,
    maxLength: 32,
  }), {
    parse_mode: "HTML",
  });

  const nameCtx = await conversation.waitFor("message:text");
  replyCtx = nameCtx as AppContext;
  const newName = nameCtx.message.text.trim();

  // Validate
  if (newName.length < 3 || newName.length > 32) {
    await replyCtx.reply(ctx.t("vds-rename-invalid-length", {
      minLength: 3,
      maxLength: 32,
    }));
    return;
  }

  if (newName.includes("\n") || newName.includes("\r")) {
    await replyCtx.reply(ctx.t("vds-rename-no-linebreaks"));
    return;
  }

  try {
    const vdsRepository = new VdsRepository(ctx.appDataSource);
    const userRepository = new UserRepository(ctx.appDataSource);
    const topUpRepository = new TopUpRepository(ctx.appDataSource);
    const billingService = new BillingService(ctx.appDataSource, userRepository, topUpRepository);
    const vdsService = new VdsService(ctx.appDataSource, vdsRepository, billingService, ctx.vmmanager);

    await vdsService.renameVds(vdsId, session.main.user.id, newName);

    await replyCtx.reply(ctx.t("vds-rename-success", {
      newName: newName,
    }), {
      parse_mode: "HTML",
    });

    const updatedVds = await vdsRepo.findOneBy({ id: vdsId });
    if (updatedVds) {
      const sessAfter = await replyCtx.session;
      let info: ListItem | undefined;
      for (let attempt = 0; attempt < 4; attempt++) {
        info = await replyCtx.vmmanager.getInfoVM(updatedVds.vdsId);
        if (info) break;
      }
      const fallback = { state: "active" } as ListItem;
      await replyCtx.reply(
        buildVdsManageText(replyCtx, updatedVds, info ?? fallback, sessAfter.other.manageVds.showPassword),
        {
          parse_mode: "HTML",
          reply_markup: vdsManageServiceMenu,
        }
      );
    }
  } catch (error: any) {
    console.error("Failed to rename VDS:", error);
    await replyCtx.reply(ctx.t("error-unknown", {
      error: error.message || "Unknown error",
    }));
  }
}

/**
 * Conversation: set VDS password manually (VMManager API).
 */
export async function vdsPasswordManualConversation(
  conversation: AppConversation,
  ctx: AppContext
) {
  const session = await ctx.session;
  ensureManageVdsSession(session);
  const vdsId = session.other.manageVds.lastPickedId;
  if (!vdsId || vdsId === -1) {
    await ctx.reply(ctx.t("error-invalid-context"));
    return;
  }
  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const vds = await vdsRepo.findOneBy({ id: vdsId });
  if (!vds || Number(vds.targetUserId) !== Number(session.main.user.id)) {
    await ctx.reply(ctx.t("error-access-denied"));
    return;
  }
  if (isDemoVds(vds)) {
    await ctx.reply(ctx.t("demo-operation-not-available"));
    return;
  }
  if (isVdsManagementBlocked(vds)) {
    await ctx.reply(ctx.t("vds-management-locked-notice"));
    return;
  }

  await ctx.reply(ctx.t("vds-password-manual-prompt"), { parse_mode: "HTML" });
  const nextCtx = await conversation.waitFor("message:text");
  const text = nextCtx.message?.text?.trim() ?? "";
  if (text.length < 8 || text.length > 128) {
    await ctx.reply(ctx.t("vds-password-manual-invalid"));
    return;
  }

  const ok = await ctx.vmmanager
    .changePasswordVMCustom(vds.vdsId, text)
    .catch((e) => {
      Logger.warn("changePasswordVMCustom failed; saving DB only", {
        vmid: vds.vdsId,
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    });
  if (!ok) {
    Logger.warn(
      "VM provider did not apply manual password; persisting to DB only",
      { vmid: vds.vdsId }
    );
  }
  vds.password = text;
  await vdsRepo.save(vds);
  await ctx.reply(ctx.t("vds-password-manual-success"), { parse_mode: "HTML" });
}

const status = (state: ListItem["state"], ctx: AppContext) => {
  switch (state) {
    case "creating":
      return ctx.t("vds-creating");
    case "stopped":
      return ctx.t("vds-stopped");
    case "active":
      return ctx.t("vds-work");
  }
};

const vdsInfoText = (
  ctx: AppContext,
  vds: VirtualDedicatedServer,
  info: ListItem
) => {
  const os = ctx.osList?.list.find((os) => os.id == vds.lastOsId);
  const displayName = vds.displayName || vds.rateName || `VDS #${vds.id}`;

  return ctx.t("vds-current-info", {
    displayName: displayName,
    expireAt: vds.expireAt,
    price: vds.renewalPrice,
    abuse: vds.isBulletproof
      ? ctx.t("bulletproof-on")
      : ctx.t("bulletproof-off"),
    rateName: vds.rateName,
    cpu: vds.cpuCount,
    ram: vds.ramSize,
    disk: vds.diskSize,
    ip: vds.ipv4Addr,
    status: status(info.state, ctx),
    osName: os?.name || "undefined",
  });
};

export const vdsManageServiceMenu = new Menu<AppContext>("vds-manage-services-list", {
  autoAnswer: false,
  onMenuOutdated: false,
})
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    ensureManageVdsSession(session);
    const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
    const expandedId = session.other.manageVds.expandedId;

    if (expandedId) {
      const expanded = await vdsRepo.findOneBy({ id: expandedId });
      const ownerOk =
        expanded != null &&
        Number(expanded.targetUserId) === Number(session.main.user.id);

      if (!ownerOk) {
        session.other.manageVds.expandedId = null;
        (session.other.manageVds as any).panelMode = "main";
        session.other.manageVds.showPassword = false;
      } else {
        const showPassword = session.other.manageVds.showPassword;
        const blocked = isVdsManagementBlocked(expanded);
        const panelMode = (session.other.manageVds as any).panelMode || "main";
        const demoMode = isDemoVds(expanded);
        let powerState: ListItem["state"] = "active";
        if (!demoMode) {
          let liveInfo: ListItem | undefined;
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              liveInfo = await ctx.vmmanager.getInfoVM(expanded.vdsId);
            } catch (e) {
              Logger.warn("vdsManageServiceMenu: getInfoVM threw", {
                vmid: expanded.vdsId,
                error: e instanceof Error ? e.message : String(e),
              });
            }
            if (liveInfo?.state) break;
          }
          if (liveInfo?.state) powerState = liveInfo.state;
        }

        range.text(
          showPassword ? ctx.t("button-hide-password") : ctx.t("button-show-password"),
          async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            const session = await ctx.session;
            session.other.manageVds.showPassword = !session.other.manageVds.showPassword;
            await updateVdsManageView(ctx);
          }
        );
        range.row();

        if (panelMode === "renew") {
          const periods = [1, 3, 6, 12] as const;
          for (const m of periods) {
            range.text(
              () =>
                ctx.t("vds-renew-period-label", {
                  months: m,
                  total: Math.round(expanded.renewalPrice * m * 100) / 100,
                }),
              async (ctx) => {
              await ctx.answerCallbackQuery().catch(() => {});
              const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
              const vds = await vdsRepo.findOneBy({ id: expandedId });
              if (!vds || Number(vds.targetUserId) !== Number(session.main.user.id)) {
                await ctx.reply(ctx.t("bad-error"));
                return;
              }
              const total = Math.round(vds.renewalPrice * m * 100) / 100;
              const sess = await ctx.session;
              sess.other.manageVds.pendingRenewMonths = m;
              await ctx.reply(ctx.t("vds-renew-confirm-ask", { months: m, total }), {
                parse_mode: "HTML",
                reply_markup: new InlineKeyboard()
                  .text(ctx.t("button-confirm"), `vds-renew-yes:${expandedId}:${m}`)
                  .text(ctx.t("button-cancel"), `vds-renew-no:${expandedId}`),
              });
              }
            );
            if (m === 3) range.row();
          }
          range.row();
          return;
        }

        if (panelMode === "more") {
          range.text(
            expanded.autoRenewEnabled !== false
              ? ctx.t("vds-autorenew-disable")
              : ctx.t("vds-autorenew-enable"),
            async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
            const vds = await vdsRepo.findOneBy({ id: expandedId });
            if (!vds) return;
            const vdsRepository = new VdsRepository(ctx.appDataSource);
            const userRepository = new UserRepository(ctx.appDataSource);
            const topUpRepository = new TopUpRepository(ctx.appDataSource);
            const billingService = new BillingService(ctx.appDataSource, userRepository, topUpRepository);
            const vdsService = new VdsService(ctx.appDataSource, vdsRepository, billingService, ctx.vmmanager);
            const cur = vds.autoRenewEnabled !== false;
            await vdsService.setAutoRenewEnabled(expandedId, session.main.user.id, !cur);
            await updateVdsManageView(ctx);
            }
          );
          range.row();

          range.text(ctx.t("vds-button-reinstall-os"), async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            try {
              const session = await ctx.session;
              ensureManageVdsSession(session);
              session.other.manageVds.lastPickedId = expandedId;
              const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
              const vds = await vdsRepo.findOneBy({ id: expandedId });
              if (!vds) {
                await ctx.reply(ctx.t("bad-error"));
                return;
              }
              if (isDemoVds(vds)) {
                await replyDemoOperation(ctx);
                return;
              }
              if (isVdsManagementBlocked(vds)) {
                await ctx.reply(ctx.t("vds-management-locked-notice"));
                return;
              }
              await ctx.menu.nav("vds-select-os-reinstall");
            } catch (error: any) {
              await ctx.reply(ctx.t("error-unknown", { error: error?.message || "Unknown error" }));
            }
          });
          range.row();

          range.text(ctx.t("vds-button-new-password"), async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
            const vds = await vdsRepo.findOneBy({ id: expandedId });
            if (!vds) {
              await ctx.reply(ctx.t("bad-error"));
              return;
            }
            if (isDemoVds(vds)) {
              await replyDemoOperation(ctx);
              return;
            }
            let newPassword: string;
            try {
              newPassword = await ctx.vmmanager.changePasswordVM(vds.vdsId);
            } catch (e) {
              // Manual admin-issued VPS: provider rejects the call.
              // Generate locally and update DB only — admin will sync the OS
              // password manually if needed.
              Logger.warn("changePasswordVM failed; generating locally", {
                vmid: vds.vdsId,
                error: e instanceof Error ? e.message : String(e),
              });
              newPassword = generatePassword(16);
            }
            vds.password = newPassword;
            await vdsRepo.save(vds);
            await ctx.reply(ctx.t("vds-new-password", { password: newPassword }), {
              parse_mode: "HTML",
            });
            await updateVdsManageView(ctx);
          });

          range.text(ctx.t("vds-password-manual"), async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            await startManualPasswordPrompt(ctx, expandedId);
          });
          range.row();

          range.text(ctx.t("vds-button-rename"), async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            await startRenamePrompt(ctx, expandedId);
          });

          if (canOfferExtraIpv4Purchase(ctx, expanded)) {
            const price = getExtraIpv4MonthlyPriceUsd();
            range.text(ctx.t("vds-button-extra-ipv4", { price }), async (ctx) => {
              await ctx.answerCallbackQuery().catch(() => {});
              await ctx.reply(
                ctx.t("vds-extra-ipv4-confirm-ask", {
                  price,
                  renewal: Math.round((expanded.renewalPrice + price) * 100) / 100,
                }),
                {
                  parse_mode: "HTML",
                  reply_markup: new InlineKeyboard()
                    .text(ctx.t("button-confirm"), `vds-extra-ipv4-yes:${expandedId}`)
                    .text(ctx.t("button-cancel"), `vds-extra-ipv4-no:${expandedId}`),
                }
              );
            });
          }
          range.row();

          range.text(ctx.t("vds-button-support-request"), async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            try {
              const supportUrl = `tg://resolve?domain=diorhost&text=${encodeURIComponent(
                ctx.t("support-message-template")
              )}`;
              await ctx.reply(ctx.t("support"), {
                parse_mode: "HTML",
                link_preview_options: { is_disabled: true },
                reply_markup: new InlineKeyboard().url(ctx.t("button-ask-question"), supportUrl),
              });
            } catch (error: any) {
              await ctx.reply(ctx.t("error-unknown", { error: error?.message || "Unknown error" }));
            }
          });
          range.row();
          return;
        }

        if (!blocked) {
          if (powerState === "active") {
            range.text(ctx.t("button-reboot"), async (ctx) => {
              await ctx.answerCallbackQuery().catch(() => {});
              const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
              const vds = await vdsRepo.findOneBy({ id: expandedId });
              if (!vds) {
                await ctx.reply(ctx.t("bad-error"));
                return;
              }
              if (isDemoVds(vds)) {
                await replyDemoOperation(ctx);
                return;
              }
              try {
                await ctx.vmmanager.stopVM(vds.vdsId);
                await ctx.vmmanager.startVM(vds.vdsId);
              } catch (e) {
                Logger.warn("user-side reboot: VM provider failed", {
                  vmid: vds.vdsId,
                  error: e instanceof Error ? e.message : String(e),
                });
                await ctx.reply(ctx.t("bad-error"));
                return;
              }
              await updateVdsManageView(ctx);
            });
            range.text(ctx.t("vds-button-power-off"), async (ctx) => {
              await ctx.answerCallbackQuery().catch(() => {});
              const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
              const vds = await vdsRepo.findOneBy({ id: expandedId });
              if (!vds) {
                await ctx.reply(ctx.t("bad-error"));
                return;
              }
              if (isDemoVds(vds)) {
                await replyDemoOperation(ctx);
                return;
              }
              try {
                await ctx.vmmanager.stopVM(vds.vdsId);
              } catch (e) {
                Logger.warn("user-side power-off: VM provider failed", {
                  vmid: vds.vdsId,
                  error: e instanceof Error ? e.message : String(e),
                });
                await ctx.reply(ctx.t("bad-error"));
                return;
              }
              await updateVdsManageView(ctx);
            });
            range.row();
          } else {
            range.text(ctx.t("vds-button-power-on"), async (ctx) => {
              await ctx.answerCallbackQuery().catch(() => {});
              const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
              const vds = await vdsRepo.findOneBy({ id: expandedId });
              if (!vds) {
                await ctx.reply(ctx.t("bad-error"));
                return;
              }
              if (isDemoVds(vds)) {
                await replyDemoOperation(ctx);
                return;
              }
              try {
                await ctx.vmmanager.startVM(vds.vdsId);
              } catch (e) {
                Logger.warn("user-side power-on: VM provider failed", {
                  vmid: vds.vdsId,
                  error: e instanceof Error ? e.message : String(e),
                });
                await ctx.reply(ctx.t("bad-error"));
                return;
              }
              await updateVdsManageView(ctx);
            });
            range.row();
          }
        }

        range.text(ctx.t("vds-button-renew"), async (ctx) => {
          await ctx.answerCallbackQuery().catch(() => {});
          const session = await ctx.session;
          (session.other.manageVds as any).panelMode = "renew";
          await ctx.menu.update();
        });
        if (!blocked) {
          range.text(ctx.t("vds-button-more"), async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            const session = await ctx.session;
            (session.other.manageVds as any).panelMode = "more";
            await ctx.menu.update();
          });
        }
        return;
      }
    }

    const [vdsList, total] = await vdsRepo.findAndCount({
      where: [
        {
          targetUserId: session.main.user.id,
        },
      ],
      take: LIMIT_ON_PAGE,
      skip: session.other.manageVds.page * LIMIT_ON_PAGE,
    });

    if (total === 0) {
      range.text(ctx.t("list-empty"), async (ctx) => {
        await ctx.answerCallbackQuery().catch(() => {});
      });
      return;
    }

    const maxPages = Math.ceil(total / LIMIT_ON_PAGE) - 1;

    for (const vds of vdsList) {
      const rateName = (vds.rateName || "").trim() || `VDS #${vds.id}`;
      const customName = (vds.displayName || "").trim();
      const listLabel =
        customName.length > 0 && customName !== rateName
          ? `${customName} (${rateName})`
          : rateName;
      range
        .text(
          {
            text: ctx.t("vds-manage-list-item", {
              label: listLabel,
              ip: vds.ipv4Addr,
            }),
            payload: vds.id.toString(),
          },
          async (ctx) => {
            const session = await ctx.session;

            const vdsRepo = ctx.appDataSource.getRepository(
              VirtualDedicatedServer
            );

            await ctx.answerCallbackQuery().catch(() => {});

            const pickedId = parseMenuNumericPayload(ctx.match);
            const vds = Number.isFinite(pickedId)
              ? await vdsRepo.findOneBy({ id: pickedId })
              : null;

            if (!vds || Number(vds.targetUserId) !== Number(session.main.user.id)) {
              await ctx.reply(ctx.t("bad-error"));
              return;
            }

            const current = session.other.manageVds.expandedId;
            if (current === vds.id) {
              session.other.manageVds.expandedId = null;
              session.other.manageVds.showPassword = false;
              (session.other.manageVds as any).panelMode = "main";
            } else {
              session.other.manageVds.expandedId = vds.id;
              session.other.manageVds.showPassword = false;
              session.other.manageVds.lastPickedId = vds.id;
              (session.other.manageVds as any).panelMode = "main";
            }

            await updateVdsManageView(ctx);
          }
        )
        .row();
    }

    if (vdsList.length == LIMIT_ON_PAGE) {
      range.text(
        (ctx) => ctx.t("pagination-left"),
        async (ctx) => {
          if (session.other.manageVds.page - 1 < 0) {
            session.other.manageVds.page = maxPages;
          } else {
            session.other.manageVds.page--;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );
      range.text(() => `${session.other.manageVds.page + 1}/${maxPages + 1}`);
      range.text(
        (ctx) => ctx.t("pagination-right"),
        async (ctx) => {
          session.other.manageVds.page++;

          if (session.other.manageVds.page > maxPages) {
            session.other.manageVds.page = 0;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );
    }
  })
  .row()
  .text(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      const session = await ctx.session;
      ensureManageVdsSession(session);
      const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
      const ex = session.other.manageVds.expandedId;
      const panelMode = (session.other.manageVds as any).panelMode || "main";

      if (ex && (panelMode === "more" || panelMode === "renew")) {
        (session.other.manageVds as any).panelMode = "main";
        await updateVdsManageView(ctx);
        return;
      }

      if (ex) {
        session.other.manageVds.expandedId = null;
        session.other.manageVds.lastPickedId = -1;
        session.other.manageVds.showPassword = false;
        (session.other.manageVds as any).panelMode = "main";
        await updateVdsManageView(ctx);
        return;
      }

      await ctx.editMessageText(ctx.t("manage-services-header"), {
        parse_mode: "HTML",
        reply_markup: manageServicesMenu,
      });
    }
  );

export const domainManageServicesMenu = new Menu<AppContext>(
  "domain-manage-services-menu"
)
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    const userId = session.main.user.id;

    const domainRepo = ctx.appDataSource.getRepository(Domain);
    const domainRequestRepo = ctx.appDataSource.getRepository(DomainRequest);

    const amperCount = await domainRepo.count({ where: { userId } });
    const requestCount = await domainRequestRepo.count({
      where: [
        {
          target_user_id: userId,
          status: DomainRequestStatus.InProgress,
        },
        {
          target_user_id: userId,
          status: DomainRequestStatus.Completed,
        },
      ],
    });

    if (amperCount === 0 && requestCount === 0) {
      range.text(ctx.t("list-empty"), async (ctx) => {
        await ctx.answerCallbackQuery().catch(() => {});
      });
      return;
    }

    const amperDomains = await domainRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: LIMIT_ON_PAGE,
      skip: session.other.domains.page * LIMIT_ON_PAGE,
    });

    const [domainRequests, total] = await domainRequestRepo.findAndCount({
      where: [
        {
          target_user_id: userId,
          status: DomainRequestStatus.InProgress,
        },
        {
          target_user_id: userId,
          status: DomainRequestStatus.Completed,
        },
      ],
      take: LIMIT_ON_PAGE,
      skip: session.other.domains.page * LIMIT_ON_PAGE,
    });

    // Add Amper domains to menu
    for (const domain of amperDomains) {
      const statusEmoji = domain.status === "registered" ? "✅" :
                         domain.status === "registering" ? "🔄" :
                         domain.status === "failed" ? "❌" : "⏳";
      range.text(
        `${statusEmoji} ${domain.domain} (Amper)`,
        async (ctx) => {
          const { DomainRepository } = await import("@/infrastructure/db/repositories/DomainRepository");
          const domainRepo = new DomainRepository(ctx.appDataSource);
          const domainEntity = await domainRepo.findById(domain.id);
          
          if (!domainEntity) {
            await ctx.answerCallbackQuery(ctx.t("domain-was-not-found"));
            return;
          }

          const statusText = {
            draft: ctx.t("domain-status-draft"),
            wait_payment: ctx.t("domain-status-wait-payment"),
            registering: ctx.t("domain-status-registering"),
            registered: ctx.t("domain-status-registered"),
            failed: ctx.t("domain-status-failed"),
            expired: ctx.t("domain-status-expired"),
          }[domainEntity.status] || domainEntity.status;

          await ctx.reply(
            ctx.t("domain-information-amper", {
              domain: domainEntity.domain,
              status: statusText,
              tld: domainEntity.tld,
              period: domainEntity.period,
              price: domainEntity.price,
              ns1: domainEntity.ns1 || ctx.t("not-specified"),
              ns2: domainEntity.ns2 || ctx.t("not-specified"),
            }),
            {
              parse_mode: "HTML",
              reply_markup: new InlineKeyboard()
                .text(ctx.t("button-domain-update-ns"), `domain_update_ns_${domainEntity.id}`)
                .row()
                .text(ctx.t("button-back"), "manage-services-menu-back"),
            }
          );
        }
      ).row();
    }

    const maxPages = Math.ceil(total / LIMIT_ON_PAGE) - 1;

    for (const domainRequest of domainRequests) {
      range
        .text(
          `${domainRequest.domainName}${domainRequest.zone} ${emojiByStatus(
            domainRequest.status
          )}`,
          async (ctx) => {
            if (domainRequest.status == DomainRequestStatus.InProgress) {
              await ctx.answerCallbackQuery(
                ctx.t("domain-cannot-manage-while-in-progress")
              );
              return;
            }

            const domainsRepo = (await getAppDataSource()).getRepository(
              DomainRequest
            );

            const domain = await domainsRepo.findOne({
              where: {
                id: domainRequest.id,
              },
            });

            if (!domain) {
              await ctx.answerCallbackQuery(ctx.t("domain-was-not-found"));
              return;
            }

            await ctx.reply(
              await ctx.t("domain-information", {
                domain: `${domain.domainName}${domain.zone}`,
                price: domain.price,
                paydayAt: domain.payday_at,
                expireAt: domain.expireAt,
              }),
              {
                parse_mode: "HTML",
                reply_markup: new InlineKeyboard().url(
                  ctx.t("button-support"),
                  `tg://resolve?domain=diorhost&text=${encodeURIComponent(
                    ctx.t("support-message-template")
                  )}`
                ),
              }
            );
          }
        )
        .row();
    }

    if (domainRequests.length == LIMIT_ON_PAGE) {
      range.text(
        (ctx) => ctx.t("pagination-left"),
        async (ctx) => {
          if (session.other.domains.page - 1 < 0) {
            session.other.domains.page = maxPages;
          } else {
            session.other.domains.page--;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );
      range.text(() => `${session.other.domains.page + 1}/${maxPages + 1}`);
      range.text(
        (ctx) => ctx.t("pagination-right"),
        async (ctx) => {
          session.other.domains.page++;

          if (session.other.domains.page > maxPages) {
            session.other.domains.page = 0;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );
    }
  })
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;
      await ctx.editMessageText(
        ctx.t("manage-services-header"),
        {
          parse_mode: "HTML",
        }
      );
    }
  );

/** Menu for services purchased as part of an infrastructure bundle (domain + VPS). */
export const bundleManageServicesMenu = new Menu<AppContext>(
  "bundle-manage-services-menu"
)
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    const userId = session.main.user.id;
    const domainRepo = ctx.appDataSource.getRepository(Domain);
    const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

    const bundleDomains = await domainRepo.find({
      where: { userId, bundleType: Not(IsNull()) },
      order: { createdAt: "DESC" },
    });
    const bundleVds = await vdsRepo.find({
      where: { targetUserId: userId, bundleType: Not(IsNull()) },
      order: { createdAt: "DESC" },
    });

    for (const domain of bundleDomains) {
      const statusEmoji =
        domain.status === "registered"
          ? "✅"
          : domain.status === "registering"
            ? "🔄"
            : domain.status === "failed"
              ? "❌"
              : "⏳";
      range
        .text(`${statusEmoji} 🌐 ${domain.domain}`, async (ctx) => {
          const statusText = {
            draft: ctx.t("domain-status-draft"),
            wait_payment: ctx.t("domain-status-wait-payment"),
            registering: ctx.t("domain-status-registering"),
            registered: ctx.t("domain-status-registered"),
            failed: ctx.t("domain-status-failed"),
            expired: ctx.t("domain-status-expired"),
          }[domain.status] || domain.status;
          await ctx.reply(
            ctx.t("domain-information-amper", {
              domain: domain.domain,
              status: statusText,
              tld: domain.tld,
              period: domain.period,
              price: domain.price,
              ns1: domain.ns1 || ctx.t("not-specified"),
              ns2: domain.ns2 || ctx.t("not-specified"),
            }),
            {
              parse_mode: "HTML",
              reply_markup: new InlineKeyboard()
                .text(ctx.t("button-domain-update-ns"), `domain_update_ns_${domain.id}`)
                .row()
                .text(ctx.t("button-back"), "manage-services-menu-back"),
            }
          );
        })
        .row();
    }

    for (const vds of bundleVds) {
      range
        .text(`🖥 ${vds.rateName} ${vds.ipv4Addr || ""}`, async (ctx) => {
          const session = await ctx.session;
          session.other.manageVds.expandedId = vds.id;
          session.other.manageVds.showPassword = false;
          let info: ListItem | null = null;
          try {
            if (ctx.vmmanager) {
              info = (await ctx.vmmanager.getInfoVM(vds.vdsId)) as ListItem;
            }
          } catch {
            // VM might be off or API error
          }
          await ctx.editMessageText(
            buildVdsManageText(ctx, vds, info, false),
            {
              parse_mode: "HTML",
              reply_markup: vdsManageServiceMenu,
            }
          );
        })
        .row();
    }

    if (bundleDomains.length === 0 && bundleVds.length === 0) {
      range.text(ctx.t("bundle-manage-empty"), async (ctx) => {
        await ctx.answerCallbackQuery();
      }).row();
    }
  })
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      await ctx.editMessageText(ctx.t("manage-services-header"), {
        parse_mode: "HTML",
        reply_markup: manageServicesMenu,
      });
    }
  );
