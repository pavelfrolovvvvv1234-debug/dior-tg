import { Menu } from "@grammyjs/menu";
import { mainMenu, MyAppContext, MyConversation } from "..";
import prices from "@helpers/prices";
import { StatelessQuestion } from "@grammyjs/stateless-question";

import DomainChecker from "@api/domain-checker";
import { escapeUserInput } from "@helpers/formatting";
import { InlineKeyboard } from "grammy";
import { getAppDataSource } from "@/database";
import User from "@/entities/User";
import VirtualDedicatedServer, {
  generatePassword,
  generateRandomName,
} from "@/entities/VirtualDedicatedServer";
import ms from "@/lib/multims";

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
  .text(
    (ctx) => ctx.t("button-dedicated-server"),
    (ctx) => {
      ctx.reply(ctx.t("dedicated-servers"), {
        reply_markup: new InlineKeyboard().url(
          ctx.t("button-tp"),
          `tg://resolve?domain=${process.env.SUPPORT_USERNAME_TG}`
        ),
      });
    }
  )
  .row()
  .submenu(
    (ctx) => ctx.t("button-vds"),
    "vds-menu",
    (ctx) => {
      ctx.editMessageText(ctx.t("vds-service"), {
        parse_mode: "HTML",
      });
    }
  )
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

async function createAndBuyVDS(
  ctx: MyAppContext,
  osId: number,
  rateId: number,
  userId: number,
  bulletproof: boolean
) {
  const pricesList = await prices();

  const rate = pricesList.virtual_vds[rateId];

  console.log(osId);

  if (!rate) {
    await ctx.reply(ctx.t("bad-error"));
    return;
  }

  const appDataSource = await getAppDataSource();

  const usersRepo = appDataSource.getRepository(User);
  const vdsRepo = appDataSource.getRepository(VirtualDedicatedServer);

  const user = await usersRepo.findOneBy({
    id: userId,
  });

  if (!user) {
    await ctx.reply(ctx.t("bad-error"));
    return "user-not-found" as const;
  }

  const ratePrice = () =>
    bulletproof ? rate.price.bulletproof : rate.price.default;

  // Remember this thing
  const generatedPassword = generatePassword(12);

  if (user.balance - ratePrice() < 0) {
    await ctx.reply(
      ctx.t("money-not-enough", {
        amount: ratePrice() - user.balance,
      })
    );
    return "money-not-enough" as const;
  }

  const newVds = new VirtualDedicatedServer();

  let result;

  while (result == undefined) {
    result = await ctx.vmmanager.createVM(
      generateRandomName(13),
      generatedPassword,
      rate.cpu,
      rate.ram,
      osId,
      `UserID:${userId},${rate.name}`,
      rate.ssd,
      1,
      rate.network,
      rate.network
    );
  }

  if (result == false) {
    ctx.reply(ctx.t("bad-error"));
    return "error-when-creating" as const;
  }

  let info;
  while (info == undefined) {
    info = await ctx.vmmanager.getInfoVM(result.id);
  }

  newVds.vdsId = result.id;
  newVds.cpuCount = rate.cpu;
  newVds.diskSize = rate.ssd;
  newVds.rateName = rate.name;
  newVds.expireAt = new Date(Date.now() + ms("30d"));
  newVds.ramSize = rate.ram;
  newVds.lastOsId = osId;
  newVds.password = generatedPassword;
  newVds.networkSpeed = rate.network;
  newVds.targetUserId = userId;
  newVds.isBulletproof = bulletproof;

  let ipv4Addrs;

  while (ipv4Addrs == undefined) {
    ipv4Addrs = await ctx.vmmanager.getIpv4AddrVM(result.id);
  }

  newVds.ipv4Addr = ipv4Addrs.list[0].ip_addr;
  newVds.renewalPrice = ratePrice();

  await vdsRepo.save(newVds);

  user.balance -= ratePrice();

  await usersRepo.save(user);

  ctx.reply(ctx.t("vds-created"), {
    reply_markup: mainMenu,
  });
}

