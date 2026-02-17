import "reflect-metadata";
import {
  Api,
  Bot,
  Context,
  InlineKeyboard,
  LazySessionFlavor,
  MemorySessionStorage,
  RawApi,
  session,
  webhookCallback,
} from "grammy";
import dotenv from "dotenv";
import { FluentContextFlavor, useFluent } from "@grammyjs/fluent";
import { initFluent } from "./fluent";
import { FileAdapter } from "@grammyjs/storage-file";
import { Menu, MenuFlavor } from "@grammyjs/menu";
import { DataSource, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { getAppDataSource } from "@/database";
import User, { Role, UserStatus } from "@entities/User";
import { createLink } from "@entities/TempLink";
import {
  PREFIX_PROMOTE,
  promotePermissions,
} from "./helpers/promote-permissions";
import { buildControlPanelUserReply, controlUser, controlUserBalance, controlUsers, controlUserStatus, controlUserSubscription } from "./helpers/users-control";
import express from "express";
import { run as grammyRun } from "@grammyjs/runner";
import { adminMenu } from "./ui/menus/admin-menu";
import { ticketViewMenu } from "./ui/menus/moderator-menu";
import { moderatorMenu } from "./ui/menus/moderator-menu";
import {
  registerBroadcastAndTickets,
  handlePrimeActivateTrial,
  handlePrimeISubscribed,
} from "./ui/integration/broadcast-tickets-integration";
import { BroadcastService } from "./domain/broadcast/BroadcastService";
import { Logger } from "./app/logger";
import {
  adminPromosMenu,
  registerAdminPromosHandlers,
} from "./ui/menus/admin-promocodes-menu.js";
import { adminAutomationsMenu } from "./ui/menus/admin-automations-menu.js";
import {
  domainOrderMenu,
  domainsMenu,
  servicesMenu,
  vdsMenu,
  vdsRateChoose,
  vdsRateOs,
  dedicatedTypeMenu,
  vdsTypeMenu,
  dedicatedServersMenu,
  dedicatedSelectedServerMenu,
} from "@helpers/services-menu";
import { renameVdsConversation } from "@helpers/manage-services";
import {
  depositMenu,
  depositMoneyConversation,
  depositPaymentSystemChoose,
  topupMethodMenu,
} from "@helpers/deposit-money";
// Admin menu will be loaded dynamically to avoid circular dependencies
// Import language select menu - will be loaded dynamically in /start command
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import { domainRegisterConversation } from "./ui/conversations/domain-register-conversation";
import { domainUpdateNsConversation } from "./ui/conversations/domain-update-ns-conversation";
import { withdrawRequestConversation } from "./ui/conversations/withdraw-conversation";
import { registerPromoConversations } from "./ui/conversations/admin-promocodes-conversations.js";
import { startCheckTopUpStatus } from "@api/payment";
import { ServicePaymentStatusChecker } from "./domain/billing/ServicePaymentStatusChecker.js";
import { InlineKeyboard } from "grammy";
import {
  bundleManageServicesMenu,
  domainManageServicesMenu,
  manageSerivcesMenu,
  vdsManageServiceMenu,
  vdsManageSpecific,
  vdsReinstallOs,
} from "@helpers/manage-services";
import DomainRequest, { DomainRequestStatus } from "@entities/DomainRequest";
import Promo from "@entities/Promo";
import { handlePromocodeInput, promocodeQuestion } from "@helpers/promocode-input";
import { registerDomainRegistrationMiddleware } from "@helpers/domain-registraton";
import ms from "./lib/multims";
import { GetOsListResponse, VMManager } from "@api/vmmanager";
import VirtualDedicatedServer from "./entities/VirtualDedicatedServer";
import { Fluent } from "@moebius/fluent";
import DomainChecker from "@api/domain-checker";
import { escapeUserInput } from "@helpers/formatting";
import { ensureSessionUser } from "./shared/utils/session-user.js";
import { handleCryptoPayWebhook } from "./infrastructure/payments/cryptopay-webhook.js";
// Note: Commands are registered via registerCommands call below
// Using dynamic import to avoid ts-node ESM resolution issues
dotenv.config({});

export type MyAppContext = ConversationFlavor<
  Context &
    FluentContextFlavor &
    LazySessionFlavor<SessionData> &
    MenuFlavor & {
      availableLanguages: string[];
      appDataSource: DataSource;
      vmmanager: VMManager;
      osList: GetOsListResponse | null;
    }
>;

export type MyConversation = Conversation<MyAppContext>;

export const mainMenu = new Menu<MyAppContext>("main-menu")
  .submenu(
    (ctx) => ctx.t("button-purchase"),
    "services-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
        parse_mode: "HTML",
      });
    }
  )
  .row()
  .submenu(
    (ctx) => ctx.t("button-manage-services"),
    "manage-services-menu",
    async (ctx) => {
      const session = await ctx.session;
      
      ctx.editMessageText(ctx.t("manage-services-header"), {
        parse_mode: "HTML",
      });
    }
  )
  .text(
    (ctx) => ctx.t("button-balance"),
    async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => {});
      await ctx.editMessageText(ctx.t("topup-select-method"), {
        reply_markup: topupMethodMenu,
        parse_mode: "HTML",
      });
    }
  )
  .row()
  .submenu(
    (ctx) => ctx.t("button-personal-profile"),
    "profile-menu",
    async (ctx) => {
      const session = await ctx.session;
      if (ctx.hasChatType("private")) {
        const { getProfileText } = await import("./ui/menus/profile-menu.js");
        const profileText = await getProfileText(ctx);
        await ctx.editMessageText(profileText, {
          reply_markup: profileMenu,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });
      }
    }
  )
  .submenu(
    (ctx) => ctx.t("button-support"),
    "support-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("support"), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    }
  );

const supportMenu = new Menu<MyAppContext>("support-menu", {
  autoAnswer: false,
})
  .url(
    (ctx) => ctx.t("button-ask-question"),
    (ctx) =>
      `tg://resolve?domain=diorhost&text=${encodeURIComponent(
        ctx.t("support-message-template")
      )}`
  )
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;
      await ctx.editMessageText(
        ctx.t("welcome", { balance: session.main.user.balance }),
        {
          parse_mode: "HTML",
        }
      );
    }
  );

const profileMenu = new Menu<MyAppContext>("profile-menu", {})
  .submenu((ctx) => ctx.t("button-deposit"), "topup-method-menu")
  .row()
  .text(
    (ctx) => ctx.t("button-referrals"),
    async (ctx) => {
      try {
        const session = await ctx.session;
        const { ReferralService } = await import(
          "./domain/referral/ReferralService"
        );
        const { UserRepository } = await import(
          "./infrastructure/db/repositories/UserRepository"
        );
        const { referralsMenu } = await import("./ui/menus/referrals-menu");
        const referralService = new ReferralService(
          ctx.appDataSource,
          new UserRepository(ctx.appDataSource)
        );

        const referralLink = await referralService.getReferralLink(
          session.main.user.id
        );
        const referralsCount = await referralService.countReferrals(
          session.main.user.id
        );
        const userForRef = await ctx.appDataSource.manager.findOne(User, {
          where: { id: session.main.user.id },
          select: ["referralBalance"],
        });
        const refBalance = userForRef?.referralBalance ?? session.main.user.referralBalance ?? 0;
        const profitFormatted =
          refBalance === Math.floor(refBalance)
            ? String(refBalance)
            : refBalance.toFixed(2);

        const text = ctx
          .t("referrals-screen", {
            link: referralLink,
            count: referralsCount,
            profit: profitFormatted,
          })
          .replace(/\\n/g, "\n");

        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: referralsMenu,
        });
      } catch (error: any) {
        console.error("[Referrals] Failed to open referrals from profile:", error);
        await ctx.answerCallbackQuery(
          ctx.t("error-unknown", { error: "Unknown error" }).substring(0, 200)
        );
      }
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("button-subscription"),
    async (ctx) => {
      try {
        const { getDomainsListWithPrimeScreen } = await import(
          "./ui/menus/amper-domains-menu.js"
        );
        const { fullText, keyboard } = await getDomainsListWithPrimeScreen(ctx as any);
        await ctx.editMessageText(fullText, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      } catch (error: any) {
        await ctx.editMessageText(
          ctx.t("error-unknown", { error: error?.message || "Error" }),
          { parse_mode: "HTML" }
        );
      }
    }
  )
  .row()
  .text((ctx) => ctx.t("button-change-locale"), async (ctx) => {
    const session = await ctx.session;
    const nextLocale = session.main.locale === "ru" ? "en" : "ru";
    session.main.locale = nextLocale;

    const usersRepo = ctx.appDataSource.getRepository(User);
    const user = await usersRepo.findOneBy({ id: session.main.user.id });
    if (user) {
      user.lang = nextLocale as "ru" | "en";
      await usersRepo.save(user);
    }

    ctx.fluent.useLocale(nextLocale);

    const { getProfileText } = await import("./ui/menus/profile-menu.js");
    const profileText = await getProfileText(ctx);
    await ctx.editMessageText(profileText, {
      reply_markup: profileMenu,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  })
  .row()
  .text(
    (ctx) => ctx.t("button-promocode"),
    async (ctx) => {
      const session = await ctx.session;
      session.other.promocode.awaitingInput = true;

      await ctx.reply(ctx.t("promocode-input-question"), {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text(
          ctx.t("button-cancel"),
          "promocode-cancel"
        ),
      });
    }
  )
  .row()
  .dynamic(async (ctx, range) => {
    if (!ctx.hasChatType("private")) return;
    const telegramId = ctx.chatId ?? ctx.from?.id;
    if (!telegramId) return;
    const dataSource = ctx.appDataSource ?? (await getAppDataSource());
    const dbUser = await dataSource.manager.findOneBy(User, {
      telegramId: Number(telegramId),
    });
    const roleStr = dbUser ? String(dbUser.role).toLowerCase() : "";
    const isAdmin = dbUser && (roleStr === "admin" || dbUser.role === Role.Admin);
    if (!isAdmin) return;
    const session = await ctx.session;
    if (session?.main?.user) {
      session.main.user.role = Role.Admin;
      session.main.user.status = dbUser!.status;
      session.main.user.id = dbUser!.id;
      session.main.user.balance = dbUser!.balance;
      session.main.user.referralBalance = dbUser!.referralBalance ?? 0;
      session.main.user.isBanned = dbUser!.isBanned;
    }
    range.text(ctx.t("button-admin-panel"), async (ctx) => {
      try {
        await ctx.editMessageText(ctx.t("admin-panel-header"), {
          parse_mode: "HTML",
          reply_markup: adminMenu,
        });
      } catch (error: any) {
        console.error("[Admin] Failed to open admin panel from profile:", error);
        await ctx.answerCallbackQuery(
          ctx.t("error-unknown", { error: "Unknown error" }).substring(0, 200)
        );
      }
    });
    range.row();
  })
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;
      await ctx.editMessageText(
        ctx.t("welcome", { balance: session.main.user.balance }),
        {
          parse_mode: "HTML",
        }
      );
    }
  );

