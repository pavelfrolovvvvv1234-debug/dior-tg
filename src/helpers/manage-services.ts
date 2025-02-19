import { Menu } from "@grammyjs/menu";
import { MyAppContext } from "..";
import DomainRequest, { DomainRequestStatus } from "@/entities/DomainRequest";
import { getAppDataSource } from "@/database";
import { InlineKeyboard } from "grammy";

export const manageSerivcesMenu = new Menu<MyAppContext>("manage-services-menu")
  .submenu(
    (ctx) => ctx.t("button-domains"),
    "domain-manage-services-menu",
    (ctx) => {
      ctx.editMessageText(ctx.t("domains-manage"), {
        parse_mode: "HTML",
      });
    }
  )
  .row()
  .text((ctx) => ctx.t("button-dedicated-server"))
  .row()
  .text((ctx) => ctx.t("button-vds"))
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;

      ctx.editMessageText(
        ctx.t("welcome", { balance: session.main.user.balance }),
        {
          parse_mode: "HTML",
        }
      );
    }
  );

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

export const domainManageServicesMenu = new Menu<MyAppContext>(
  "domain-manage-services-menu"
)
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;

    const domainRequestRepo = ctx.appDataSource.getRepository(DomainRequest);

    const [domainRequests, total] = await domainRequestRepo.findAndCount({
      where: [
        {
          target_user_id: session.main.user.id,
          status: DomainRequestStatus.InProgress,
        },
        {
          target_user_id: session.main.user.id,
          status: DomainRequestStatus.Completed,
        },
      ],
      take: LIMIT_ON_PAGE,
      skip: session.other.domains.page * LIMIT_ON_PAGE,
    });

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
                  `tg://resolve?domain=${
                    process.env.SUPPORT_USERNAME_TG
                  }&text=${ctx.t("support-message-template")}`
                ),
              }
            );
          }
        )
        .row();
    }

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
  })
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;

      ctx.editMessageText(
        ctx.t("manage-services-header", {
          balance: session.main.user.balance,
        }),
        {
          parse_mode: "HTML",
        }
      );
    }
  );
