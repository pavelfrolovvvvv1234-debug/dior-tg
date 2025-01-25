import { Menu } from "@grammyjs/menu";
import { MyAppContext, SessionData } from "..";
import User, { Role } from "@entities/User";

const LIMIT_ON_PAGE = 7;

const sorting = (
  orderBy: SessionData["other"]["controlUsersPage"]["orderBy"],
  sortBy: SessionData["other"]["controlUsersPage"]["sortBy"]
) => {
  switch (orderBy) {
    case "balance":
      return {
        balance: sortBy,
      };
    case "id":
      return {
        id: sortBy,
      };
  }
};

export const controlUsers = new Menu<MyAppContext>("control-users", {})
  .text(
    (ctx) => ctx.t("button-close"),
    async (ctx) => {
      await ctx.deleteMessage();
    }
  )
  .row()
  .text(
    async (ctx) => {
      const session = await ctx.session;
      switch (session.other.controlUsersPage.orderBy) {
        case "balance":
          return ctx.t("sorting-by-balance");
        case "id":
          return ctx.t("sorting-by-id");
      }
    },
    async (ctx) => {
      const session = await ctx.session;
      if (session.other.controlUsersPage.orderBy === "balance") {
        session.other.controlUsersPage.orderBy = "id";
      } else {
        session.other.controlUsersPage.orderBy = "balance";
      }
      ctx.menu.update();
    }
  )
  .text(
    async (ctx) => {
      const session = await ctx.session;
      switch (session.other.controlUsersPage.sortBy) {
        case "ASC":
          return ctx.t("sort-asc");
        case "DESC":
          return ctx.t("sort-desc");
      }
    },
    async (ctx) => {
      const session = await ctx.session;
      if (session.other.controlUsersPage.sortBy === "ASC") {
        session.other.controlUsersPage.sortBy = "DESC";
      } else {
        session.other.controlUsersPage.sortBy = "ASC";
      }
      ctx.menu.update();
    }
  )
  .row()
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;

    if (session.main.user.role != Role.User) {
      const [users, total] = await ctx.appDataSource.manager.findAndCount(
        User,
        {
          where: { role: Role.User },
          order: sorting(
            session.other.controlUsersPage.orderBy,
            session.other.controlUsersPage.sortBy
          ),
          select: ["id", "balance", "createdAt", "telegramId"],
          skip: session.other.controlUsersPage.page * LIMIT_ON_PAGE,
          take: LIMIT_ON_PAGE,
        }
      );

      const maxPages = Math.ceil(total / LIMIT_ON_PAGE) - 1;

      for (const user of users) {
        let username = "";
        try {
          const chat = await ctx.api.getChat(user.telegramId);
          username = chat.username || `${chat.first_name} ${chat.last_name}`;
        } catch (err) {
          username = "Unknown";
        }

        range
          .text(
            `ID: ${username} (${user.id}) - ${user.balance} $`,
            async (ctx) => {
              session.other.controlUsersPage.pickedUserData = {
                id: user.id,
              };

              await ctx.reply(
                ctx.t("control-panel-about-user", {
                  id: user.id,
                  balance: user.balance,
                  username: username,
                  createdAt: user.createdAt,
                }),
                { parse_mode: "HTML", reply_markup: controlUser }
              );
            }
          )
          .row();
      }

      range.text(
        (ctx) => ctx.t("pagination-left"),
        async (ctx) => {
          session.other.controlUsersPage.page--;

          if (session.other.controlUsersPage.page < 0) {
            session.other.controlUsersPage.page = maxPages;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );
      range.text(
        () => `${session.other.controlUsersPage.page + 1}/${maxPages + 1}`
      );
      range.text(
        (ctx) => ctx.t("pagination-right"),
        async (ctx) => {
          session.other.controlUsersPage.page++;

          if (session.other.controlUsersPage.page > maxPages) {
            session.other.controlUsersPage.page = 0;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );
    }
  });

export const controlUser = new Menu<MyAppContext>("control-user", {}).dynamic(
  async (ctx, range) => {
    const session = await ctx.session;

    if (!session.other.controlUsersPage.pickedUserData) return;

    const user = await ctx.appDataSource.manager.findOne(User, {
      where: {
        id: session.other.controlUsersPage.pickedUserData.id,
      },
    });

    if (!user) return;

    range.text(
      (ctx) => (user.isBanned ? ctx.t("unblock-user") : ctx.t("block-user")),
      async (ctx) => {
        user.isBanned = !user.isBanned;
        await ctx.appDataSource.manager.save(user);
        ctx.menu.update();
      }
    );
  }
);
