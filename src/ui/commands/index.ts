/**
 * Bot commands registration.
 *
 * @module ui/commands
 */

import type { Bot } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import { Role } from "../../entities/User.js";
import { mainMenu } from "../menus/main-menu.js";
import { ScreenRenderer } from "../screens/renderer.js";
import { InlineKeyboard } from "grammy";
import { getAppDataSource } from "../../infrastructure/db/datasource.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import { VdsRepository } from "../../infrastructure/db/repositories/VdsRepository.js";
import { DomainRepository } from "../../infrastructure/db/repositories/DomainRepository.js";
import { PromoRepository } from "../../infrastructure/db/repositories/PromoRepository.js";
import { TempLink } from "../../entities/TempLink.js";
import { Promo } from "../../entities/Promo.js";
import DomainRequest, { DomainRequestStatus } from "../../entities/DomainRequest.js";
import VirtualDedicatedServer from "../../entities/VirtualDedicatedServer.js";
import { Logger } from "../../app/logger.js";
import { config } from "../../app/config.js";
import ms from "../../lib/multims.js";

import { PREFIX_PROMOTE } from "../../helpers/promote-permissions.js";
import TempLink, { createLink } from "../../entities/TempLink.js";

/**
 * Register all bot commands.
 */
export function registerCommands(bot: Bot<AppContext>): void {
  // Start command
  bot.command("start", async (ctx) => {
    if (ctx.message) {
      await ctx.deleteMessage();
    }

    const session = await ctx.session;
    const renderer = ScreenRenderer.fromContext(ctx);
    const screen = renderer.renderWelcome({
      balance: session.main.user.balance,
    });

    await ctx.reply(screen.text, {
      reply_markup: mainMenu,
      parse_mode: screen.parse_mode,
    });
  });

  // Help command (admin only)
  bot.command("help", async (ctx) => {
    const session = await ctx.session;

    if (session.main.user.role === Role.Admin) {
      await ctx.reply(ctx.t("admin-help"), {
        parse_mode: "HTML",
      });
    }
  });

  // Domain requests command (admin/moderator)
  bot.command("domainrequests", async (ctx) => {
    const session = await ctx.session;
    if (
      session.main.user.role !== Role.Admin &&
      session.main.user.role !== Role.Moderator
    ) {
      return;
    }

    const dataSource = await getAppDataSource();
    const domainRepo = new DomainRepository(dataSource);

    const requests = await domainRepo.findPending();

    if (requests.length > 0) {
      const text = `${ctx.t("domain-request-list-header")}\n${requests
        .map((request) =>
          ctx.t("domain-request", {
            id: request.id,
            targetId: request.target_user_id,
            domain: `${request.domainName}${request.zone}`,
            info: request.additionalInformation || ctx.t("empty"),
          })
        )
        .join("\n")}\n\n${ctx.t("domain-request-list-info")}`;

      await ctx.reply(text, {
        parse_mode: "HTML",
      });
    } else {
      await ctx.reply(
        `${ctx.t("domain-request-list-header")}\n${ctx.t("list-empty")}`,
        {
          parse_mode: "HTML",
        }
      );
    }
  });

  // Promote link command (admin only)
  bot.command("promote_link", async (ctx) => {
    const session = await ctx.session;
    if (session.main.user.role !== Role.Admin) return;

    const dataSource = await getAppDataSource();
    const link = createLink(Role.Moderator);
    const savedLink = await dataSource.getRepository(TempLink).save(link);

    const linkUrl = `tg://msg_url?url=https://t.me/${config.BOT_USERNAME}?start=${PREFIX_PROMOTE}${savedLink.code}`;

    await ctx.reply(ctx.t("promote-link"), {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().url(
        ctx.t("button-send-promote-link"),
        linkUrl
      ),
    });
  });

  // Create promo command (admin only)
  bot.command("create_promo", async (ctx) => {
    const session = await ctx.session;
    if (session.main.user.role !== Role.Admin) return;

    const args = (ctx.match || "").trim().split(/\s+/).filter(Boolean);

    if (args.length !== 3) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const [name, sumStr, maxUsesStr] = args;
    const sum = Number.parseFloat(sumStr);
    const maxUses = Number.parseInt(maxUsesStr, 10);

    if (!name || isNaN(sum) || isNaN(maxUses)) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const dataSource = await getAppDataSource();
    const promoRepo = new PromoRepository(dataSource);

    const existingPromo = await promoRepo.findByCode(name);

    if (existingPromo) {
      await ctx.reply(ctx.t("promocode-already-exist"), {
        parse_mode: "HTML",
      });
      return;
    }

    const newPromo = new Promo();
    newPromo.code = name.toLowerCase();
    newPromo.maxUses = maxUses;
    newPromo.sum = sum;
    newPromo.uses = 0;
    newPromo.users = [];

    await promoRepo.save(newPromo);

    await ctx.reply(ctx.t("new-promo-created"), {
      parse_mode: "HTML",
    });
  });

  // Promo codes list command (admin only)
  bot.command("promo_codes", async (ctx) => {
    const session = await ctx.session;
    if (session.main.user.role !== Role.Admin) return;

    const dataSource = await getAppDataSource();
    const promoRepo = new PromoRepository(dataSource);

    const promos = await promoRepo.findAll();

    let promocodeList: string;
    if (promos.length === 0) {
      promocodeList = ctx.t("list-empty");
    } else {
      promocodeList = promos
        .map((promo) =>
          ctx.t("promocode", {
            id: promo.id,
            name: promo.code.toLowerCase(),
            use: promo.uses,
            maxUses: promo.maxUses,
            amount: promo.sum,
          })
        )
        .join("\n");
    }

    await ctx.reply(promocodeList, {
      parse_mode: "HTML",
    });
  });

  // Remove promo command (admin only)
  bot.command("remove_promo", async (ctx) => {
    const session = await ctx.session;
    if (session.main.user.role !== Role.Admin) return;

    const args = (ctx.match || "").trim().split(/\s+/).filter(Boolean);

    if (args.length !== 1) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const [idStr] = args;
    const id = Number.parseInt(idStr, 10);

    if (isNaN(id)) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const dataSource = await getAppDataSource();
    const promoRepo = new PromoRepository(dataSource);

    const promo = await promoRepo.findById(id);

    if (!promo) {
      await ctx.reply(ctx.t("promocode-not-found"), {
        parse_mode: "HTML",
      });
      return;
    }

    await promoRepo.deleteById(id);

    await ctx.reply(
      ctx.t("promocode-deleted", {
        name: promo.code,
      }),
      {
        parse_mode: "HTML",
      }
    );
  });

  // Approve domain command (admin/moderator)
  bot.command("approve_domain", async (ctx) => {
    const session = await ctx.session;
    if (
      session.main.user.role !== Role.Admin &&
      session.main.user.role !== Role.Moderator
    ) {
      return;
    }

    const args = (ctx.match || "").trim().split(/\s+/).filter(Boolean);

    if (args.length !== 2) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const [idStr, expireAtStr] = args;
    const id = Number.parseInt(idStr, 10);
    const expireAtMs = ms(expireAtStr);

    if (isNaN(id) || !expireAtMs) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const dataSource = await getAppDataSource();
    const domainRepo = new DomainRepository(dataSource);

    const request = await domainRepo.findById(id);

    if (!request || request.status !== DomainRequestStatus.InProgress) {
      await ctx.reply(ctx.t("domain-request-not-found"), {
        parse_mode: "HTML",
      });
      return;
    }

    const expireAt = new Date(Date.now() + expireAtMs);
    const paydayAt = new Date(expireAt.getTime() - ms("7d"));

    await domainRepo.approve(id, expireAt.getTime() - Date.now());

    await ctx.reply(ctx.t("domain-request-approved"), {
      parse_mode: "HTML",
    });
  });

  // Show VDS command (admin/moderator)
  bot.command("showvds", async (ctx) => {
    const session = await ctx.session;
    if (
      session.main.user.role !== Role.Admin &&
      session.main.user.role !== Role.Moderator
    ) {
      return;
    }

    const args = (ctx.match || "").trim().split(/\s+/).filter(Boolean);

    if (args.length !== 1) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const [userIdStr] = args;
    const userId = Number.parseInt(userIdStr, 10);

    if (isNaN(userId)) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const dataSource = await getAppDataSource();
    const vdsRepo = new VdsRepository(dataSource);

    const vdsList = await vdsRepo.findByUserId(userId);

    if (vdsList.length === 0) {
      await ctx.reply(ctx.t("no-vds-found"), {
        parse_mode: "HTML",
      });
      return;
    }

    const vdsInfo = vdsList
      .map((vds) =>
        ctx.t("vds-info-admin", {
          id: vds.id,
          ip: vds.ipv4Addr || "N/A",
          expireAt: vds.expireAt.toISOString(),
          renewalPrice: vds.renewalPrice,
        })
      )
      .join("\n");

    await ctx.reply(vdsInfo, {
      parse_mode: "HTML",
    });
  });

  // Remove VDS command (admin/moderator)
  bot.command("removevds", async (ctx) => {
    const session = await ctx.session;
    if (
      session.main.user.role !== Role.Admin &&
      session.main.user.role !== Role.Moderator
    ) {
      return;
    }

    const args = (ctx.match || "").trim().split(/\s+/).filter(Boolean);

    if (args.length !== 1) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const [idVdsStr] = args;
    const idVds = Number.parseInt(idVdsStr, 10);

    if (isNaN(idVds)) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const dataSource = await getAppDataSource();
    const vdsRepo = new VdsRepository(dataSource);

    const vds = await vdsRepo.findById(idVds);

    if (!vds) {
      await ctx.reply(ctx.t("vds-not-found"), {
        parse_mode: "HTML",
      });
      return;
    }

    // Delete VM with retry
    let deleted = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await ctx.vmmanager.deleteVM(vds.vdsId);
        if (result) {
          deleted = true;
          break;
        }
      } catch (error) {
        Logger.error(`Failed to delete VM ${vds.vdsId} (attempt ${attempt + 1})`, error);
      }
    }

    if (!deleted) {
      await ctx.reply(
        ctx.t("vds-remove-failed", { id: idVds }),
        {
          parse_mode: "HTML",
        }
      );
      return;
    }

    await vdsRepo.deleteById(idVds);

    await ctx.reply(ctx.t("vds-removed", { id: idVds }), {
      parse_mode: "HTML",
    });
  });

  // Reject domain command (admin/moderator)
  bot.command("reject_domain", async (ctx) => {
    const session = await ctx.session;
    if (
      session.main.user.role !== Role.Admin &&
      session.main.user.role !== Role.Moderator
    ) {
      return;
    }

    const args = (ctx.match || "").trim().split(/\s+/).filter(Boolean);

    if (args.length !== 1) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const [idStr] = args;
    const id = Number.parseInt(idStr, 10);

    if (isNaN(id)) {
      await ctx.reply(ctx.t("invalid-arguments"), {
        parse_mode: "HTML",
      });
      return;
    }

    const dataSource = await getAppDataSource();
    const domainRepo = new DomainRepository(dataSource);
    const userRepo = new UserRepository(dataSource);

    const request = await domainRepo.findById(id);

    if (!request || request.status !== DomainRequestStatus.InProgress) {
      await ctx.reply(ctx.t("domain-request-not-found"), {
        parse_mode: "HTML",
      });
      return;
    }

    // Reject and refund in transaction
    await dataSource.transaction(async (manager) => {
      const domainManager = manager.getRepository(DomainRequest);
      const userManager = manager.getRepository(User);

      const user = await userManager.findOne({
        where: { id: request.target_user_id },
      });

      if (user) {
        user.balance += request.price;
        await userManager.save(user);
      }

      request.status = DomainRequestStatus.Failed;
      await domainManager.save(request);
    });

    await ctx.reply(ctx.t("domain-request-reject"), {
      parse_mode: "HTML",
    });
  });

  // Users command (admin/moderator)
  bot.command("users", async (ctx) => {
    if (ctx.message) {
      await ctx.deleteMessage();
    }

    const session = await ctx.session;
    if (session.main.user.role === Role.User) return;

    // TODO: Import controlUsers from helpers
    await ctx.reply(ctx.t("control-panel-users"), {
      parse_mode: "HTML",
    });
  });

  Logger.info("Commands registered");
}