const changeLocaleMenu = new Menu<MyAppContext>("change-locale-menu", {
  autoAnswer: false,
  onMenuOutdated: false,
})
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    for (const lang of ctx.availableLanguages) {
      if (lang !== session.main.locale) {
        range
          .text(ctx.t(`button-change-locale-${lang}`), async (ctx) => {
            session.main.locale = lang;
            const usersRepo = ctx.appDataSource.getRepository(User);

            const user = await usersRepo.findOneBy({
              id: session.main.user.id,
            });

            if (user) {
              user.lang = lang as "ru" | "en";
              await usersRepo.save(user);
            }

            ctx.fluent.useLocale(lang);
            await ctx.editMessageText(
              ctx.t("welcome", { balance: session.main.user.balance }),
              {
                parse_mode: "HTML",
              }
            );
            ctx.menu.back();
          })
          .row();
      }
    }
  })
  .back((ctx) => ctx.t("button-back"));

export interface SessionData {
  main: {
    locale: string;
    user: {
      id: number;
      balance: number;
      role: Role;
      status: UserStatus;
      isBanned: boolean;
    };
    lastSumDepositsEntered: number;
    topupMethod: "crystalpay" | "cryptobot" | "manual" | null;
  };
  other: {
    broadcast: {
      step: "idle" | "awaiting_text" | "awaiting_confirm";
      text?: string;
    };
    controlUsersPage: {
      orderBy: "balance" | "id";
      sortBy: "ASC" | "DESC";
      page: number;
      pickedUserData?: {
        id: number;
      };
    };
    vdsRate: {
      bulletproof: boolean;
      selectedRateId: number;
      selectedOs: number;
    };
    dedicatedType: {
      bulletproof: boolean;
      selectedDedicatedId: number;
    };
    manageVds: {
      page: number;
      lastPickedId: number;
      expandedId: number | null;
      showPassword: boolean;
    };
    manageDedicated: {
      expandedId: number | null;
      showPassword: boolean;
    };
    domains: {
      lastPickDomain: string;
      page: number;
      pendingZone?: string;
    };
    dedicatedOrder: {
      step: "idle" | "requirements" | "comment";
      requirements?: string;
    };
    promocode: {
      awaitingInput: boolean;
    };
    promoAdmin: {
      page: number;
      editingPromoId?: number | null;
      createStep?: "code" | "amount" | "max" | null;
      createDraft?: {
        code?: string;
        amount?: number;
      };
      editStep?: "code" | null;
    };
    ticketsView: {
      list: "new" | "in_progress" | null;
      currentTicketId?: number | null;
      pendingAction?:
        | "ask_user"
        | "provide_result"
        | "reject"
        | "provide_dedicated_ip"
        | "provide_dedicated_login"
        | "provide_dedicated_password"
        | "provide_dedicated_panel"
        | "provide_dedicated_notes"
        | null;
      pendingTicketId?: number | null;
      pendingData?: {
        ip?: string;
        login?: string;
        password?: string;
        panel?: string | null;
        notes?: string | null;
      };
    };
    /** Admin balance edit: awaiting amount for add/deduct */
    balanceEdit?: {
      userId: number;
      action: "add" | "deduct";
    };
    /** Admin message to user: awaiting text to send */
    messageToUser?: {
      userId: number;
      telegramId: number;
    };
    /** Admin subscription grant: awaiting number of days */
    subscriptionEdit?: {
      userId: number;
    };
    /** Admin referral percent edit: awaiting percentage 0-100 */
    referralPercentEdit?: {
      userId: number;
    };
  };
}

const createInitialMainSession = (): SessionData["main"] => ({
  locale: "ru",
  user: {
    balance: 0,
    referralBalance: 0,
    id: 0,
    role: Role.User,
    status: UserStatus.Newbie,
    isBanned: false,
  },
  lastSumDepositsEntered: 0,
  topupMethod: null,
});

const createInitialOtherSession = (): SessionData["other"] => ({
  broadcast: {
    step: "idle",
  },
  controlUsersPage: {
    orderBy: "id",
    sortBy: "ASC",
    page: 0,
  },
  vdsRate: {
    bulletproof: true,
    selectedRateId: -1,
    selectedOs: -1,
  },
  dedicatedType: {
    bulletproof: false,
    selectedDedicatedId: -1,
  },
  manageVds: {
    lastPickedId: -1,
    page: 0,
    expandedId: null,
    showPassword: false,
  },
  manageDedicated: {
    expandedId: null,
    showPassword: false,
  },
  domains: {
    lastPickDomain: "",
    page: 0,
    pendingZone: undefined,
  },
  dedicatedOrder: {
    step: "idle",
    requirements: undefined,
  },
  ticketsView: {
    list: null,
    currentTicketId: null,
    pendingAction: null,
    pendingTicketId: null,
    pendingData: {},
  },
  deposit: {
    awaitingAmount: false,
  },
  promocode: {
    awaitingInput: false,
  },
  promoAdmin: {
    page: 0,
    editingPromoId: null,
    createStep: null,
    createDraft: {},
    editStep: null,
  },
});

