import {
  Bot,
  Context,
  InlineKeyboard,
  LazySessionFlavor,
  MemorySessionStorage,
  session,
  webhookCallback,
} from "grammy";
import dotenv from "dotenv";
import { FluentContextFlavor, useFluent } from "@grammyjs/fluent";
import { initFluent } from "./fluent";
import { FileAdapter } from "@grammyjs/storage-file";
import { Menu, MenuFlavor } from "@grammyjs/menu";
import { DataSource } from "typeorm";
import { getAppDataSource } from "@/database";
import User, { Role } from "@entities/User";
import { createLink } from "@entities/TempLink";
import {
  PREFIX_PROMOTE,
  promotePermissions,
} from "./helpers/promote-permissions";
import { controlUser, controlUsers } from "@helpers/users-control";
import express from "express";
import { run as grammyRun } from "@grammyjs/runner";
import {
  domainOrderMenu,
  domainQuestion,
  domainsMenu,
  servicesMenu,
} from "@helpers/services-menu";
import {
  depositMenu,
  depositMoneyConversation,
  depositPaymentSystemChoose,
} from "./helpers/deposit-money";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import { startCheckTopUpStatus } from "./api/payment";
import { VMManager } from "./api/vmmanager";
import {
  domainManageServicesMenu,
  manageSerivcesMenu,
} from "./helpers/manage-services";
import prices from "./helpers/prices";
import DomainRequest, { DomainRequestStatus } from "./entities/DomainRequest";
dotenv.config({});

export type MyAppContext = ConversationFlavor<
  Context &
    FluentContextFlavor &
    LazySessionFlavor<SessionData> &
    MenuFlavor & {
      availableLanguages: string[];
      appDataSource: DataSource;
    }
>;

export type MyConversation = Conversation<MyAppContext>;

const mainMenu = new Menu<MyAppContext>("main-menu")
  .submenu(
    (ctx) => ctx.t("button-personal-profile"),
    "profile-menu",
    async (ctx) => {
      const session = await ctx.session;
      if (ctx.hasChatType("private")) {
        await ctx.editMessageText(
          ctx.t("profile", {
            balance: session.main.user.balance,
            id: session.main.user.id,
            name:
              ctx.chat.username ||
              `${ctx.chat.first_name} ${ctx.chat.last_name}`,
          }),
          {
            parse_mode: "HTML",
          }
        );
      }
    }
  )
  .submenu((ctx) => ctx.t("button-change-locale"), "change-locale-menu")
  .row()
  .submenu((ctx) => ctx.t("button-purchase"), "services-menu")
  .submenu((ctx) => ctx.t("button-manage-services"), "manage-services-menu")
  .row()
  .submenu(
    (ctx) => ctx.t("button-support"),
    "support-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("support"), {
        parse_mode: "HTML",
      });
    }
  )
  .submenu(
    (ctx) => ctx.t("button-about-us"),
    "about-us-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("about-us"), {
        parse_mode: "HTML",
      });
    }
  );

const aboutUsMenu = new Menu<MyAppContext>("about-us-menu", {
  autoAnswer: false,
})
  .url((ctx) => ctx.t("button-go-to-site"), process.env.WEBSITE_URL)
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

const supportMenu = new Menu<MyAppContext>("support-menu", {
  autoAnswer: false,
})
  .url(
    (ctx) => ctx.t("button-ask-question"),
    (ctx) =>
      `tg://resolve?domain=${process.env.SUPPORT_USERNAME_TG}&text=${ctx.t(
        "support-message-template"
      )}`
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

const profileMenu = new Menu<MyAppContext>("profile-menu", {})
  .submenu((ctx) => ctx.t("button-deposit"), "deposit-menu")
  .text((ctx) => ctx.t("button-promocode"))
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
      isBanned: boolean;
    };
    lastSumDepositsEntered: number;
  };
  other: {
    controlUsersPage: {
      orderBy: "balance" | "id";
      sortBy: "ASC" | "DESC";
      page: number;
      pickedUserData?: {
        id: number;
      };
    };
    domains: {
      lastPickDomain: string;
      page: number;
    };
  };
}

