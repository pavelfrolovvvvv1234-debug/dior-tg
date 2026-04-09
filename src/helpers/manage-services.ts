import { Menu } from "@grammyjs/menu";
import { Not, IsNull } from "typeorm";
import { mainMenu } from "..";
import type { AppContext, AppConversation } from "../shared/types/context";
import DomainRequest, { DomainRequestStatus } from "@/entities/DomainRequest";
import Domain from "@/entities/Domain";
import { getAppDataSource } from "@/database";
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

const isDemoVds = (vds: VirtualDedicatedServer): boolean => {
  const rateName = (vds.rateName || "").toLowerCase();
  return vds.vdsId <= 0 || rateName.includes("demo");
};

const getDemoVdsInfo = (): ListItem => {
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

const isVdsManagementBlocked = (vds: VirtualDedicatedServer): boolean =>
  vds.managementLocked === true || vds.adminBlocked === true;

const buildVdsManageText = (
  ctx: AppContext,
  vds: VirtualDedicatedServer | null,
  info: ListItem | null,
  showPassword: boolean
): string => {
  const header = `<strong>${ctx.t("vds-manage-title")}</strong>`;
  if (!vds || !info) {
    return header;
  }

  const os = ctx.osList?.list.find((os) => os.id == vds.lastOsId);
  const osName = os?.name || "N/A";

  const infoBlock = buildServiceInfoBlock(ctx, {
    ip: vds.ipv4Addr,
    login: vds.login,
    password: vds.password,
    showPassword,
    os: osName,
    statusLabel: getStatusLabel(ctx, info.state),
    createdAt: vds.createdAt,
    paidUntil: vds.expireAt,
  });

  const ipv4Total = 1 + (vds.extraIpv4Count ?? 0);
  const autoLine = ctx.t("vds-autorenew-line", {
    state:
      vds.autoRenewEnabled !== false
        ? ctx.t("vds-autorenew-on")
        : ctx.t("vds-autorenew-off"),
  });
  const ipLine = ctx.t("vds-ipv4-count-line", { count: ipv4Total });
  let lockLine = "";
  if (vds.adminBlocked) {
    lockLine = `\n\n${ctx.t("vds-admin-blocked-notice")}`;
  } else if (vds.managementLocked) {
    lockLine = `\n\n${ctx.t("vds-management-locked-notice")}`;
  }

  return `${header}\n\n${infoBlock}\n\n${autoLine}\n${ipLine}${lockLine}`;
};

const updateVdsManageView = async (ctx: AppContext): Promise<void> => {
  const session = await ctx.session;
  const expandedId = session.other.manageVds.expandedId;

  if (!expandedId) {
    await ctx.editMessageText(buildVdsManageText(ctx, null, null, false), {
      parse_mode: "HTML",
      reply_markup: vdsManageServiceMenu,
    });
    return;
  }

  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const vds = await vdsRepo.findOneBy({ id: expandedId });
  if (!vds) {
    session.other.manageVds.expandedId = null;
    await ctx.editMessageText(buildVdsManageText(ctx, null, null, false), {
      parse_mode: "HTML",
      reply_markup: vdsManageServiceMenu,
    });
    return;
  }

  let info: ListItem | undefined;
  const demoMode = isDemoVds(vds);

  if (demoMode) {
    info = getDemoVdsInfo();
  } else {
    for (let attempt = 0; attempt < 4; attempt++) {
      info = await ctx.vmmanager.getInfoVM(vds.vdsId);
      if (info) break;
    }
  }

  if (!info) {
    await ctx.reply(ctx.t("failed-to-retrieve-info"));
    return;
  }

  await ctx.editMessageText(
    buildVdsManageText(ctx, vds, info, session.other.manageVds.showPassword),
    {
      parse_mode: "HTML",
      reply_markup: vdsManageServiceMenu,
    }
  );
};

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
  let m = new Menu<AppContext>("manage-services-menu")
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
      .submenu(
        (ctx) => ctx.t("button-my-vds"),
        "vds-manage-services-list",
        async (ctx) => {
          await ctx.editMessageText(ctx.t("vds-manage-title"), {
            parse_mode: "HTML",
          });
        }
      )
      .row();
  }

  return m.back(
    (ctx) => ctx.t("button-manage-services-back"),
    async (ctx) => {
      const session = await ctx.session;
      await ctx.editMessageText(ctx.t("welcome", { balance: session.main.user.balance }), {
        parse_mode: "HTML",
      });
    }
  );
}