async function index() {
  const { fluent, availableLocales } = await initFluent();

  const bot = new Bot<MyAppContext>(process.env.BOT_TOKEN, {});

  // Inline mode: pop-up card above input (title + description), like Market & Tochka. Must run before session.
  bot.use(async (ctx, next) => {
    if (!ctx.inlineQuery) return next();
    const queryId = ctx.inlineQuery.id;
    const query = ctx.inlineQuery.query;
    Logger.info("[Inline] Query received", { queryId, query });
    try {
      const results = [
        {
          type: "article" as const,
          id: `dior-welcome-${queryId}`,
          title: "🛡️ Welcome to Dior Host!",
          description:
            "Bulletproof VPS, domains & dedicated servers — order and manage hosting in TG. 24/7, offshore.",
          input_message_content: {
            message_text:
              "✨ Welcome to Dior Host!\n\nBulletproof VPS, domains and dedicated servers — order and manage hosting in TG. 24/7 support, offshore.\n\n👉 Open bot: t.me/diorhost_bot",
          },
        },
      ];
      await bot.api.answerInlineQuery(queryId, results, { cache_time: 0 });
      Logger.info("[Inline] Answer sent");
    } catch (err) {
      Logger.error("[Inline] answerInlineQuery failed", err);
    }
  });

  bot.use(
    session({
      type: "multi",
      other: {
        storage: new MemorySessionStorage<SessionData["other"]>(),
        initial: createInitialOtherSession,
      },
      main: {
        initial: createInitialMainSession,
        storage: new FileAdapter({
          dirName: "sessions",
        }),
      },
    })
  );

  bot.use(async (ctx, next) => {
    const session = await ctx.session;
    if (!session.main) {
      session.main = createInitialMainSession();
    }
    if (!session.other) {
      session.other = createInitialOtherSession();
    }
    return next();
  });

  const vmmanager = new VMManager(
    process.env["VMM_EMAIL"],
    process.env["VMM_PASSWORD"]
  );

  startExpirationCheck(bot, vmmanager, fluent);

  bot.use(async (ctx, next) => {
    ctx.vmmanager = vmmanager;

    if (ctx.osList == null) {
      try {
        const list = await vmmanager.getOsList();
        if (list) {
          ctx.osList = list;
        }
      } catch (error) {
        console.error("[VMManager] Failed to load OS list:", error);
        ctx.osList = null;
      }
    }

    return next();
  });

  // Add the available languages to the context
  bot.use(async (ctx, next) => {
    const session = await ctx.session;

    ctx.availableLanguages = availableLocales;
    ctx.appDataSource = await getAppDataSource();

    if (!session?.main) {
      return next();
    }

    if (ctx.hasChatType("private")) {
      let user = await ctx.appDataSource.manager.findOneBy(User, {
        telegramId: ctx.chatId,
      });

      const isNewUser = !user;
      if (!user) {
        const newUser = new User();
        newUser.telegramId = ctx.chatId;
        newUser.status = UserStatus.Newbie;
        newUser.referrerId = null;

        user = await ctx.appDataSource.manager.save(newUser);
      }

      session.main.user.balance = user.balance;
      session.main.user.referralBalance = user.referralBalance ?? 0;
      session.main.user.id = user.id;
      session.main.user.role = user.role;
      session.main.user.status = user.status;
      session.main.user.isBanned = user.isBanned;
    }
    return next();
  });

  bot.use(async (ctx, next) => {
    const session = await ctx.session;
    if (!session?.main) {
      return next();
    }

    // If locale not set and user exists in DB, try to load from DB
    if ((session.main.locale === "0" || !session.main.locale) && session.main.user.id > 0) {
      const usersRepo = ctx.appDataSource.getRepository(User);

      const user = await usersRepo.findOneBy({
        id: session.main.user.id,
      });

      if (user && user.lang) {
        session.main.locale = user.lang;
      }
      // If user.lang is null, keep locale as "0" to show language selection
    }

    return next();
  });

  bot.use(
    useFluent({
      fluent,
      localeNegotiator: async (ctx) => {
        const session = await ctx.session;
        const locale = session?.main?.locale;
        if (!locale || locale === "0") {
          return "ru";
        }
        return locale;
      },
    })
  );

  // Ensure ctx.t is always defined (prefer Fluent translations)
  bot.use(async (ctx, next) => {
    if (typeof (ctx as any).t !== "function") {
      const session = await ctx.session;
      const fluent = (ctx as any).fluent;
      const locale =
        session?.main?.locale && session.main.locale !== "0"
          ? session.main.locale
          : "ru";
      if (fluent && typeof fluent.translate === "function") {
        (ctx as any).t = (key: string, vars?: Record<string, string | number>) =>
          fluent.translate(locale, key, vars);
      } else if (fluent && typeof fluent.t === "function") {
        (ctx as any).t = (key: string, vars?: Record<string, string | number>) =>
          fluent.t(key, vars);
      } else {
        (ctx as any).t = (key: string) => key;
      }
    }
    return next();
  });

  // Setup conversations BEFORE menus so ctx.conversation is available
  bot.use(conversations());
  registerPromoConversations(bot);
  bot.use(createConversation(domainRegisterConversation, "domainRegisterConversation"));
  bot.use(createConversation(domainUpdateNsConversation, "domainUpdateNsConversation"));
  bot.use(createConversation(withdrawRequestConversation, "withdrawRequestConversation"));
  registerBroadcastAndTickets(bot);
  registerAdminPromosHandlers(bot);

  // Register all menus FIRST, before language handler and commands
  // This ensures menus are available when we try to use them
  bot.use(mainMenu);
  bot.use(adminMenu);
  bot.use(moderatorMenu);
  bot.use(ticketViewMenu);
  bot.use(servicesMenu);
  bot.use(profileMenu);
  bot.use(manageSerivcesMenu);
  bot.use(domainsMenu);
  bot.use(vdsMenu);
  bot.use(dedicatedTypeMenu);
  bot.use(vdsTypeMenu);
  bot.use(dedicatedServersMenu);
  bot.use(dedicatedSelectedServerMenu);
  bot.use(adminPromosMenu);
  bot.use(vdsRateChoose);
  bot.use(vdsRateOs);
  bot.use(depositMenu);
  bot.use(topupMethodMenu);
  bot.use(domainManageServicesMenu);
  bot.use(vdsManageServiceMenu);
  bot.use(bundleManageServicesMenu);
  bot.use(domainOrderMenu);
  bot.use(controlUser);
  bot.use(controlUserBalance);
  bot.use(controlUserSubscription);
  bot.use(controlUsers);
  bot.use(controlUserStatus);

  // Register admin menu hierarchy
  adminMenu.register(controlUsers, "admin-menu");
  adminMenu.register(moderatorMenu, "admin-menu");

  bot.callbackQuery("topup_manual_back", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageText(ctx.t("topup-select-method"), {
      reply_markup: topupMethodMenu,
      parse_mode: "HTML",
    });
  });

  bot.callbackQuery("topup_back_to_amount", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageText(ctx.t("button-deposit"), {
      reply_markup: depositMenu,
      parse_mode: "HTML",
    });
  });

  // Register referrals menu
  try {
    const { referralsMenu } = await import("./ui/menus/referrals-menu");
    bot.use(referralsMenu);
    console.log("[Bot] Referrals menu registered via bot.use()");
  } catch (error: any) {
    console.error("[Bot] Failed to register referrals menu:", error);
  }

  bot.callbackQuery("referral-stats-back", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    const { ReferralService } = await import("./domain/referral/ReferralService.js");
    const { UserRepository } = await import("./infrastructure/db/repositories/UserRepository.js");
    const { referralsMenu } = await import("./ui/menus/referrals-menu.js");
    const referralService = new ReferralService(
      ctx.appDataSource,
      new UserRepository(ctx.appDataSource)
    );
    const referralLink = await referralService.getReferralLink(session.main.user.id);
    const referralsCount = await referralService.countReferrals(session.main.user.id);
    const userForRef = await ctx.appDataSource.manager.findOne(User, {
      where: { id: session.main.user.id },
      select: ["referralBalance"],
    });
    const refBalance = userForRef?.referralBalance ?? session.main.user.referralBalance ?? 0;
    const profitFormatted =
      refBalance === Math.floor(refBalance) ? String(refBalance) : refBalance.toFixed(2);
    const text = ctx
      .t("referrals-screen", {
        link: referralLink,
        count: referralsCount,
        profit: profitFormatted,
      })
      .replace(/\\n/g, "\n");
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: referralsMenu,
    });
  });
  
  // Register amper domains menu
  try {
    const { amperDomainsMenu } = await import("./ui/menus/amper-domains-menu");
    bot.use(amperDomainsMenu);
    domainsMenu.register(amperDomainsMenu, "domains-menu");
    console.log("[Bot] Amper domains menu registered via bot.use()");
  } catch (error: any) {
    console.error("[Bot] Failed to register amper domains menu:", error);
  }
  
  // Import and register dedicatedMenu
  try {
    const dedicatedModule = await import("./ui/menus/dedicated-menu");
    if (dedicatedModule?.dedicatedMenu) {
      bot.use(dedicatedModule.dedicatedMenu as any);
      dedicatedTypeMenu.register(dedicatedModule.dedicatedMenu, "dedicated-type-menu");
      manageSerivcesMenu.register(dedicatedModule.dedicatedMenu, "manage-services-menu");
      console.log("[Bot] Dedicated menu registered via bot.use()");
    }
  } catch (error: any) {
    console.error("[Bot] Failed to import dedicated menu:", error);
  }

  // Prime subscription: Back → main menu, Activate trial, I subscribed (runs AFTER menus so mainMenu is valid)
  bot.use(async (ctx, next) => {
    if (!ctx.callbackQuery?.data) return next();
    const data = ctx.callbackQuery.data;
    const isPrimeBack = typeof data === "string" && data.startsWith("prime-back-");
    const isPrimeActivate = data === "prime_activate_trial";
    const isPrimeSubscribed = data === "prime_i_subscribed";
    if (!isPrimeBack && !isPrimeActivate && !isPrimeSubscribed) return next();

    if (!isPrimeSubscribed) await ctx.answerCallbackQuery().catch(() => {});

    try {
      if (isPrimeBack) {
        const session = await ctx.session;
        const balance = session?.main?.user?.balance ?? 0;
        const welcomeText = ctx.t("welcome", { balance });
        await ctx.editMessageText(welcomeText, {
          reply_markup: mainMenu,
          parse_mode: "HTML",
        });
        return;
      }
      if (isPrimeActivate) {
        await handlePrimeActivateTrial(ctx);
        return;
      }
      if (isPrimeSubscribed) {
        await handlePrimeISubscribed(ctx);
        return;
      }
    } catch (err: any) {
      Logger.error("Prime callback error:", err);
      await ctx.answerCallbackQuery({
        text: String(err?.message || "Error").slice(0, 200),
        show_alert: true,
      }).catch(() => {});
    }
  });

  // Register language selection callbacks AFTER menus are registered
  // This ensures maximum priority for language selection
  bot.on("callback_query", async (ctx, next) => {
    const data = ctx.callbackQuery?.data;
    
    // Only handle language selection callbacks
    if (data !== "lang_ru" && data !== "lang_en") {
      return next(); // Let other handlers process this
    }
    
    console.log(`[Lang] Language callback detected: ${data}`);
    const lang = data === "lang_ru" ? "ru" : "en";
    
    try {
      // Answer callback query first
      await ctx.answerCallbackQuery();
      console.log(`[Lang] Callback answered for ${lang}`);
      
      // Get session and update locale
      const session = await ctx.session;
      session.main.locale = lang;
      console.log(`[Lang] Session locale set to ${lang}`);
      
      // Save to database
      const usersRepo = ctx.appDataSource.getRepository(User);
      const user = await usersRepo.findOneBy({
        id: session.main.user.id,
      });
      
      if (user) {
        user.lang = lang as "ru" | "en";
        await usersRepo.save(user);
        console.log(`[Lang] Language saved to DB for user ${user.id}`);
      }
      
      // Update fluent locale
      ctx.fluent.useLocale(lang);
      console.log(`[Lang] Fluent locale set to ${lang}`);
      
      // Generate welcome message
      const welcomeText = ctx.t("welcome", { balance: session.main.user.balance });
      console.log(`[Lang] Welcome text generated (${welcomeText.length} chars)`);
      
      // Try to edit message, fallback to new message if fails
      try {
        await ctx.editMessageText(welcomeText, {
          reply_markup: mainMenu,
          parse_mode: "HTML",
        });
        console.log("[Lang] Message edited successfully with welcome menu");
      } catch (editError: any) {
        console.error("[Lang] editMessageText failed:", editError?.message);
        // Delete old message and send new one
        try {
          await ctx.deleteMessage().catch(() => {});
        } catch {}
        await ctx.reply(welcomeText, {
          reply_markup: mainMenu,
          parse_mode: "HTML",
        });
        console.log("[Lang] New message sent with welcome menu");
      }
      
      // Stop execution - don't pass to other handlers
      return;
    } catch (error: any) {
      console.error(`[Lang] Error processing lang_${lang} callback:`, error);
      const errorText = lang === "ru" ? "Ошибка при выборе языка" : "Error selecting language";
      await ctx.answerCallbackQuery({ text: errorText, show_alert: true }).catch(() => {});
      // Don't pass to next handler on error
      return;
    }
  });

  bot.use(async (ctx, next) => {
    const session = await ctx.session;

    if (session.main.user.isBanned) {
      await ctx.reply(ctx.t("message-about-block"));
      await ctx.deleteMessage();
      return;
    }

    return next();
  });

  bot.use(depositPaymentSystemChoose);
  bot.use(
    createConversation(depositMoneyConversation, "depositMoneyConversation")
  );
  bot.use(
    createConversation(renameVdsConversation, "renameVdsConversation")
  );
  
  // Register domain registration conversation
  // Note: This is also registered in broadcast-tickets-integration, so we skip it here to avoid duplicates
  // The conversation will be registered by registerBroadcastAndTickets() below
  // bot.use(
  //   createConversation(confirmDomainRegistration, "confirmDomainRegistration")
  // );

  // Register /start command
  bot.command("start", async (ctx) => {
    try {
      if (ctx.message) {
        await ctx.deleteMessage().catch(() => {});
      }

      const session = await ctx.session;
      // Referral: bind referrer when user opens bot via ?start=REFERRER_TELEGRAM_ID
      const payload = ctx.match && typeof ctx.match === "string" ? ctx.match.trim() : "";
      if (payload.length > 0 && !payload.startsWith("promote_")) {
        try {
          const { ReferralService } = await import("./domain/referral/ReferralService.js");
          const { UserRepository } = await import("./infrastructure/db/repositories/UserRepository.js");
          const userRepo = new UserRepository(ctx.appDataSource);
          const referralService = new ReferralService(ctx.appDataSource, userRepo);
          const user = await userRepo.findById(session.main.user.id);
          if (user && user.referrerId == null) {
            await referralService.bindReferrer(user.id, payload);
            Logger.info(`[Referral] Bound referrer for user ${user.id} with refCode ${payload}`);
          }
        } catch (err: any) {
          Logger.error("[Referral] Failed to bind referrer:", err);
        }
      }

      // Always show language selection when /start is called
      ctx.fluent.useLocale("en");
      const keyboard = new InlineKeyboard()
        .text(ctx.t("button-change-locale-ru"), "lang_ru")
        .text(ctx.t("button-change-locale-en"), "lang_en");
      await ctx.reply(ctx.t("select-language"), {
        reply_markup: keyboard,
        parse_mode: "HTML",
      });
    } catch (error: any) {
      console.error("[Start] Error in /start command:", error);
      await ctx.reply("Error: " + (error.message || "Unknown error")).catch(() => {});
    }
  });
  
  bot.use(promotePermissions());
  bot.use(promocodeQuestion.middleware());
  bot.use(vdsManageSpecific);

  bot.callbackQuery("promocode-cancel", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    session.other.promocode.awaitingInput = false;
    if (ctx.callbackQuery.message) {
      await ctx.deleteMessage().catch(() => {});
    }
  });

  bot.callbackQuery("promocode-back", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    session.other.promocode.awaitingInput = false;
    const balance = session?.main?.user?.balance ?? 0;
    await ctx.reply(ctx.t("welcome", { balance }), {
      reply_markup: mainMenu,
      parse_mode: "HTML",
    });
  });

  bot.callbackQuery("deposit-cancel", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    session.main.lastSumDepositsEntered = -1;
    session.other.deposit.awaitingAmount = false;
    if (ctx.callbackQuery.message) {
      await ctx.deleteMessage().catch(() => {});
    }
  });

  // Bundle purchase handlers
  bot.callbackQuery(/^bundle-purchase-(.+)-(.+)$/, async (ctx) => {
    const match = ctx.callbackQuery?.data?.match(/^bundle-purchase-(.+)-(.+)$/);
    if (!match) return;
    const [, bundleTypeStr, periodStr] = match;
    const { handleBundlePurchase } = await import("./ui/menus/bundle-handlers.js");
    await handleBundlePurchase(ctx, bundleTypeStr, periodStr);
  });

  bot.callbackQuery("bundle-change-period", async (ctx) => {
    const { handleBundleChangePeriod } = await import("./ui/menus/bundle-handlers.js");
    await handleBundleChangePeriod(ctx);
  });

  bot.callbackQuery("bundle-back-to-types", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const { bundleTypeMenu } = await import("./ui/menus/bundles-menu.js");
    await ctx.editMessageText(ctx.t("bundle-select-type"), {
      reply_markup: bundleTypeMenu,
      parse_mode: "HTML",
    });
  });

  bot.callbackQuery("bundle-cancel", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    if (session.other.bundle) {
      delete session.other.bundle;
    }
    const { servicesMenu } = await import("./helpers/services-menu.js");
    await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
      reply_markup: servicesMenu,
      parse_mode: "HTML",
    });
  });

  // Bundle: confirm purchase (after user entered domain name)
  bot.callbackQuery("bundle-confirm-purchase", async (ctx) => {
    const { handleBundleConfirmPurchase } = await import("./ui/menus/bundle-handlers.js");
    await handleBundleConfirmPurchase(ctx);
  });

  bot.callbackQuery("domain-register-cancel", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.callbackQuery.message) {
      await ctx.deleteMessage().catch(() => {});
    }
    await ctx.reply(ctx.t("domain-register-cancelled"), { parse_mode: "HTML" });
  });

  bot.callbackQuery(/^nps:[1-5]$/, async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (!data) return;
    const { parseNpsPayload } = await import("./modules/automations/nps-callback.js");
    const parsed = parseNpsPayload(data);
    if (!parsed) return;
    await ctx.answerCallbackQuery().catch(() => {});
    const key = `nps-${parsed.branch}` as "nps-promoter" | "nps-detractor" | "nps-neutral";
    const text = ctx.t(key);
    await ctx.reply(text, { parse_mode: "HTML" }).catch(() => {});
  });

  bot.callbackQuery("admin-menu-back", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    const hasSessionUser = await ensureSessionUser(ctx);
    if (!session || !hasSessionUser) {
      await ctx.answerCallbackQuery(
        ctx.t("error-unknown", { error: "Session not initialized" }).substring(0, 200)
      );
      return;
    }

    try {
      await ctx.editMessageText(ctx.t("admin-panel-header"), {
        reply_markup: adminMenu,
        parse_mode: "HTML",
      });
    } catch (error: any) {
      const description = error?.description || error?.message || "";
      if (description.includes("message is not modified")) {
        return;
      }
      throw error;
    }
  });

  bot.callbackQuery("admin-open-panel", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const telegramId = ctx.chatId ?? ctx.from?.id;
    if (!telegramId) {
      await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
      return;
    }
    const dataSource = ctx.appDataSource ?? (await getAppDataSource());
    const dbUser = await dataSource.manager.findOneBy(User, { telegramId: Number(telegramId) });
    const roleStr = dbUser ? String(dbUser.role).toLowerCase() : "";
    const isAdmin = dbUser && (roleStr === "admin" || dbUser.role === Role.Admin);
    if (!isAdmin) {
      await ctx.answerCallbackQuery(ctx.t("error-access-denied").substring(0, 200)).catch(() => {});
      return;
    }
    const session = await ctx.session;
    if (session?.main?.user) {
      session.main.user.role = Role.Admin;
      session.main.user.status = dbUser!.status;
      session.main.user.id = dbUser!.id;
      session.main.user.balance = dbUser!.balance;
      session.main.user.referralBalance = dbUser!.referralBalance ?? 0;
      session.main.user.isBanned = dbUser!.isBanned;
    }
    try {
      await ctx.editMessageText(ctx.t("admin-panel-header"), {
        parse_mode: "HTML",
        reply_markup: adminMenu,
      });
    } catch (e) {
      await ctx.answerCallbackQuery(ctx.t("error-unknown", { error: "Unknown error" }).substring(0, 200)).catch(() => {});
    }
  });

  bot.callbackQuery("admin-referrals-back", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    if (!session.other.controlUsersPage?.pickedUserData) return;
    const user = await ctx.appDataSource.manager.findOne(User, {
      where: { id: session.other.controlUsersPage.pickedUserData.id },
    });
    if (!user) return;
    const { text, reply_markup } = await buildControlPanelUserReply(ctx, user, undefined, controlUser);
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup }).catch(() => {});
  });

  bot.callbackQuery("admin-referrals-change-percent", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = await ctx.session;
    if (!session.other.controlUsersPage?.pickedUserData) return;
    if (session.main.user.role !== Role.Admin && session.main.user.role !== Role.Moderator) return;
    session.other.referralPercentEdit = { userId: session.other.controlUsersPage.pickedUserData.id };
    await ctx.reply(ctx.t("admin-referral-percent-enter"), { parse_mode: "HTML" });
  });

  bot.on("message:text", async (ctx, next) => {
    const session = await ctx.session;
    const messageToUser = session.other.messageToUser;
    if (messageToUser) {
      if (!ctx.hasChatType("private")) {
        return next();
      }
      if (session.main.user.role !== Role.Admin && session.main.user.role !== Role.Moderator) {
        delete session.other.messageToUser;
        return next();
      }
      const input = ctx.message.text.trim();
      if (input.startsWith("/")) {
        return next();
      }
      try {
        await ctx.api.sendMessage(messageToUser.telegramId, ctx.t("admin-message-to-user-prefix") + "\n\n" + input);
        delete session.other.messageToUser;
        await ctx.reply(ctx.t("admin-message-to-user-sent"), { parse_mode: "HTML" });
      } catch (err: any) {
        await ctx.reply(ctx.t("admin-message-to-user-failed", { error: String(err?.message || err).slice(0, 200) }), {
          parse_mode: "HTML",
        });
      }
      return;
    }

    // Bundle: user entered domain name (after "Купить пакет")
    const bundle = session.other.bundle;
    if (bundle?.step === "awaiting_domain" && ctx.message?.text) {
      const { handleBundleDomainInput } = await import("./ui/menus/bundle-handlers.js");
      const consumed = await handleBundleDomainInput(ctx, ctx.message.text.trim());
      if (consumed) return;
    }

    const balanceEdit = session.other.balanceEdit;
    if (balanceEdit) {
      if (!ctx.hasChatType("private")) {
        return next();
      }
      if (session.main.user.role !== Role.Admin && session.main.user.role !== Role.Moderator) {
        delete session.other.balanceEdit;
        return next();
      }
      const input = ctx.message.text.trim();
      if (input.startsWith("/")) {
        return next();
      }
      const amount = Number.parseFloat(
        input.replaceAll("$", "").replaceAll(",", ".").replaceAll(" ", "").trim()
      );
      if (Number.isNaN(amount) || amount <= 0 || amount > 1_000_000) {
        await ctx.reply(ctx.t("admin-balance-invalid"), { parse_mode: "HTML" });
        return;
      }
      const targetUser = await ctx.appDataSource.manager.findOne(User, {
        where: { id: balanceEdit.userId },
      });
      if (!targetUser) {
        delete session.other.balanceEdit;
        await ctx.reply(ctx.t("error-user-not-found"), { parse_mode: "HTML" });
        return;
      }
      if (balanceEdit.action === "add") {
        targetUser.balance += amount;
      } else {
        if (targetUser.balance < amount) {
          await ctx.reply(
            ctx.t("admin-balance-deduct-more-than-have", {
              balance: targetUser.balance,
              amount,
            }),
            { parse_mode: "HTML" }
          );
          return;
        }
        targetUser.balance -= amount;
      }
      await ctx.appDataSource.manager.save(targetUser);
      delete session.other.balanceEdit;
      await ctx.reply(
        ctx.t("admin-balance-success", {
          action: balanceEdit.action === "add" ? ctx.t("admin-balance-action-add") : ctx.t("admin-balance-action-deduct"),
          amount,
          balance: targetUser.balance,
        }),
        { parse_mode: "HTML" }
      );
      return;
    }

    const subscriptionEdit = session.other.subscriptionEdit;
    if (subscriptionEdit) {
      if (!ctx.hasChatType("private")) {
        return next();
      }
      if (session.main.user.role !== Role.Admin && session.main.user.role !== Role.Moderator) {
        delete session.other.subscriptionEdit;
        return next();
      }
      const input = ctx.message.text.trim();
      if (input.startsWith("/")) {
        return next();
      }
      const days = Number.parseInt(input.replace(/\s/g, ""), 10);
      if (Number.isNaN(days) || days <= 0 || days > 3650) {
        await ctx.reply(ctx.t("admin-subscription-invalid-days"), { parse_mode: "HTML" });
        return;
      }
      const targetUser = await ctx.appDataSource.manager.findOne(User, {
        where: { id: subscriptionEdit.userId },
      });
      if (!targetUser) {
        delete session.other.subscriptionEdit;
        await ctx.reply(ctx.t("error-user-not-found"), { parse_mode: "HTML" });
        return;
      }
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      targetUser.primeActiveUntil = until;
      await ctx.appDataSource.manager.save(targetUser);
      delete session.other.subscriptionEdit;
      const { text, reply_markup } = await buildControlPanelUserReply(ctx, targetUser, undefined, controlUser);
      await ctx.reply(text, { parse_mode: "HTML", reply_markup });
      return;
    }

    const referralPercentEdit = session.other.referralPercentEdit;
    if (referralPercentEdit) {
      if (!ctx.hasChatType("private")) {
        return next();
      }
      if (session.main.user.role !== Role.Admin && session.main.user.role !== Role.Moderator) {
        delete session.other.referralPercentEdit;
        return next();
      }
      const input = ctx.message.text.trim();
      if (input.startsWith("/")) {
        return next();
      }
      const value = Number.parseFloat(input.replace(",", ".").replace(/\s/g, ""));
      if (Number.isNaN(value) || value < 0 || value > 100) {
        await ctx.reply(ctx.t("admin-referral-percent-invalid"), { parse_mode: "HTML" });
        return;
      }
      const targetUser = await ctx.appDataSource.manager.findOne(User, {
        where: { id: referralPercentEdit.userId },
      });
      if (!targetUser) {
        delete session.other.referralPercentEdit;
        await ctx.reply(ctx.t("error-user-not-found"), { parse_mode: "HTML" });
        return;
      }
      targetUser.referralPercent = Math.round(value * 100) / 100;
      await ctx.appDataSource.manager.save(targetUser);
      delete session.other.referralPercentEdit;
      await ctx.reply(
        ctx.t("admin-referral-percent-success", { percent: targetUser.referralPercent }),
        { parse_mode: "HTML" }
      );
      return;
    }

    if (!session.other.promocode.awaitingInput) {
      return next();
    }
    if (!ctx.hasChatType("private")) {
      return next();
    }
    const input = ctx.message.text.trim();
    if (input.startsWith("/")) {
      return next();
    }

    session.other.promocode.awaitingInput = false;
    await handlePromocodeInput(ctx, input);
  });

  // Withdraw: user tapped "Вывод средств", we asked for amount; this message is the amount → enter conversation
  bot.on("message:text", async (ctx, next) => {
    const session = await ctx.session;
    const withdrawStart = session.other?.withdrawStart;
    if (!withdrawStart?.awaitingAmount || !ctx.message?.text) {
      return next();
    }
    if (!ctx.hasChatType("private")) {
      return next();
    }
    const text = ctx.message.text.trim().replace(/[$,]/g, "");
    const amount = parseFloat(text);
    const maxBalance = withdrawStart.maxBalance ?? 0;
    delete session.other.withdrawStart;

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(ctx.t("withdraw-invalid-amount"));
      return;
    }
    if (amount < 15) {
      await ctx.reply(ctx.t("withdraw-minimum-not-met", { balance: maxBalance }));
      return;
    }
    if (amount > maxBalance) {
      await ctx.reply(ctx.t("withdraw-amount-exceeds-balance", { amount, balance: maxBalance }));
      return;
    }

    session.other.withdrawInitialAmount = amount;
    try {
      await ctx.conversation.enter("withdrawRequestConversation");
    } catch (err: unknown) {
      Logger.error("Failed to start withdraw conversation:", err);
      delete session.other.withdrawInitialAmount;
      await ctx.reply(ctx.t("error-unknown", { error: "failed to start" })).catch(() => {});
    }
  });

  bot.on("message:text", async (ctx, next) => {
    const session = await ctx.session;
    if (!session.other.deposit.awaitingAmount) {
      return next();
    }
    if (!ctx.hasChatType("private")) {
      return next();
    }
    const input = ctx.message.text.trim();
    if (input.startsWith("/")) {
      return next();
    }

    session.other.deposit.awaitingAmount = false;

    const sumToDeposit = Number.parseInt(
      input.replaceAll("$", "").replaceAll(",", "").replaceAll(".", "").replaceAll(" ", "").trim()
    );

    if (isNaN(sumToDeposit) || sumToDeposit <= 0 || sumToDeposit > 1_500_000) {
      await ctx.reply(ctx.t("deposit-money-incorrect-sum"), { parse_mode: "HTML" });
      return;
    }

    session.main.lastSumDepositsEntered = sumToDeposit;
    await ctx.reply(ctx.t("deposit-success-sum", { amount: sumToDeposit }), {
      reply_markup: depositPaymentSystemChoose,
      parse_mode: "HTML",
    });
  });

  vdsManageSpecific.register(vdsReinstallOs);
  vdsManageServiceMenu.register(vdsReinstallOs, "vds-manage-services-list");

  // Domain purchase flow for zone-based domains menu
  bot.on("message:text", async (ctx, next) => {
    const session = await ctx.session;
    const pendingZone = session.other.domains?.pendingZone;
    if (!pendingZone) {
      return next();
    }
    if (!ctx.hasChatType("private")) {
      return next();
    }
    if (session.other.broadcast?.step === "awaiting_text") {
      return next();
    }

    const input = ctx.message.text.trim().toLowerCase();
    if (input.startsWith("/")) {
      return next();
    }

    // If user entered full domain (e.g. "name.com"), use it as-is; do not append pendingZone (would produce "name.com.club")
    const domain = input.includes(".")
      ? input
      : `${input}${pendingZone}`;
    const domainChecker = new DomainChecker();

    if (!domainChecker.domainIsValid(domain)) {
      await ctx.reply(
        ctx.t("domain-invalid", {
          domain: escapeUserInput(domain),
        }),
        { parse_mode: "HTML" }
      );
      await ctx.reply(ctx.t("domain-question", { zoneName: pendingZone }), {
        reply_markup: new InlineKeyboard().text(
          ctx.t("button-cancel"),
          "domain-register-cancel"
        ),
        parse_mode: "HTML",
      });
      return;
    }

    try {
      await ctx.reply(ctx.t("domain-checking-availability", { domain }));

      let available: boolean;
      const amperBaseUrl = process.env.AMPER_API_BASE_URL || "";
      const amperToken = process.env.AMPER_API_TOKEN || "";

      let checkReason: string | undefined;
      if (amperBaseUrl && amperToken) {
        const { AmperDomainsProvider } = await import("@/infrastructure/domains/AmperDomainsProvider.js");
        const provider = new AmperDomainsProvider({
          apiBaseUrl: amperBaseUrl,
          apiToken: amperToken,
          timeoutMs: parseInt(process.env.AMPER_API_TIMEOUT_MS || "8000"),
        });
        const result = await provider.checkAvailability(domain);
        Logger.info(`[DomainCheck] Amper result for ${domain}:`, {
          available: result.available,
          formatError: result.formatError,
          reason: result.reason,
          domain: result.domain,
        });
        // Если Amper возвращает ошибку формата — не можем определить доступность заранее
        // Разрешаем попытку регистрации, Amper сам проверит при регистрации
        if (result.formatError) {
          Logger.warn(`[DomainCheck] Format error for ${domain}, allowing registration attempt`);
          // Показываем предупреждение, но разрешаем попробовать зарегистрировать
          available = true;
          checkReason = "⚠️ Проверка доступности через API недоступна. При регистрации домен будет проверен автоматически.";
        } else {
          available = result.available;
          checkReason = result.reason;
          Logger.info(`[DomainCheck] Domain ${domain} availability: ${available}, reason: ${checkReason}`);
        }
      } else if (process.env.DOMAINR_TOKEN && process.env.DOMAINR_TOKEN.trim().length > 0) {
        try {
          const status = await domainChecker.getStatus(domain);
          available = status === "Available";
        } catch {
          // DomainR не работает — разрешаем попробовать зарегистрировать
          available = true;
        }
      } else {
        available = true;
      }

      if (available) {
        session.other.domains.lastPickDomain = domain;
        session.other.domains.pendingZone = undefined; // clear so next message doesn't reuse old zone

        await ctx.reply(
          ctx.t("domain-available", {
            domain: `${escapeUserInput(domain)}`,
          }),
          {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard().text(
              ctx.t("button-agree"),
              `agree-buy-domain:${domain}`
            ),
          }
        );
        return;
      }

      const notAvailableText = checkReason
        ? ctx.t("domain-not-available-with-reason", {
            domain: escapeUserInput(domain),
            reason: checkReason.slice(0, 200),
          })
        : ctx.t("domain-not-available", { domain: escapeUserInput(domain) });
      await ctx.reply(notAvailableText, { parse_mode: "HTML" });
      await ctx.reply(ctx.t("domain-check-unrelated-to-balance"), { parse_mode: "HTML" });
      await ctx.reply(ctx.t("domain-question", { zoneName: pendingZone }), {
        reply_markup: new InlineKeyboard().text(
          ctx.t("button-cancel"),
          "domain-register-cancel"
        ),
        parse_mode: "HTML",
      });
    } catch (error: any) {
      console.error("[Domain] Check failed:", error);
      await ctx.reply(
        ctx.t("error-unknown", { error: error?.message || "Unknown error" })
      );
    }
  });

  // Register commands AFTER all menus are registered via bot.use()
  // Balance command - show profile with balance
  bot.command("balance", async (ctx) => {
    try {
      if (ctx.message) {
        await ctx.deleteMessage().catch(() => {});
      }

      const session = await ctx.session;
      
      if (!ctx.hasChatType("private")) {
        return;
      }

      // Open topup method menu
      await ctx.reply(ctx.t("topup-select-method"), {
        reply_markup: topupMethodMenu,
        parse_mode: "HTML",
      });
    } catch (error: any) {
      console.error("Failed to execute /balance command:", error);
      await ctx.reply(ctx.t("error-unknown", { error: error.message || "Unknown error" }));
    }
  });

  // Services command - show services menu
  bot.command("services", async (ctx) => {
    try {
      if (ctx.message) {
        await ctx.deleteMessage().catch(() => {});
      }

      await ctx.reply(ctx.t("menu-service-for-buy-choose"), {
        reply_markup: servicesMenu,
        parse_mode: "HTML",
      });
    } catch (error: any) {
      console.error("Failed to execute /services command:", error);
      await ctx.reply(ctx.t("error-unknown", { error: error.message || "Unknown error" }));
    }
  });

  // Admin panel command (admin only) — check ONLY by DB, ignore session
  bot.command("admin", async (ctx) => {
    try {
      if (ctx.message) await ctx.deleteMessage().catch(() => {});

      const telegramId = ctx.chatId ?? ctx.from?.id;
      if (!telegramId) {
        await ctx.reply(ctx.t("error-access-denied"));
        return;
      }
      const dataSource = ctx.appDataSource ?? (await getAppDataSource());
      const dbUser = await dataSource.manager.findOneBy(User, {
        telegramId: Number(telegramId),
      });
      const roleStr = dbUser ? String(dbUser.role).toLowerCase() : "";
      const isAdmin = dbUser && (roleStr === "admin" || dbUser.role === Role.Admin);
      if (!isAdmin) {
        await ctx.reply(ctx.t("error-access-denied"));
        return;
      }
      const session = await ctx.session;
      if (session?.main?.user) {
        session.main.user.role = Role.Admin;
        session.main.user.status = dbUser.status;
        session.main.user.id = dbUser.id;
        session.main.user.balance = dbUser.balance;
        session.main.user.referralBalance = dbUser.referralBalance ?? 0;
        session.main.user.isBanned = dbUser.isBanned;
      }
      await ctx.reply(ctx.t("admin-panel-header"), {
        parse_mode: "HTML",
        reply_markup: adminMenu,
      });
    } catch (error: any) {
      console.error("[Admin] /admin failed:", error);
      await ctx.reply(ctx.t("error-unknown", { error: error.message || "Unknown error" }));
    }
  });

  // Broadcast command (admin only)
  bot.command("broadcast", async (ctx) => {
    const session = await ctx.session;
    const hasSessionUser = await ensureSessionUser(ctx);
    if (!session || !hasSessionUser) {
      await ctx.reply(ctx.t("error-unknown", { error: "Session not initialized" }));
      return;
    }
    if (session.main.user.role !== Role.Admin) {
      return;
    }

    const text = ctx.message?.text?.split(" ").slice(1).join(" ").trim() || "";
    if (text.length > 0) {
      session.other.broadcast = { step: "awaiting_confirm", text };
      const keyboard = new InlineKeyboard()
        .text(ctx.t("button-send"), "broadcast_confirm")
        .text(ctx.t("button-cancel"), "broadcast_cancel");
      const previewText = escapeUserInput(text);
      await ctx.reply(ctx.t("broadcast-preview", { text: previewText }), {
        reply_markup: keyboard,
        parse_mode: "HTML",
      });
      return;
    }

    session.other.broadcast = { step: "awaiting_text" };
    await ctx.reply(ctx.t("broadcast-enter-text"), { parse_mode: "HTML" });
  });

  // Send broadcast immediately (admin only)
  bot.command("send", async (ctx) => {
    const session = await ctx.session;
    const hasSessionUser = await ensureSessionUser(ctx);
    if (!session || !hasSessionUser) {
      await ctx.reply(ctx.t("error-unknown", { error: "Session not initialized" }));
      return;
    }
    if (session.main.user.role !== Role.Admin) {
      return;
    }

    const text = ctx.message?.text?.split(" ").slice(1).join(" ").trim() || "";
    if (text.length === 0) {
      session.other.broadcast = { step: "awaiting_text" };
      await ctx.reply(ctx.t("broadcast-enter-text"), { parse_mode: "HTML" });
      return;
    }

    try {
      const broadcastService = new BroadcastService(ctx.appDataSource, bot);
      const broadcast = await broadcastService.createBroadcast(session.main.user.id, text);

      const statusMessage = await ctx.reply(
        ctx.t("broadcast-starting", { id: broadcast.id })
      );

      broadcastService
        .sendBroadcast(broadcast.id)
        .then(async (result) => {
          try {
            const errors = await broadcastService.getBroadcastErrors(broadcast.id);
            const errorText =
              errors.length > 0 ? `\n\n<code>${errors.slice(0, 5).join("\n")}</code>` : "";
            const completedText =
              ctx.t("broadcast-completed") +
              "\n\n" +
              ctx.t("broadcast-stats", {
                total: result.totalCount,
                sent: result.sentCount,
                failed: result.failedCount,
                blocked: result.blockedCount,
              }) +
              errorText;

            await ctx.api.editMessageText(
              ctx.chatId,
              statusMessage.message_id,
              completedText,
              { parse_mode: "HTML" }
            );
          } catch (error) {
            Logger.warn("Failed to update broadcast status:", error);
          }
        })
        .catch((error) => {
          Logger.error("Broadcast failed:", error);
        });
    } catch (error) {
      Logger.error("Failed to start broadcast:", error);
      await ctx.reply(
        ctx.t("error-unknown", {
          error: (error as Error)?.message || "Unknown error",
        }).substring(0, 200)
      );
    }
  });

  // Register bot commands in Telegram menu (after all commands are registered)
  bot.api.setMyCommands([
    { command: "start", description: "Главное меню" },
    { command: "balance", description: "Проверить баланс" },
    { command: "services", description: "Услуги" },
    { command: "admin", description: "Админ-панель (только для админов)" },
  ]).catch((error) => {
    console.error("Failed to set bot commands:", error);
  });

  mainMenu.register(supportMenu, "main-menu");
  mainMenu.register(profileMenu, "main-menu");
  mainMenu.register(servicesMenu, "main-menu");
  mainMenu.register(manageSerivcesMenu, "main-menu");
  
  // Register referrals menu in main menu
  try {
    const { referralsMenu } = await import("./ui/menus/referrals-menu");
    mainMenu.register(referralsMenu, "main-menu");
  } catch (error: any) {
    console.error("[Bot] Failed to register referrals menu in main menu:", error);
  }
  
  // Register admin menu in main menu (for admins)
  try {
    mainMenu.register(adminMenu, "main-menu");
  } catch (error: any) {
    console.error("[Bot] Failed to register admin menu in main menu:", error);
  }

  try {
    adminMenu.register(adminPromosMenu, "admin-menu");
    adminMenu.register(adminAutomationsMenu, "admin-menu");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register admin submenus:", error);
    }
  }

  manageSerivcesMenu.register(domainManageServicesMenu, "manage-services-menu");
  manageSerivcesMenu.register(vdsManageServiceMenu, "manage-services-menu");
  manageSerivcesMenu.register(bundleManageServicesMenu, "manage-services-menu");
  // Register bundles menu
  try {
    const { bundleTypeMenu, bundlePeriodMenu } = await import("./ui/menus/bundles-menu.js");
    servicesMenu.register(bundleTypeMenu, "services-menu");
    bundleTypeMenu.register(bundlePeriodMenu, "bundle-type-menu");
  } catch (error: any) {
    console.error("[Bot] Failed to register bundles menu:", error);
  }

  servicesMenu.register(domainsMenu, "services-menu");
  try {
    servicesMenu.register(dedicatedTypeMenu, "services-menu");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register dedicatedTypeMenu:", error);
    }
  }
  servicesMenu.register(vdsTypeMenu, "services-menu");
  servicesMenu.register(vdsMenu, "services-menu");
  
  // Register dedicated servers menu in dedicated-type-menu
  try {
    dedicatedTypeMenu.register(dedicatedServersMenu, "dedicated-type-menu");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register dedicatedServersMenu:", error);
    }
  }
  
  // Register dedicated selected server menu (shows server details with Order button)
  try {
    dedicatedServersMenu.register(dedicatedSelectedServerMenu, "dedicated-servers-menu");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register dedicatedSelectedServerMenu:", error);
    }
  }
  
  // Register vds menu in vds-type-menu
  try {
    vdsTypeMenu.register(vdsMenu, "vds-type-menu");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register vdsMenu:", error);
    }
  }
  
  try {
    vdsMenu.register(vdsRateChoose, "vds-menu");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register vdsRateChoose:", error);
    }
  }
  try {
    vdsRateChoose.register(vdsRateOs, "vds-selected-rate");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register vdsRateOs:", error);
    }
  }
  profileMenu.register(topupMethodMenu, "profile-menu");
  profileMenu.register(changeLocaleMenu, "profile-menu");
  topupMethodMenu.register(depositMenu, "topup-method-menu");

  // Register menu hierarchy (only in index.ts, not in bot.ts)
  // Note: Registration is done conditionally to avoid duplicate registration
  try {
    controlUsers.register(controlUser, "control-users");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register controlUser under controlUsers:", error);
    }
  }
  try {
    controlUser.register(controlUserBalance, "control-user");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register controlUserBalance:", error);
    }
  }
  try {
    controlUser.register(controlUserSubscription, "control-user");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register controlUserSubscription:", error);
    }
  }
  try {
    controlUser.register(controlUserStatus, "control-user");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register controlUserStatus:", error);
    }
  }
  try {
    controlUserStatus.register(controlUser, "control-user-status");
  } catch (error: any) {
    if (!error.message?.includes("already registered")) {
      console.error("[Bot] Failed to register controlUser in controlUserStatus:", error);
    }
  }

  registerDomainRegistrationMiddleware(bot);

  bot.command("domainrequests", async (ctx) => {
    const session = await ctx.session;
    if (
      session.main.user.role != Role.Admin &&
      session.main.user.role != Role.Moderator
    )
      return;

    const domainRequestRepo = ctx.appDataSource.getRepository(DomainRequest);

    const requests = await domainRequestRepo.find({
      where: {
        status: DomainRequestStatus.InProgress,
      },
    });

    if (requests.length > 0) {
      ctx.reply(
        `${ctx.t("domain-request-list-header")}\n${requests
          .map((request) =>
            ctx.t("domain-request", {
              id: request.id,
              targetId: request.target_user_id,
              domain: `${request.domainName}${request.zone}`,
              info: request.additionalInformation || ctx.t("empty"),
            })
          )
          .join("\n")}\n\n${ctx.t("domain-request-list-info")}`,
        {
          parse_mode: "HTML",
        }
      );
    } else {
      ctx.reply(
        `${ctx.t("domain-request-list-header")}\n${ctx.t("list-empty")}`,
        {
          parse_mode: "HTML",
        }
      );
    }
  });

  bot.command("help", async (ctx) => {
    const session = await ctx.session;

    if (session.main.user.role == Role.Admin) {
      ctx.reply(ctx.t("admin-help"), {
        parse_mode: "HTML",
      });
    }
  });

  bot.command("promote_link", async (ctx) => {
    const session = await ctx.session;
    if (session.main.user.role != Role.Admin) return;

    const link = createLink(Role.Moderator);
    const createdLink = await ctx.appDataSource.manager.save(link);

    ctx.reply(ctx.t("promote-link"), {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().url(
        ctx.t("button-send-promote-link"),
        `tg://msg_url?url=https://t.me/${ctx.me.username}?start=${PREFIX_PROMOTE}${createdLink.code}`
      ),
    });
  });

  // create_promo <name> <sum> <max_uses>
  bot.command("create_promo", async (ctx) => {
    const session = await ctx.session;

    if (session.main.user.role != Role.Admin) return;

    const args = ctx.match.split(" ").map((s) => s.trim());

    if (!args || args.length !== 3) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const [name, sum, maxUses] = args;

    if (!name || isNaN(Number(sum)) || isNaN(Number(maxUses))) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const promoRepo = ctx.appDataSource.getRepository(Promo);

    const promo = await promoRepo.findOneBy({
      code: name.toLowerCase(),
    });

    if (promo) {
      await ctx.reply(ctx.t("promocode-already-exist"));
      return;
    }

    const newPromo = new Promo();

    newPromo.code = name.toLowerCase();
    newPromo.maxUses = Number(maxUses);
    newPromo.sum = Number(sum);
    newPromo.isActive = true;

    await promoRepo.save(newPromo);

    await ctx.reply(ctx.t("new-promo-created"), {
      parse_mode: "HTML",
    });
  });

  // promo_codes
  bot.command("promo_codes", async (ctx) => {
    const session = await ctx.session;

    if (session.main.user.role != Role.Admin) return;

    const promoRepo = ctx.appDataSource.getRepository(Promo);

    const promos = await promoRepo.find({});
    let promocodeList;
    if (promos.length == 0) {
      promocodeList = ctx.t("list-empty");
    } else {
      // name use maxUses
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

  // remove_promo <id>
  bot.command("remove_promo", async (ctx) => {
    const session = await ctx.session;

    if (session.main.user.role != Role.Admin) return;

    const promoRepo = ctx.appDataSource.getRepository(Promo);

    const args = ctx.match.split(" ").map((s) => s.trim());

    if (!args || args.length !== 1) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const [id] = args;

    if (!id || isNaN(Number(id))) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const promo = await promoRepo.findOneBy({
      id: Number(id),
    });

    if (!promo) {
      await ctx.reply(ctx.t("promocode-not-found"));
      return;
    }

    await promoRepo.delete({
      id: Number(id),
    });

    await ctx.reply(
      ctx.t("promocode-deleted", {
        name: promo.code,
      }),
      {
        parse_mode: "HTML",
      }
    );
  });

  // approve_domain <id> <expire_at>
  bot.command("approve_domain", async (ctx) => {
    const session = await ctx.session;

    if (
      session.main.user.role != Role.Admin &&
      session.main.user.role != Role.Moderator
    )
      return;

    const args = ctx.match.split(" ").map((s) => s.trim());

    if (!args || args.length !== 2) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const [id, expireAt] = args;

    const expireAtN = ms(expireAt);

    if (!id || isNaN(Number(id)) || !expireAt || expireAtN == undefined) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const domainRequestRepo = ctx.appDataSource.getRepository(DomainRequest);

    const request = await domainRequestRepo.findOneBy({
      id: Number(id),
      status: DomainRequestStatus.InProgress,
    });

    if (!request) {
      await ctx.reply(ctx.t("domain-request-not-found"));
      return;
    }

    request.status = DomainRequestStatus.Completed;
    request.expireAt = new Date(Date.now() + expireAtN);
    request.payday_at = new Date(
      request.expireAt.getTime() - 7 * 24 * 60 * 60 * 1000
    );

    await domainRequestRepo.save(request);

    await ctx.reply(ctx.t("domain-request-approved", {}), {
      parse_mode: "HTML",
    });
  });

  // showvds <userId>
  bot.command("showvds", async (ctx) => {
    const session = await ctx.session;

    if (
      session.main.user.role != Role.Admin &&
      session.main.user.role != Role.Moderator
    )
      return;

    const args = ctx.match.split(" ").map((s) => s.trim());

    if (!args || args.length !== 1) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const [userId] = args;

    if (!userId || isNaN(Number(userId))) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

    const vdsList = await vdsRepo.find({
      where: {
        targetUserId: Number(userId),
      },
    });

    if (vdsList.length === 0) {
      await ctx.reply(ctx.t("no-vds-found"));
      return;
    }

    const vdsInfo = vdsList
      .map((vds) =>
        ctx.t("vds-info-admin", {
          id: vds.id,
          ip: vds.ipv4Addr,
          expireAt: vds.expireAt.toISOString(),
          renewalPrice: vds.renewalPrice,
        })
      )
      .join("\n");

    await ctx.reply(vdsInfo, {
      parse_mode: "HTML",
    });
  });

  // removevds <idVds>
  bot.command("removevds", async (ctx) => {
    const session = await ctx.session;

    if (
      session.main.user.role != Role.Admin &&
      session.main.user.role != Role.Moderator
    )
      return;

    const args = ctx.match.split(" ").map((s) => s.trim());

    if (!args || args.length !== 1) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const [idVds] = args;

    if (!idVds || isNaN(Number(idVds))) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

    const vds = await vdsRepo.findOneBy({
      id: Number(idVds),
    });

    if (!vds) {
      await ctx.reply(ctx.t("vds-not-found"));
      return;
    }

    let result;
    let attempts = 0;

    while (result == undefined && attempts < 3) {
      result = await ctx.vmmanager.deleteVM(vds.vdsId);
      attempts++;
    }

    if (result == undefined) {
      await ctx.reply(ctx.t("vds-remove-failed", { id: idVds }), {
        parse_mode: "HTML",
      });
      return;
    }

    await vdsRepo.delete({
      id: Number(idVds),
    });

    await ctx.reply(ctx.t("vds-removed", { id: idVds }), {
      parse_mode: "HTML",
    });
  });

  // reject_domain <id>
  bot.command("reject_domain", async (ctx) => {
    const session = await ctx.session;

    if (
      session.main.user.role != Role.Admin &&
      session.main.user.role != Role.Moderator
    )
      return;

    const args = ctx.match.split(" ").map((s) => s.trim());

    if (!args || args.length !== 1) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const [id] = args;

    if (!id || isNaN(Number(id))) {
      await ctx.reply(ctx.t("invalid-arguments"));
      return;
    }

    const domainRequestRepo = ctx.appDataSource.getRepository(DomainRequest);
    const userRequestRepo = ctx.appDataSource.getRepository(User);

    const request = await domainRequestRepo.findOneBy({
      id: Number(id),
      status: DomainRequestStatus.InProgress,
    });

    if (!request) {
      await ctx.reply(ctx.t("domain-request-not-found"));
      return;
    }

    request.status = DomainRequestStatus.Failed;

    const user = await userRequestRepo.findOneBy({
      id: session.main.user.id,
    });

    if (user) {
      user.balance += request.price;
      await userRequestRepo.save(user);
    }

    await domainRequestRepo.save(request);
    await ctx.reply(ctx.t("domain-request-reject", {}), {
      parse_mode: "HTML",
    });
  });

  bot.command("users", async (ctx) => {
    await ctx.deleteMessage();
    const session = await ctx.session;
    if (session.main.user.role == Role.User) return;

    await ctx.reply(ctx.t("control-panel-users"), {
      reply_markup: controlUsers,
      parse_mode: "HTML",
    });
  });

  const isWebhookEnabled = (): boolean => {
    const url = process.env.IS_WEBHOOK?.trim();
    const port = process.env.PORT_WEBHOOK?.trim();
    if (!url || !port) {
      return false;
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const run = async () => {
    console.info("[Dior Host Bot]: Starting");
    if (isWebhookEnabled()) {
      console.info("[Dior Host Bot]: Starting in webhook mode");
      const app = express();

      app.use(
        express.json({
          verify: (req, _res, buf) => {
            (req as any).rawBody = buf.toString("utf8");
          },
        })
      );
      app.post("/webhooks/cryptopay", (req, res) =>
        handleCryptoPayWebhook(req, res, bot)
      );
      app.use(
        webhookCallback(bot, "express", {
          onTimeout: "return",
        })
      );

      await bot.api.setWebhook(process.env.IS_WEBHOOK!);

      app.listen(Number(process.env.PORT_WEBHOOK), () => {});
    } else {
      if (process.env.IS_WEBHOOK || process.env.PORT_WEBHOOK) {
        console.warn(
          "[Dior Host Bot]: Webhook disabled. Check IS_WEBHOOK (must be https URL) and PORT_WEBHOOK."
        );
      }
      // Delete webhook anyway in this way :)
      await bot.api.deleteWebhook();

      bot.catch((err) => {
        console.error("[Bot Error]", err.name, err.message);
        if (process.env["NODE_ENV"] == "development") {
          console.error(err.stack);
        }
        // Don't crash the bot on errors
      });
      
      // Global error handlers to prevent crashes
      process.on("unhandledRejection", (reason, promise) => {
        console.error("[Unhandled Rejection]", reason);
        // Don't exit, just log
      });
      
      process.on("uncaughtException", (error) => {
        console.error("[Uncaught Exception]", error);
        // Don't exit in development, but log
        if (process.env["NODE_ENV"] != "development") {
          process.exit(1);
        }
      });

      console.info("[Dior Host Bot]: Starting in long polling mode");
      grammyRun(bot);

      console.info("[Dior Host Bot]: Started");
    }
  };

  startCheckTopUpStatus(bot);
  const servicePaymentChecker = new ServicePaymentStatusChecker(bot);
  servicePaymentChecker.start();

  await run();
}

index()
  .then(() => {
    console.log("[Bot] Initialization completed successfully");
    const cryptopayToken =
      process.env["PAYMENT_CRYPTOBOT_TOKEN"]?.trim() ||
      process.env["PAYMENT_CRYPTO_PAY_TOKEN"]?.trim();
    if (cryptopayToken) {
      console.log("[Bot] Crypto Pay (CryptoBot): configured");
    } else {
      console.warn(
        "[Bot] Crypto Pay (CryptoBot): not configured — set PAYMENT_CRYPTOBOT_TOKEN or PAYMENT_CRYPTO_PAY_TOKEN in .env"
      );
    }
  })
  .catch((err) => {
    console.error("[Bot] Fatal error during initialization:", err);
    // In development, don't exit immediately - allow nodemon to restart
    if (process.env["NODE_ENV"] != "development") {
      process.exit(1);
    }
  });

async function startExpirationCheck(
  bot: Bot<MyAppContext, Api<RawApi>>,
  vmManager: VMManager,
  fluent: Fluent
) {
  const appDataSource = await getAppDataSource();

  setInterval(async () => {
    const vdsRepo = appDataSource.getRepository(VirtualDedicatedServer);
    const usersRepo = appDataSource.getRepository(User);
    const domainsRepo = appDataSource.getRepository(DomainRequest);

    const domains = await domainsRepo.find({
      where: {
        payday_at: LessThanOrEqual(new Date()),
        status: DomainRequestStatus.Completed,
      },
    });

    const vdsList = await vdsRepo.find({
      where: {
        expireAt: LessThanOrEqual(new Date()),
      },
    });

    vdsList.forEach(async (vds) => {
      const user = await usersRepo.findOneBy({
        id: vds.targetUserId,
      });

      if (!user) {
        return;
      }

      if (user.balance < vds.renewalPrice) {
        if (!vds.payDayAt) {
          vds.payDayAt = new Date(Date.now() + ms("3d"));
          vdsRepo.save(vds);

          await bot.api.sendMessage(
            user.telegramId,
            fluent.translate(user.lang || "en", "vds-expiration", {
              amount: vds.renewalPrice,
            })
          );

          return;
        }

        if (new Date(vds.payDayAt).getTime() > Date.now()) {
          let deleted;
          while (deleted == undefined) {
            deleted = await vmManager.deleteVM(vds.vdsId);
          }

          await vdsRepo.delete(vds);
        }
      } else {
        user.balance -= vds.renewalPrice;

        vds.expireAt = new Date(Date.now() + ms("30d"));
        // @ts-ignore
        vds.payDayAt = null;

        await usersRepo.save(user);
        await vdsRepo.save(vds);
      }
    });

    domains.forEach(async (domain) => {
      const user = await usersRepo.findOneBy({
        id: domain.target_user_id,
      });

      if (!user) {
        return;
      }

      if (user.balance < domain.price) {
        domain.status = DomainRequestStatus.Expired;
        domainsRepo.save(domain);
      } else {
        user.balance -= domain.price;
        const now = Date.now();
        domain.expireAt = new Date(now + ms("1y"));
        domain.payday_at = new Date(now + ms("360d"));

        usersRepo.save(user);
        domainsRepo.save(domain);
      }
    });
  }, ms("1d"));
}
