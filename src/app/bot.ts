/**
 * Main bot initialization and configuration.
 * Thin bootstrap file that wires all components together.
 *
 * @module app/bot
 */

import { Bot, session, MemorySessionStorage, webhookCallback } from "grammy";
import { FileAdapter } from "@grammyjs/storage-file";
import { useFluent } from "@grammyjs/fluent";
import { conversations } from "@grammyjs/conversations";
import { run as grammyRun } from "@grammyjs/runner";
import express from "express";

import { config, isWebhookMode, getWebhookPort } from "./config.js";
import { Logger } from "./logger.js";
import { setupErrorHandler } from "./error-handler.js";
import {
  databaseMiddleware,
  localeMiddleware,
  banCheckMiddleware,
  vmmanagerMiddleware,
  languagesMiddleware,
} from "./middlewares.js";
import { initFluent } from "../fluent.js";
import { getAppDataSource } from "../infrastructure/db/datasource.js";
import { VMManager } from "../infrastructure/vmmanager/VMManager.js";
import { Role } from "../entities/User.js";
import type { AppContext } from "../shared/types/context.js";
import type { MainSessionData, OtherSessionData } from "../shared/types/session.js";
import { PaymentStatusChecker } from "../domain/billing/PaymentStatusChecker.js";
import { BillingService } from "../domain/billing/BillingService.js";
import { UserRepository } from "../infrastructure/db/repositories/UserRepository.js";
import { TopUpRepository } from "../infrastructure/db/repositories/TopUpRepository.js";
import { ExpirationService } from "../domain/services/ExpirationService.js";

/**
 * Initialize and configure the Telegram bot.
 *
 * @returns Configured bot instance and cleanup function
 */