export const manageSerivcesMenu = buildManageServicesMenu();

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
    osList.list
      .filter(
        (os) =>
          !os.adminonly &&
          os.name != "NoOS" &&
          os.state == "active" &&
          os.repository != "ISPsystem LXD"
      )
      .forEach((os) => {
        range.text(os.name, async (ctx) => {
          const session = await ctx.session;

          // Run function for create VM and buy it
          const id = session.other.manageVds.lastPickedId;

          const vdsRepo = ctx.appDataSource.getRepository(
            VirtualDedicatedServer
          );

          const vds = await vdsRepo.findOneBy({
            id: id,
          });

          if (vds) {
            if (vds.targetUserId != session.main.user.id) {
              await ctx.reply(ctx.t("bad-error"));
              return;
            }
            if (isVdsManagementBlocked(vds)) {
              await ctx.reply(ctx.t("vds-management-locked-notice"));
              return;
            }

            await ctx.editMessageText(ctx.t("await-please"));
            ctx.menu.close();

            let reinstall;
            for (let attempt = 0; attempt < 4; attempt++) {
              reinstall = await ctx.vmmanager.reinstallOS(vds.vdsId, os.id);
              if (reinstall) break;
            }

            if (!reinstall) {
              await ctx.reply(ctx.t("bad-error"));
              return;
            }

            vds.lastOsId = os.id;

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
  .back((ctx) => ctx.t("button-back"));

export const vdsManageSpecific = new Menu<AppContext>(
  "vds-manage-specific"
).dynamic(async (ctx, range) => {
  const session = await ctx.session;

  let vdsId: number;

  if (ctx.match) {
    vdsId = Number(ctx.match);
  } else {
    vdsId = session.other.manageVds.lastPickedId;
  }

  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

  const vds = await vdsRepo.findOneBy({
    id: Number(vdsId),
  });

  if (!vds) {
    await ctx.reply(ctx.t("bad-error"));
    return;
  }

  if (session.main.user.id != vds.targetUserId) {
    return;
  }

  let info;
  const demoMode = isDemoVds(vds);

  if (demoMode) {
    info = getDemoVdsInfo();
  } else {
    for (let attempt = 0; attempt < 4; attempt++) {
      info = await ctx.vmmanager.getInfoVM(vds.vdsId);
      if (info) break;
    }
  }

  if (!info) {
    await ctx.reply(ctx.t("failed-to-retrieve-info"));
    return;
  }

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
        payload: vdsId.toString(),
      },
      async (ctx) => {
        if (demoMode) {
          await replyDemoOperation(ctx);
          return;
        }
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = Number(ctx.match);

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: Number(ctx.match),
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
        payload: vdsId.toString(),
      },
      async (ctx) => {
        if (demoMode) {
          await replyDemoOperation(ctx);
          return;
        }
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = Number(ctx.match);

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: Number(ctx.match),
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
        payload: vdsId.toString(),
      },
      async (ctx) => {
        if (demoMode) {
          await replyDemoOperation(ctx);
          return;
        }
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = Number(ctx.match);

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: Number(ctx.match),
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
        payload: vdsId.toString(),
      },
      async (ctx) => {
        if (demoMode) {
          await replyDemoOperation(ctx);
          return;
        }
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = Number(ctx.match);

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: Number(ctx.match),
        });

        if (vds) {
          ctx.menu.nav("vds-select-os-reinstall");
        }
      }
    );

    range.text(
      {
        text: ctx.t("vds-button-rename"),
        payload: vdsId.toString(),
      },
      async (ctx) => {
        const session = await ctx.session;
        session.other.manageVds.lastPickedId = Number(ctx.match);
        try {
          await ctx.conversation.enter("renameVdsConversation");
        } catch (error: any) {
          console.error("Failed to start rename conversation:", error);
          await ctx.answerCallbackQuery(ctx.t("error-unknown", { error: error.message || "Unknown error" }).substring(0, 200));
        }
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
  const session = await ctx.session;
  const vdsId = session.other.manageVds.lastPickedId;

  if (!vdsId || vdsId === -1) {
    await ctx.reply(ctx.t("error-invalid-context"));
    return;
  }

  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const vds = await vdsRepo.findOneBy({ id: vdsId });

  if (!vds || vds.targetUserId !== session.main.user.id) {
    await ctx.reply(ctx.t("error-access-denied"));
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
  const newName = nameCtx.message.text.trim();

  // Validate
  if (newName.length < 3 || newName.length > 32) {
    await ctx.reply(ctx.t("vds-rename-invalid-length", {
      minLength: 3,
      maxLength: 32,
    }));
    return;
  }

  if (newName.includes("\n") || newName.includes("\r")) {
    await ctx.reply(ctx.t("vds-rename-no-linebreaks"));
    return;
  }

  try {
    const vdsRepository = new VdsRepository(ctx.appDataSource);
    const userRepository = new UserRepository(ctx.appDataSource);
    const topUpRepository = new TopUpRepository(ctx.appDataSource);
    const billingService = new BillingService(ctx.appDataSource, userRepository, topUpRepository);
    const vdsService = new VdsService(ctx.appDataSource, vdsRepository, billingService, ctx.vmmanager);

    await vdsService.renameVds(vdsId, session.main.user.id, newName);

    await ctx.reply(ctx.t("vds-rename-success", {
      newName: newName,
    }), {
      parse_mode: "HTML",
    });

    // Update menu
    const updatedVds = await vdsRepo.findOneBy({ id: vdsId });
    if (updatedVds) {
      let info;
      for (let attempt = 0; attempt < 4; attempt++) {
        info = await ctx.vmmanager.getInfoVM(updatedVds.vdsId);
        if (info) break;
      }
      if (info) {
        await ctx.reply(vdsInfoText(ctx, updatedVds, info), {
          parse_mode: "HTML",
          reply_markup: vdsManageSpecific,
        });
      }
    }
  } catch (error: any) {
    console.error("Failed to rename VDS:", error);
    await ctx.reply(ctx.t("error-unknown", {
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
  const vdsId = session.other.manageVds.lastPickedId;
  if (!vdsId || vdsId === -1) {
    await ctx.reply(ctx.t("error-invalid-context"));
    return;
  }
  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
  const vds = await vdsRepo.findOneBy({ id: vdsId });
  if (!vds || vds.targetUserId !== session.main.user.id) {
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

  const ok = await ctx.vmmanager.changePasswordVMCustom(vds.vdsId, text);
  if (!ok) {
    await ctx.reply(ctx.t("bad-error"));
    return;
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

export const vdsManageServiceMenu = new Menu<AppContext>(
  "vds-manage-services-list"
)
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
    const expandedId = session.other.manageVds.expandedId;

    if (expandedId) {
      const expanded = await vdsRepo.findOneBy({ id: expandedId });
      if (expanded && expanded.targetUserId === session.main.user.id) {
        const showPassword = session.other.manageVds.showPassword;
        const blocked = isVdsManagementBlocked(expanded);

        range.copyText(ctx.t("button-copy-ip"), expanded.ipv4Addr || "");
        range.copyText(ctx.t("button-copy-login"), expanded.login || "");
        range.copyText(ctx.t("button-copy-password"), expanded.password || "");
        range.row();

        range.text(
          showPassword ? ctx.t("button-hide-password") : ctx.t("button-show-password"),
          async (ctx) => {
            const session = await ctx.session;
            session.other.manageVds.showPassword = !session.other.manageVds.showPassword;
            await updateVdsManageView(ctx);
          }
        );
        range.row();

        const periods = [1, 3, 6, 12] as const;
        for (const m of periods) {
          const total = Math.round(expanded.renewalPrice * m * 100) / 100;
          range.text(
            (ctx) => ctx.t("vds-renew-period-label", { months: m, total }),
            async (ctx) => {
              await ctx.answerCallbackQuery().catch(() => {});
              const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
              const vds = await vdsRepo.findOneBy({ id: expandedId });
              if (!vds || vds.targetUserId !== session.main.user.id) {
                await ctx.reply(ctx.t("bad-error"));
                return;
              }
              const sess = await ctx.session;
              sess.other.manageVds.pendingRenewMonths = m;
              await ctx.reply(
                ctx.t("vds-renew-confirm-ask", { months: m, total }),
                {
                  parse_mode: "HTML",
                  reply_markup: new InlineKeyboard()
                    .text(ctx.t("button-confirm"), `vds-renew-yes:${expandedId}:${m}`)
                    .text(ctx.t("button-cancel"), `vds-renew-no:${expandedId}`),
                }
              );
            }
          );
        }
        range.row();

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

        if (!blocked) {
          range.text(ctx.t("vds-buy-extra-ip"), async (ctx) => {
            await ctx.answerCallbackQuery().catch(() => {});
            const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);
            const vds = await vdsRepo.findOneBy({ id: expandedId });
            if (!vds) return;
            const vdsRepository = new VdsRepository(ctx.appDataSource);
            const userRepository = new UserRepository(ctx.appDataSource);
            const topUpRepository = new TopUpRepository(ctx.appDataSource);
            const billingService = new BillingService(ctx.appDataSource, userRepository, topUpRepository);
            const vdsService = new VdsService(ctx.appDataSource, vdsRepository, billingService, ctx.vmmanager);
            try {
              await vdsService.purchaseExtraIpv4(expandedId, session.main.user.id);
              const price = vdsService.getExtraIpv4UnitPrice();
              await ctx.reply(ctx.t("vds-extra-ip-buy-success", { price }));
              await updateVdsManageView(ctx);
            } catch (e: any) {
              await ctx.reply(ctx.t("error-unknown", { error: e?.message || "err" }));
            }
          });
          range.row();
        }

        if (!blocked) {
          range.text(ctx.t("button-reinstall-os"), async (ctx) => {
            const session = await ctx.session;
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
            await ctx.menu.nav("vds-select-os-reinstall");
          });

          range.text(ctx.t("button-reboot"), async (ctx) => {
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
            await ctx.vmmanager.stopVM(vds.vdsId);
            await ctx.vmmanager.startVM(vds.vdsId);
            await updateVdsManageView(ctx);
          });
          range.row();

          range.text(ctx.t("vds-password-generate"), async (ctx) => {
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
            const newPassword = await ctx.vmmanager.changePasswordVM(vds.vdsId);
            vds.password = newPassword;
            await vdsRepo.save(vds);
            await ctx.reply(ctx.t("vds-new-password", { password: newPassword }), {
              parse_mode: "HTML",
            });
            await updateVdsManageView(ctx);
          });

          range.text(ctx.t("vds-password-manual"), async (ctx) => {
            const session = await ctx.session;
            session.other.manageVds.lastPickedId = expandedId;
            try {
              await ctx.conversation.enter("vdsPasswordManualConversation");
            } catch (error: any) {
              await ctx.answerCallbackQuery(
                ctx.t("error-unknown", { error: error.message || "Unknown error" }).substring(0, 200)
              );
            }
          });
          range.row();

          range.text(ctx.t("vds-button-rename"), async (ctx) => {
            const session = await ctx.session;
            session.other.manageVds.lastPickedId = expandedId;
            try {
              await ctx.conversation.enter("renameVdsConversation");
            } catch (error: any) {
              await ctx.answerCallbackQuery(
                ctx.t("error-unknown", { error: error.message || "Unknown error" }).substring(0, 200)
              );
            }
          });
          range.row();

          range.text(ctx.t("vds-button-start-machine"), async (ctx) => {
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
            await ctx.vmmanager.startVM(vds.vdsId);
            await updateVdsManageView(ctx);
          });
          range.text(ctx.t("vds-button-stop-machine"), async (ctx) => {
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
            await ctx.vmmanager.stopVM(vds.vdsId);
            await updateVdsManageView(ctx);
          });
          range.row();
        }

        range.text(ctx.t("button-other-request"), async (ctx) => {
          await ctx.reply(ctx.t("support"), {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
          });
        });
      }
      return;
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
      const displayName = vds.displayName || vds.rateName || `VDS #${vds.id}`;
      range
        .text(
          {
            text: ctx.t("vds-manage-list-item", {
              displayName: displayName,
              rateName: vds.rateName,
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

            const vds = await vdsRepo.findOneBy({
              id: Number(ctx.match),
            });

            if (!vds) {
              await ctx.reply(ctx.t("bad-error"));
              return;
            }

            const current = session.other.manageVds.expandedId;
            if (current === vds.id) {
              session.other.manageVds.expandedId = null;
              session.other.manageVds.showPassword = false;
            } else {
              session.other.manageVds.expandedId = vds.id;
              session.other.manageVds.showPassword = false;
              session.other.manageVds.lastPickedId = vds.id;
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
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;

      if (session.other.manageVds.expandedId) {
        session.other.manageVds.expandedId = null;
        session.other.manageVds.showPassword = false;
        await updateVdsManageView(ctx);
        return;
      }

      await ctx.editMessageText(
        ctx.t("manage-services-header"),
        {
          parse_mode: "HTML",
        }
      );
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
        reply_markup: manageSerivcesMenu,
      });
    }
  );