export const vdsRateOs = new Menu<MyAppContext>("vds-select-os").dynamic(
  async (ctx, range) => {
    const session = await ctx.session;

    const osList = ctx.osList;

    if (!osList) {
      ctx.reply(ctx.t("bad-error"));
      return;
    }

    if (session.other.vdsRate.selectedOs != -1) {
      range.text(ctx.t("vds-select-os-next"), async (ctx) => {
        const session = await ctx.session;

        ctx.menu.close();
        ctx.editMessageText(ctx.t("await-please"));

        const result = await createAndBuyVDS(
          ctx,
          session.other.vdsRate.selectedOs,
          session.other.vdsRate.selectedRateId,
          session.main.user.id,
          session.other.vdsRate.bulletproof
        );

        session.other.vdsRate.selectedOs = -1;

        await ctx.deleteMessage();
      });

      range.text(ctx.t("button-back"), async (ctx) => {
        const session = await ctx.session;

        session.other.vdsRate.selectedOs = -1;

        await ctx.editMessageText(ctx.t("vds-os-select"), {
          parse_mode: "HTML",
        });

        // ctx.menu.update();
      });
      return;
    }

    let count = 0;
    osList.list
      .filter(
        (os) =>
          !os.adminonly &&
          os.name != "NoOS" &&
          os.state == "active" &&
          os.repository != "ISPsystem LXD"
      )
      .forEach((os) => {
        range.text(`${os.name}`, async (ctx) => {
          const session = await ctx.session;

          // console.log(`${os.name} : ${os.id}`);

          session.other.vdsRate.selectedOs = os.id;

          await ctx.editMessageText(
            ctx.t("vds-select-os-confirm", {
              osName: os.name,
            })
          );

          // ctx.menu.update();
          // Run function for create VM and buy it
        });

        count++;
        if (count % 2 === 0) {
          range.row();
        }
      });

    if (count % 2 !== 0) {
      range.row();
    }

    range.back(
      {
        text: (ctx) => ctx.t("button-back"),
        payload: session.other.vdsRate.selectedRateId.toString(),
      },
      async (ctx) => {
        if (ctx.match == "-1") {
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
          return;
        }
        await editMessageVdsRate(ctx, Number(ctx.match));
      }
    );
  }
);

export const vdsRateChoose = new Menu<MyAppContext>("vds-selected-rate", {
  onMenuOutdated: (ctx) => {
    ctx.deleteMessage().then();
  },
})
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;

    if (session.other.vdsRate.bulletproof) {
      range.text(
        {
          text: ctx.t("vds-bulletproof-mode-button-off"),
          payload: session.other.vdsRate.selectedRateId.toString(),
        },
        async (ctx) => {
          const session = await ctx.session;

          if (ctx.match == "-1") {
            ctx.menu.nav("vds-menu");
            return;
          }

          session.other.vdsRate.bulletproof = false;

          await editMessageVdsRate(ctx, Number(ctx.match));
          // await ctx.menu.update();
        }
      );
    } else {
      range.text(
        {
          text: ctx.t("vds-bulletproof-mode-button-on"),
          payload: session.other.vdsRate.selectedRateId.toString(),
        },
        async (ctx) => {
          const session = await ctx.session;

          if (ctx.match == "-1") {
            ctx.menu.nav("vds-menu");
            return;
          }

          session.other.vdsRate.bulletproof = true;

          await editMessageVdsRate(ctx, Number(ctx.match));
          // await ctx.menu.update();
        }
      );
    }
  })
  .row()
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;

    range.submenu(
      {
        text: ctx.t("button-buy"),
        payload: session.other.vdsRate.selectedRateId.toString(),
      },
      "vds-select-os",
      async (ctx) => {
        if (ctx.match == "-1") {
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
          return;
        }

        const session = await ctx.session;
        const pricesList = await prices();

        const rate = pricesList.virtual_vds[Number(ctx.match)];

        if (rate) {
          if (
            session.main.user.balance <
            (session.other.vdsRate.bulletproof
              ? rate.price.bulletproof
              : rate.price.default)
          ) {
            ctx.reply(
              ctx.t("money-not-enough", {
                amount:
                  (session.other.vdsRate.bulletproof
                    ? rate.price.bulletproof
                    : rate.price.default) - session.main.user.balance,
              })
            );
            // await ctx.deleteMessage();
            await ctx.menu.close();
            await ctx.reply(
              ctx.t("welcome", {
                balance: session.main.user.balance,
              }),
              {
                reply_markup: mainMenu,
                parse_mode: "HTML",
              }
            );

            return;
          }
        } else {
          ctx.menu.close();
          return;
        }

        session.other.vdsRate.selectedRateId = Number(ctx.match);

        ctx.editMessageText(ctx.t("vds-os-select"), {
          parse_mode: "HTML",
        });
      }
    );
  })
  .back(
    (ctx) => ctx.t("button-back"),
    (ctx) => {
      ctx.editMessageText(ctx.t("vds-service"), {
        parse_mode: "HTML",
      });
    }
  );

