import { Menu } from "@grammyjs/menu";
import { MyAppContext } from "..";
import prices from "@helpers/prices";
import { StatelessQuestion } from "@grammyjs/stateless-question";

import DomainChecker from "@api/domain-checker";
import { escapeUserInput } from "@helpers/formatting";

export const servicesMenu = new Menu<MyAppContext>("services-menu")
  .submenu(
    (ctx) => ctx.t("button-domains"),
    "domains-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("abuse-domains-service"), {
        parse_mode: "HTML",
      });
    }
  )
  .row()
  .text((ctx) => ctx.t("button-dedicated-server"))
  .row()
  .text((ctx) => ctx.t("button-vds"))
  .row()
  .back((ctx) => ctx.t("button-back"));

export const domainsMenu = new Menu<MyAppContext>("domains-menu")
  .dynamic(async (_, range) => {
    const domainZones = (await prices()).domains;
    let count = 0;

    for (const zone in domainZones) {
      range.text(
        `${zone} - ${domainZones[zone as keyof typeof domainZones].price} $`,
        async (ctx) => {
          await domainQuestion.replyWithHTML(
            ctx,
            ctx.t("domain-question", {
              zoneName: zone,
            }),
            zone
          );
        }
      );

      count++;
      if (count % 2 === 0) {
        range.row();
      }
    }

    if (count % 2 !== 0) {
      range.row();
    }
  })
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

export const domainQuestion = new StatelessQuestion<MyAppContext>(
  "domain-pick",
  async (ctx, zone) => {
    if (!ctx.hasChatType("private")) return;
    if (!ctx.message?.text) return;
    const session = await ctx.session;

    const domain = `${ctx.message.text}${zone}`;

    const domainChecker = new DomainChecker();

    const isValid = domainChecker.domainIsValid(domain);

    if (!isValid) {
      ctx.reply(
        ctx.t("domain-invalid", {
          domain: `${escapeUserInput(ctx.message.text)}${zone}`,
        }),
        {
          parse_mode: "HTML",
        }
      );
      return;
    }

    // This code is unreachable
    const isAvailable = await domainChecker.domainIsAvailable(domain);
    if (!isAvailable) return;

    const status = await domainChecker.getStatus(domain);

    if (status === "Available") {
    } else {
      ctx.reply(
        ctx.t("domain-not-available", {
          domain: `${escapeUserInput(ctx.message.text)}${zone}`,
        }),
        {
          parse_mode: "HTML",
        }
      );
    }

    // if (isAvailable) {
    //   ctx.reply(
    //     ctx.t("domain-available", {
    //       domain: `${escapeUserInput(ctx.message.text)}${zone}`,
    //     }),
    //     {
    //       parse_mode: "HTML",
    //     }
    //   );
    //   return;
    // }
  }
);

// Domain Order Stage
export const domainOrderMenu = new Menu<MyAppContext>(
  "domain-order-menu"
).dynamic((ctx, range) => {});
