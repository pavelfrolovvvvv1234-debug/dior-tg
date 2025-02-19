import DomainRequest, { DomainRequestStatus } from "@entities/DomainRequest";
import User, { Role } from "@entities/User";
import { Bot, Api, RawApi } from "grammy";
import { MyAppContext } from "..";
import prices from "./prices";
import { StatelessQuestion } from "@grammyjs/stateless-question";
import { escapeUserInput } from "@helpers/formatting";

export function registerDomainRegistrationMiddleware(
  bot: Bot<MyAppContext, Api<RawApi>>
) {
  const additionalInformationQuestion = new StatelessQuestion<MyAppContext>(
    "add-info",
    async (ctx, domain) => {
      if (!ctx.message.text) {
        await additionalInformationQuestion.replyWithHTML(
          ctx,
          ctx.t("domain-registration-complete")
        );

        return;
      }

      const userInput = escapeUserInput(ctx.message.text);

      if (userInput.length > 100) {
        await additionalInformationQuestion.replyWithHTML(
          ctx,
          ctx.t("domain-registration-complete-fail-message-length")
        );
      }

      const session = await ctx.session;

      const pricesList = await prices();
      const domainExtension = domain.split(
        "."
      )[1] as keyof typeof pricesList.domains;

      // @ts-ignore
      const price = pricesList.domains[`.${domainExtension}`].price;

      const usersRepo = ctx.appDataSource.getRepository(User);
      const domainRequestRepo = ctx.appDataSource.getRepository(DomainRequest);

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
      domainRequest.additionalInformation = userInput;

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
  );

  bot.use(additionalInformationQuestion.middleware());

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

      await additionalInformationQuestion.replyWithHTML(
        ctx,
        ctx.t("domain-registration-complete"),
        domain
      );
    }
  });
}