async function index() {
  const { fluent, availableLocales } = await initFluent();

  const bot = new Bot<MyAppContext>(process.env.BOT_TOKEN, {});

  bot.use(
    session({
      type: "multi",
      other: {
        storage: new MemorySessionStorage<SessionData["other"]>(),
        initial: () => ({
          controlUsersPage: {
            orderBy: "id",
            sortBy: "ASC",
            page: 0,
          },
          domains: {
            lastPickDomain: "",
            page: 0,
          },
        }),
      },
      main: {
        initial: () => ({
          locale: "0",
          user: {
            balance: 0,
            id: 0,
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

  bot.use(async (ctx, next) => {
    const session = await ctx.session;

    if (session.main.locale == "0") {
      session.main.locale = ctx.from?.language_code == "ru" ? "ru" : "en";
    }

    return next();
  });

  // Add the available languages to the context
  bot.use(async (ctx, next) => {
    const session = await ctx.session;

    ctx.availableLanguages = availableLocales;
    ctx.appDataSource = await getAppDataSource();

    if (ctx.hasChatType("private")) {
      let user = await ctx.appDataSource.manager.findOneBy(User, {
        telegramId: ctx.chatId,
      });

      if (!user) {
        const newUser = new User();
        newUser.telegramId = ctx.chatId;

        user = await ctx.appDataSource.manager.save(newUser);
      }

      session.main.user.balance = user.balance;
      session.main.user.id = user.id;
      session.main.user.role = user.role;
      session.main.user.isBanned = user.isBanned;
    }
    return next();
  });

  bot.use(
    useFluent({
      fluent,
      localeNegotiator: async (ctx) => {
        const session = await ctx.session;
        return session.main.locale;
      },
    })
  );

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

  bot.use(conversations());
  bot.use(
    createConversation(depositMoneyConversation, "depositMoneyConversation")
  );
  // bot.use(
  //   createConversation(confirmDomainRegistration, "confirmDomainRegistration")
  // );

  bot.use(promotePermissions());
  bot.use(domainQuestion.middleware());
  bot.use(mainMenu);
  bot.use(domainOrderMenu);

  mainMenu.register(changeLocaleMenu, "main-menu");
  mainMenu.register(aboutUsMenu, "main-menu");
  mainMenu.register(supportMenu, "main-menu");
  mainMenu.register(profileMenu, "main-menu");
  mainMenu.register(servicesMenu, "main-menu");
  mainMenu.register(manageSerivcesMenu, "main-menu");

  manageSerivcesMenu.register(domainManageServicesMenu, "manage-services-menu");
  servicesMenu.register(domainsMenu, "services-menu");
  profileMenu.register(depositMenu, "profile-menu");

  bot.use(controlUser);
  bot.use(controlUsers);

  bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data.startsWith("agree-buy-domain:")) {
      const session = await ctx.session;

      const domain = ctx.callbackQuery.data.split(":")[1];

      const pricesList = await prices();

      const domainExtension = domain.split(
        "."
      )[1] as keyof typeof pricesList.domains;

      // @ts-ignore
      const price = pricesList.domains[`.${domainExtension}`].price;

      if (session.main.user.balance < price) {
        await ctx.answerCallbackQuery(
          ctx.t("money-not-enough", {
            amount: price - session.main.user.balance,
          })
        );
        return;
      }

      const usersRepo = ctx.appDataSource.getRepository(User);
      const domainRequestRepo = ctx.appDataSource.getRepository(DomainRequest);

      const isDomain = await domainRequestRepo.findOneBy({
        domainName: domain.split(".")[0],
        zone: `.${domainExtension}`,
      });

      if (isDomain) {
        if (
          isDomain.status == DomainRequestStatus.Completed ||
          isDomain.status == DomainRequestStatus.InProgress
        ) {
          ctx.answerCallbackQuery(ctx.t("domain-already-pending-registration"));
          return;
        }
      }

      const user = await usersRepo.findOne({
        where: {
          id: session.main.user.id,
        },
      });

      if (!user) {
        return;
      }

      user.balance -= price;

      await usersRepo.save(user);

      const domainRequest = new DomainRequest();

      domainRequest.domainName = domain.split(".")[0];
      domainRequest.zone = `.${domainExtension}`;
      domainRequest.target_user_id = user.id;
      domainRequest.price = price;

      await domainRequestRepo.save(domainRequest);

      ctx.reply(
        ctx.t("domain-registration-in-progress", {
          domain,
        }),
        {
          parse_mode: "HTML",
        }
      );

      const mods = usersRepo.find({
        where: [
          {
            role: Role.Admin,
          },
          {
            role: Role.Moderator,
          },
        ],
      });

      const countRequests = await domainRequestRepo.count({
        where: {
          status: DomainRequestStatus.InProgress,
        },
      });

      (await mods).forEach((user) => {
        ctx.api.sendMessage(
          user.telegramId,
          ctx.t("domain-request-notification", {
            count: countRequests,
          })
        );
      });
    }
  });

  bot.command("start", async (ctx) => {
    await ctx.deleteMessage();

    const session = await ctx.session;

    ctx.reply(
      ctx.t("welcome", {
        balance: session.main.user.balance,
      }),
      {
        reply_markup: mainMenu,
        parse_mode: "HTML",
      }
    );
  });

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

  bot.command("users", async (ctx) => {
    await ctx.deleteMessage();
    const session = await ctx.session;
    if (session.main.user.role == Role.User) return;

    await ctx.reply(ctx.t("control-panel-users"), {
      reply_markup: controlUsers,
      parse_mode: "HTML",
    });
  });

  const run = async () => {
    console.info("[DripHosting Bot]: Starting");
    if (process.env.IS_WEBHOOK && process.env.PORT_WEBHOOK) {
      const app = express();

      app.use(express.json());
      app.use(
        webhookCallback(bot, "express", {
          onTimeout: "return",
        })
      );

      await bot.api.setWebhook(process.env.IS_WEBHOOK);

      app.listen(process.env.PORT_WEBHOOK, () => {});
    } else {
      // Delete webhook anyway in this way :)
      await bot.api.deleteWebhook();

      bot.catch((err) => {
        if (process.env["NODE_ENV"] == "development") {
          console.error(err.name, err.message, err.stack);
        }
      });

      // const vmmanager = new VMManager(
      //   process.env["VMM_EMAIL"],
      //   process.env["VMM_PASSWORD"]
      // );

      grammyRun(bot);
      console.info("[DripHosting Bot]: Started");
    }
  };

  startCheckTopUpStatus(bot);

  await run();
}

index()
  .then()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