export async function createBot(): Promise<{
  bot: Bot<AppContext>;
  cleanup: () => Promise<void>;
}> {
  Logger.info("Initializing bot...");

  // Initialize Fluent i18n
  const { fluent, availableLocales } = await initFluent();
  Logger.info("Fluent i18n initialized");

  // Initialize database
  const dataSource = await getAppDataSource();
  Logger.info("Database initialized");

  // Initialize VMManager
  const vmManager = new VMManager(config.VMM_EMAIL, config.VMM_PASSWORD);
  Logger.info("VMManager initialized");

  // Initialize services
  const userRepo = new UserRepository(dataSource);
  const topUpRepo = new TopUpRepository(dataSource);
  const billingService = new BillingService(dataSource, userRepo, topUpRepo);
  Logger.info("Services initialized");

  // Create bot instance first
  const bot = new Bot<AppContext>(config.BOT_TOKEN, {});

  // Initialize payment status checker with bot
  const paymentChecker = new PaymentStatusChecker(bot, billingService, fluent);
  Logger.info("PaymentStatusChecker initialized");

  // Setup session
  bot.use(
    session({
      type: "multi",
      other: {
        storage: new MemorySessionStorage<OtherSessionData>(),
        initial: (): OtherSessionData => ({
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
          manageVds: {
            page: 0,
            lastPickedId: -1,
          },
          domains: {
            lastPickDomain: "",
            page: 0,
          },
        }),
      },
      main: {
        initial: (): MainSessionData => ({
          locale: "0",
          user: {
            id: 0,
            balance: 0,
            role: Role.User,
            isBanned: false,
          },
          lastSumDepositsEntered: 0,
        }),
        storage: new FileAdapter({
          dirName: "sessions",
        }),
      },
    })
  );

  // Setup middlewares
  bot.use(languagesMiddleware(availableLocales));
  bot.use(databaseMiddleware);
  bot.use(localeMiddleware);

  // Setup Fluent i18n
  bot.use(
    useFluent({
      fluent,
      localeNegotiator: async (ctx) => {
        const session = await ctx.session;
        return session.main.locale || "en";
      },
    })
  );

  // Check if user is banned
  bot.use(banCheckMiddleware);

  // Setup VMManager middleware
  bot.use(vmmanagerMiddleware(vmManager));

  // Setup conversations
  bot.use(conversations());

  // Register menus - using old menus temporarily to preserve functionality
  // TODO: Gradually migrate to new menu structure (ui/menus/)
  const { getLegacyMenus, createMainMenu } = await import("../ui/menus/legacy-menus.js");
  const legacyMenus = await getLegacyMenus();
  
  // Create main menu without circular dependency
  const mainMenu = createMainMenu();
  
  // Import old menus from helpers
  const servicesMenu = legacyMenus.servicesMenu.servicesMenu;
  const domainsMenu = legacyMenus.servicesMenu.domainsMenu;
  const vdsMenu = legacyMenus.servicesMenu.vdsMenu;
  const vdsRateChoose = legacyMenus.servicesMenu.vdsRateChoose;
  const vdsRateOs = legacyMenus.servicesMenu.vdsRateOs;
  const domainOrderMenu = legacyMenus.servicesMenu.domainOrderMenu;
  const domainQuestion = legacyMenus.servicesMenu.domainQuestion;
  
  const depositMenu = legacyMenus.depositMoney.depositMenu;
  const depositPaymentSystemChoose = legacyMenus.depositMoney.depositPaymentSystemChoose;
  const depositMoneyConversation = legacyMenus.depositMoney.depositMoneyConversation;
  
  const manageSerivcesMenu = legacyMenus.manageServices.manageSerivcesMenu;
  const domainManageServicesMenu = legacyMenus.manageServices.domainManageServicesMenu;
  const vdsManageServiceMenu = legacyMenus.manageServices.vdsManageServiceMenu;
  const vdsManageSpecific = legacyMenus.manageServices.vdsManageSpecific;
  const vdsReinstallOs = legacyMenus.manageServices.vdsReinstallOs;
  
  const controlUser = legacyMenus.usersControl.controlUser;
  const controlUsers = legacyMenus.usersControl.controlUsers;
  
  const promocodeQuestion = legacyMenus.promocodeInput.promocodeQuestion;
  
  // Import Menu for creating new menus
  const { Menu } = await import("@grammyjs/menu");
  
  // Create profile menu
  const profileMenu = new Menu<AppContext>("profile-menu", {})
    .submenu((ctx) => ctx.t("button-deposit"), "deposit-menu")
    .text(
      (ctx) => ctx.t("button-promocode"),
      async (ctx) => {
        await promocodeQuestion.replyWithHTML(ctx, ctx.t("promocode-input-question"));
      }
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

  // Create change locale menu
  const changeLocaleMenu = new Menu<AppContext>("change-locale-menu", {
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
              const userRepo = new UserRepository(ctx.appDataSource);
              try {
                await userRepo.updateLanguage(session.main.user.id, lang as "ru" | "en");
              } catch (error) {
                // Ignore if user not found
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

  // Create about us menu
  const aboutUsMenu = new Menu<AppContext>("about-us-menu", {
    autoAnswer: false,
  })
    .url((ctx) => ctx.t("button-go-to-site"), config.WEBSITE_URL)
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

  // Create support menu
  const supportMenu = new Menu<AppContext>("support-menu", {
    autoAnswer: false,
  })
    .url(
      (ctx) => ctx.t("button-ask-question"),
      (ctx) => {
        const supportUsername = config.SUPPORT_USERNAME_TG;
        return `tg://resolve?domain=${supportUsername}&text=${encodeURIComponent(
          ctx.t("support-message-template")
        )}`;
      }
    )
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
  
  // Register all menus
  bot.use(mainMenu);
  bot.use(servicesMenu);
  bot.use(domainOrderMenu);
  bot.use(depositPaymentSystemChoose);
  bot.use(controlUser);
  bot.use(controlUsers);
  
  // Register menu hierarchy
  mainMenu.register(changeLocaleMenu, "main-menu");
  mainMenu.register(aboutUsMenu, "main-menu");
  mainMenu.register(supportMenu, "main-menu");
  mainMenu.register(profileMenu, "main-menu");
  mainMenu.register(servicesMenu, "main-menu");
  mainMenu.register(manageSerivcesMenu, "main-menu");
  
  profileMenu.register(depositMenu, "profile-menu");
  
  manageSerivcesMenu.register(domainManageServicesMenu, "manage-services-menu");
  manageSerivcesMenu.register(vdsManageServiceMenu, "manage-services-menu");
  
  servicesMenu.register(domainsMenu, "services-menu");
  servicesMenu.register(vdsMenu, "services-menu");
  vdsMenu.register(vdsRateChoose, "vds-menu");
  vdsRateChoose.register(vdsRateOs, "vds-selected-rate");
  
  vdsManageSpecific.register(vdsReinstallOs);

  // Register conversations
  const { createConversation } = await import("@grammyjs/conversations");
  bot.use(createConversation(depositMoneyConversation, "depositMoneyConversation"));

  // Register other conversations
  bot.use(promocodeQuestion.middleware());
  bot.use(domainQuestion.middleware());
  bot.use(vdsManageSpecific);
  
  // Register middleware
  bot.use(legacyMenus.promotePerms.promotePermissions());
  legacyMenus.domainReg.registerDomainRegistrationMiddleware(bot);
  
  // Register commands
  const { registerCommands } = await import("../ui/commands/index.js");
  registerCommands(bot);

  // Setup global error handler (must be last)
  setupErrorHandler(bot);

  // Start payment checker
  paymentChecker.start();
  Logger.info("PaymentStatusChecker started");

  // Initialize and start expiration service
  const expirationService = new ExpirationService(bot, vmManager, fluent);
  expirationService.start();
  Logger.info("ExpirationService started");

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    Logger.info("Cleaning up bot resources...");
    paymentChecker.stop();
    expirationService.stop();
    vmManager.destroy();
    await getAppDataSource().then((ds) => ds.destroy()).catch(() => {});
    Logger.info("Cleanup completed");
  };

  Logger.info("Bot initialized successfully");

  return { bot, cleanup };
}

/**
 * Start the bot (long polling or webhook mode).
 *
 * @param bot - Bot instance
 */
export async function startBot(bot: Bot<AppContext>): Promise<void> {
  Logger.info("Starting bot...");

  if (isWebhookMode()) {
    Logger.info("Starting in webhook mode");

    const app = express();
    app.use(express.json());

    app.use(
      webhookCallback(bot, "express", {
        onTimeout: "return",
      })
    );

    await bot.api.setWebhook(config.IS_WEBHOOK!);
    Logger.info(`Webhook set to: ${config.IS_WEBHOOK}`);

    const port = getWebhookPort();
    app.listen(port, () => {
      Logger.info(`Webhook server listening on port ${port}`);
    });
  } else {
    Logger.info("Starting in long polling mode");

    // Delete webhook if exists
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    Logger.info("Webhook deleted (if existed)");

    // Start long polling
    grammyRun(bot);
    Logger.info("Bot started in long polling mode");
  }
}
