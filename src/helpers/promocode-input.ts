import { getAppDataSource } from "@/database";
import Promo from "@entities/Promo";
import { StatelessQuestion } from "@grammyjs/stateless-question";
import { MyAppContext } from "..";
import User from "@entities/User";

export const promocodeQuestion = new StatelessQuestion<MyAppContext>(
  "promocodeQuestion",
  async (ctx) => {
    const session = await ctx.session;

    const promoInput = ctx.message;

    if (promoInput.text) {
      let input = promoInput.text.trim().toLowerCase();

      const promoRepo = (await getAppDataSource()).getRepository(Promo);
      const usersRepo = (await getAppDataSource()).getRepository(User);

      const promo = await promoRepo.findOneBy({
        code: input,
      });

      if (
        !promo ||
        promo.uses >= promo.maxUses ||
        promo.users.includes(session.main.user.id)
      ) {
        await ctx.reply(ctx.t("promocode-not-found"), {
          parse_mode: "HTML",
        });
        return;
      }

      promo.uses += 1;
      promo.users.push(session.main.user.id);

      const user = await usersRepo.findOneBy({
        id: session.main.user.id,
      });

      if (user) {
        user.balance += promo.sum;

        await usersRepo.save(user);
        await promoRepo.save(promo);

        await ctx.reply(
          ctx.t("promocode-used", {
            amount: promo.sum,
          })
        );
      }
    }
  }
);
