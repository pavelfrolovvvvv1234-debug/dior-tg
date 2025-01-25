import {
  Bot,
  Context,
  InlineKeyboard,
  LazySessionFlavor,
  MemorySessionStorage,
  session,
} from "grammy";
import dotenv from "dotenv";
import { FluentContextFlavor, useFluent } from "@grammyjs/fluent";
import { initFluent } from "./fluent";
import { FileAdapter } from "@grammyjs/storage-file";
import { Menu, MenuFlavor } from "@grammyjs/menu";
import { DataSource } from "typeorm";
import { getAppDataSource } from "./database";
import User, { Role } from "@entities/User";
import { createLink } from "@entities/TempLink";
import {
  PREFIX_PROMOTE,
  promotePermissions,
} from "./helpers/promote-permissions";
import { controlUser, controlUsers } from "./helpers/users-control";

dotenv.config({});

export type MyAppContext = Context &
  FluentContextFlavor &
  LazySessionFlavor<SessionData> &
  MenuFlavor & {
    availableLanguages: string[];
    appDataSource: DataSource;
  };

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
  .text((ctx) => ctx.t("button-purchase"))
  .text((ctx) => ctx.t("button-manage-services"))
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
  .text((ctx) => ctx.t("button-user-agreement"))
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
  .text((ctx) => ctx.t("button-deposit"))
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
    };
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
  };
}

async function index() {
  const { fluent, availableLocales } = await initFluent();

  const bot = new Bot<MyAppContext>(process.env.BOT_TOKEN);

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
        }),
      },
      main: {
        initial: () => ({
          locale: "0",
          user: {
            balance: 0,
            id: 0,
            role: Role.User,
          },
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

      if (user.isBanned) {
        await ctx.deleteMessage();
        return;
      }

      session.main.user.balance = user.balance;
      session.main.user.id = user.id;
      session.main.user.role = user.role;
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

  bot.use(promotePermissions());
  bot.use(mainMenu);

  mainMenu.register(changeLocaleMenu, "main-menu");
  mainMenu.register(aboutUsMenu, "main-menu");
  mainMenu.register(supportMenu, "main-menu");
  mainMenu.register(profileMenu, "main-menu");

  bot.use(controlUser);
  bot.use(controlUsers);

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
    ctx.deleteMessage();
    const session = await ctx.session;
    if (session.main.user.role == Role.User) return;

    await ctx.reply(ctx.t("control-panel-users"), {
      reply_markup: controlUsers,
      parse_mode: "HTML",
    });
  });

  bot.catch((err) => {
    console.error(err);
  });

  await bot.start();
}

index()
  .then()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