const editMessageVdsRate = async (ctx: MyAppContext, rateId: number) => {
  const pricesList = await prices();
  const session = await ctx.session;
  const rate = pricesList.virtual_vds[rateId];

  await ctx.editMessageText(
    ctx.t("vds-rate-full-view", {
      rateName: rate.name,
      price:
        session.other.vdsRate.bulletproof == true
          ? rate.price.bulletproof
          : rate.price.default,
      ram: rate.ram,
      disk: rate.ssd,
      cpu: rate.cpu,
      network: rate.network,
      abuse:
        session.other.vdsRate.bulletproof == true
          ? ctx.t("bulletproof-on")
          : ctx.t("bulletproof-off"),
    }),
    {
      parse_mode: "HTML",
    }
  );
};

export const vdsMenu = new Menu<MyAppContext>("vds-menu")
  .dynamic(async (ctx, range) => {
    const pricesList = await prices();
    const session = await ctx.session;

    pricesList.virtual_vds.forEach((rate, id) => {
      range
        .submenu(
          {
            text: ctx.t("vds-rate", {
              rateName: rate.name,
              price:
                session.other.vdsRate.bulletproof == true
                  ? rate.price.bulletproof
                  : rate.price.default,
              ram: rate.ram,
              disk: rate.ssd,
              cpu: rate.cpu,
            }),
            payload: id.toString(),
          },
          "vds-selected-rate",
          async (ctx) => {
            session.other.vdsRate.selectedRateId = Number(ctx.match);

            await editMessageVdsRate(ctx, id);
          }
        )
        .row();
    });

    if (session.other.vdsRate.bulletproof) {
      range.text(
        {
          text: ctx.t("vds-bulletproof-mode-button-off"),
          payload: session.other.vdsRate.selectedRateId.toString(),
        },
        async (ctx) => {
          const session = await ctx.session;

          session.other.vdsRate.bulletproof = false;

          // await editMessageVdsRate(ctx, Number(ctx.match));
          await ctx.menu.update();
        }
      );
    } else {
      range.text(
        {
          text: ctx.t("vds-bulletproof-mode-button-on"),
          payload: session.other.vdsRate.selectedRateId.toString(),
        },
        async (ctx) => {
          const session = await ctx.session;

          session.other.vdsRate.bulletproof = true;

          // await editMessageVdsRate(ctx, Number(ctx.match));
          await ctx.menu.update();
        }
      );
    }
  })
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
        parse_mode: "HTML",
      });
    }
  );

export const domainsMenu = new Menu<MyAppContext>("domains-menu")
  .dynamic(async (_, range) => {
    const domainZones = (await prices()).domains;
    let count = 0;

    for (const zone in domainZones) {
      range.text(
        `${zone} - ${domainZones[zone as keyof typeof domainZones].price} $`,
        async (ctx) => {
          const session = await ctx.session;
          if (
            session.main.user.balance <
            domainZones[zone as keyof typeof domainZones].price
          ) {
            await ctx.reply(
              ctx.t("money-not-enough", {
                amount:
                  domainZones[zone as keyof typeof domainZones].price -
                  session.main.user.balance,
              })
            );
            return;
          }
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
      await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
        parse_mode: "HTML",
      });
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
      await domainQuestion.replyWithHTML(
        ctx,
        ctx.t("domain-invalid", {
          domain: `${escapeUserInput(ctx.message.text)}${zone}`,
        }),
        zone
      );
      return;
    }

    // This code is unreachable
    const isAvailable = await domainChecker.domainIsAvailable(domain);
    if (!isAvailable) return;

    const status = await domainChecker.getStatus(domain);

    if (status === "Available") {
      session.other.domains.lastPickDomain = domain;

      ctx.reply(
        ctx.t("domain-available", {
          domain: `${escapeUserInput(domain)}`,
        }),
        {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text(
            ctx.t("button-agree"),
            "agree-buy-domain:" + domain
          ),
        }
      );
    } else {
      // Ask user again
      await domainQuestion.replyWithHTML(
        ctx,
        ctx.t("domain-not-available", {
          domain: `${escapeUserInput(ctx.message.text)}${zone}`,
        }),
        zone
      );
      // ctx.reply(
      //   ctx.t("domain-not-available", {
      //     domain: `${escapeUserInput(ctx.message.text)}${zone}`,
      //   }),
      //   {
      //     parse_mode: "HTML",
      //   }
      // );
    }
  }
);

// Domain Order Stage
export const domainOrderMenu = new Menu<MyAppContext>(
  "domain-order-menu"
).dynamic((ctx, range) => {});
