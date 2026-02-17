import { Menu } from "@grammyjs/menu";
import { mainMenu } from "..";
import type { AppContext, AppConversation } from "../shared/types/context";
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

// Note: amperDomainsMenu will be registered in broadcast-tickets-integration.ts

/**
 * Dedicated server type selection menu (Standard/Bulletproof).
 */
const buildServiceHeader = (ctx: AppContext, labelKey: string): string =>
  `${ctx.t("menu-service-for-buy-choose")}\n\n${ctx.t(labelKey)}`;

/** Apply Prime −20% discount if user has active Prime. */
async function getPriceWithPrimeDiscount(
  dataSource: Awaited<ReturnType<typeof getAppDataSource>>,
  userId: number,
  basePrice: number
): Promise<number> {
  const userRepo = dataSource.getRepository(User);
  const user = await userRepo.findOneBy({ id: userId });
  const hasPrime = user?.primeActiveUntil && new Date(user.primeActiveUntil) > new Date();
  return hasPrime ? Math.round(basePrice * 0.8 * 100) / 100 : basePrice;
}

export const dedicatedTypeMenu = new Menu<AppContext>("dedicated-type-menu")
  .submenu(
    (ctx) => ctx.t("button-standard"),
    "dedicated-servers-menu",
    async (ctx) => {
      const session = await ctx.session;
      if (!session.other.dedicatedType) {
        session.other.dedicatedType = { bulletproof: false, selectedDedicatedId: -1 };
      }
      session.other.dedicatedType.bulletproof = false;
      session.other.dedicatedType.selectedDedicatedId = -1;
      await ctx.editMessageText(buildServiceHeader(ctx, "button-dedicated-server"), {
        parse_mode: "HTML",
      });
    }
  )
  .submenu(
    (ctx) => ctx.t("button-bulletproof"),
    "dedicated-servers-menu",
    async (ctx) => {
      const session = await ctx.session;
      if (!session.other.dedicatedType) {
        session.other.dedicatedType = { bulletproof: true, selectedDedicatedId: -1 };
      }
      session.other.dedicatedType.bulletproof = true;
      session.other.dedicatedType.selectedDedicatedId = -1;
      await ctx.editMessageText(buildServiceHeader(ctx, "button-dedicated-server"), {
        parse_mode: "HTML",
      });
    }
  )
  .row()
  .text((ctx) => ctx.t("button-back"), async (ctx) => {
    await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
      parse_mode: "HTML",
      reply_markup: servicesMenu,
    });
  });

/**
 * VDS type selection menu (Standard/Bulletproof).
 */
export const vdsTypeMenu = new Menu<AppContext>("vds-type-menu")
  .submenu(
    (ctx) => ctx.t("button-standard"),
    "vds-menu",
    async (ctx) => {
      const session = await ctx.session;
      session.other.vdsRate.bulletproof = false;
      await ctx.editMessageText(ctx.t("vds-service"), {
        parse_mode: "HTML",
      });
    }
  )
  .submenu(
    (ctx) => ctx.t("button-bulletproof"),
    "vds-menu",
    async (ctx) => {
      const session = await ctx.session;
      session.other.vdsRate.bulletproof = true;
      await ctx.editMessageText(ctx.t("abuse-vds-service"), {
        parse_mode: "HTML",
      });
    }
  )
  .row()
  .back((ctx) => ctx.t("button-back"), async (ctx) => {
    await ctx.editMessageText(buildServiceHeader(ctx, "button-vds"), {
      parse_mode: "HTML",
    });
  });

export const servicesMenu = new Menu<AppContext>("services-menu")
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
  ctx: AppContext,
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

  const basePrice = bulletproof ? rate.price.bulletproof : rate.price.default;
  const price = await getPriceWithPrimeDiscount(appDataSource, userId, basePrice);

  // Remember this thing
  const generatedPassword = generatePassword(12);

  if (user.balance - price < 0) {
    await ctx.reply(
      ctx.t("money-not-enough", {
        amount: price - user.balance,
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
  newVds.renewalPrice = price;

  await vdsRepo.save(newVds);

  user.balance -= price;

  await usersRepo.save(user);

  ctx.reply(ctx.t("vds-created"), {
    reply_markup: mainMenu,
  });
}

export const vdsRateOs = new Menu<AppContext>("vds-select-os").dynamic(
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

export const vdsRateChoose = new Menu<AppContext>("vds-selected-rate", {
  onMenuOutdated: (ctx) => {
    ctx.deleteMessage().then();
  },
})
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
          const dataSource = await getAppDataSource();
          const basePrice = session.other.vdsRate.bulletproof
            ? rate.price.bulletproof
            : rate.price.default;
          const price = await getPriceWithPrimeDiscount(dataSource, session.main.user.id, basePrice);

          if (session.main.user.balance < price) {
            ctx.reply(
              ctx.t("money-not-enough", {
                amount: price - session.main.user.balance,
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
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    (ctx) => {
      ctx.editMessageText(ctx.t("vds-service"), {
        parse_mode: "HTML",
      });
    }
  );

const editMessageVdsRate = async (ctx: AppContext, rateId: number) => {
  const pricesList = await prices();
  const session = await ctx.session;
  const rate = pricesList.virtual_vds[rateId];
  const basePrice =
    session.other.vdsRate.bulletproof == true
      ? rate.price.bulletproof
      : rate.price.default;
  const dataSource = await getAppDataSource();
  const price = await getPriceWithPrimeDiscount(
    dataSource,
    session.main.user.id,
    basePrice
  );

  await ctx.editMessageText(
    ctx.t("vds-rate-full-view", {
      rateName: rate.name,
      price,
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

export const vdsMenu = new Menu<AppContext>("vds-menu")
  .dynamic(async (ctx, range) => {
    const pricesList = await prices();
    const session = await ctx.session;
    const dataSource = await getAppDataSource();

    for (let id = 0; id < pricesList.virtual_vds.length; id++) {
      const rate = pricesList.virtual_vds[id];
      const basePrice =
        session.other.vdsRate.bulletproof == true
          ? rate.price.bulletproof
          : rate.price.default;
      const price = await getPriceWithPrimeDiscount(
        dataSource,
        session.main.user.id,
        basePrice
      );
      range
        .submenu(
          {
            text: ctx.t("vds-rate", {
              rateName: rate.name,
              price,
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
    }
  })
  .row()
  .text(
    (ctx) => ctx.t("prime-discount-vds"),
    async (ctx) => {
      try {
        const { getDomainsListWithPrimeScreen } = await import("../ui/menus/amper-domains-menu.js");
        const { fullText, keyboard } = await getDomainsListWithPrimeScreen(ctx as any, {
          backCallback: "prime-back-to-vds-menu",
        });
        await ctx.editMessageText(fullText, { reply_markup: keyboard, parse_mode: "HTML" });
      } catch (e: any) {
        await ctx.editMessageText(ctx.t("error-unknown", { error: e?.message || "Error" })).catch(() => {});
      }
    }
  )
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
        parse_mode: "HTML",
      });
    }
  );

/**
 * Dedicated servers list menu (shows after selecting Standard/Bulletproof).
 */
export const dedicatedServersMenu = new Menu<AppContext>("dedicated-servers-menu")
  .dynamic(async (ctx, range) => {
    const pricesList = await prices();
    const session = await ctx.session;

    if (!pricesList.dedicated_servers || pricesList.dedicated_servers.length === 0) {
      range.text(ctx.t("button-back"), async (ctx) => {
        await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
          parse_mode: "HTML",
        });
      });
      return;
    }

    const isBulletproof = session.other.dedicatedType?.bulletproof || false;
    
    // Filter servers: if bulletproof, show only servers with bulletproof price
    // Create array of indices that should be shown
    const serverIndices: number[] = [];
    pricesList.dedicated_servers.forEach((server, id) => {
      if (!isBulletproof || (isBulletproof && server.price.bulletproof !== undefined)) {
        serverIndices.push(id);
      }
    });

    if (serverIndices.length === 0) {
      range.text(ctx.t("button-back"), async (ctx) => {
        const session = await ctx.session;
        const isBulletproof = session.other.dedicatedType?.bulletproof || false;
        await ctx.editMessageText(
          isBulletproof ? ctx.t("abuse-dedicated-server") : ctx.t("dedicated-server"),
          {
            parse_mode: "HTML",
          }
        );
      });
      return;
    }

    const dataSource = await getAppDataSource();
    const userId = session.main.user.id;

    for (const id of serverIndices) {
      const server = pricesList.dedicated_servers[id];
      const basePrice =
        isBulletproof && server.price.bulletproof
          ? server.price.bulletproof
          : server.price.default;
      const price = await getPriceWithPrimeDiscount(dataSource, userId, basePrice);

      range
        .submenu(
          {
            text: ctx.t("dedicated-rate", {
              rateName: server.name,
              price,
              cpu: server.cpu,
              cpuThreads: server.cpuThreads,
              ram: server.ram,
              storage: server.storage,
            }),
            payload: id.toString(),
          },
          "dedicated-selected-server",
          async (ctx) => {
            const session = await ctx.session;
            session.other.dedicatedType.selectedDedicatedId = id;
            await editMessageDedicatedServer(ctx, id);
          }
        )
        .row();
    }

    range
      .row()
      .text(
        (ctx) => ctx.t("prime-discount-dedicated"),
        async (ctx) => {
          try {
            const { getDomainsListWithPrimeScreen } = await import("../ui/menus/amper-domains-menu.js");
            const { fullText, keyboard } = await getDomainsListWithPrimeScreen(ctx as any, {
              backCallback: "prime-back-to-dedicated-servers",
            });
            await ctx.editMessageText(fullText, { reply_markup: keyboard, parse_mode: "HTML" });
          } catch (e: any) {
            await ctx.editMessageText(ctx.t("error-unknown", { error: e?.message || "Error" })).catch(() => {});
          }
        }
      )
      .row()
      .text(
        (ctx) => ctx.t("button-back"),
        async (ctx) => {
          await ctx.editMessageText(buildServiceHeader(ctx, "button-dedicated-server"), {
            parse_mode: "HTML",
            reply_markup: dedicatedTypeMenu,
          });
        }
      );
  });

/**
 * Function to edit message with dedicated server details.
 */
const editMessageDedicatedServer = async (ctx: AppContext, serverId: number) => {
  const pricesList = await prices();
  const session = await ctx.session;
  const server = pricesList.dedicated_servers[serverId];

  if (!server) {
    await ctx.editMessageText(ctx.t("error-unknown", { error: "Server not found" }));
    return;
  }

  const isBulletproof = session.other.dedicatedType?.bulletproof || false;
  const basePrice =
    isBulletproof && server.price.bulletproof
      ? server.price.bulletproof
      : server.price.default;
  const dataSource = await getAppDataSource();
  const price = await getPriceWithPrimeDiscount(
    dataSource,
    session.main.user.id,
    basePrice
  );

  await ctx.editMessageText(
    ctx.t("dedicated-rate-full-view", {
      rateName: server.name,
      price,
      cpu: server.cpu,
      cpuThreads: server.cpuThreads,
      ram: server.ram,
      storage: server.storage,
      network: server.network,
      bandwidth: server.bandwidth === "unlimited" ? ctx.t("unlimited") : server.bandwidth,
      os: server.os,
      abuse: isBulletproof
        ? ctx.t("bulletproof-on")
        : ctx.t("bulletproof-off"),
    }),
    {
      parse_mode: "HTML",
    }
  );
};

/**
 * Dedicated server detail menu (shows server info with Order button).
 */
export const dedicatedSelectedServerMenu = new Menu<AppContext>("dedicated-selected-server", {
  onMenuOutdated: (ctx) => {
    ctx.deleteMessage().then();
  },
})
  .row()
  .text(
    (ctx) => ctx.t("button-order-dedicated"),
    async (ctx) => {
      try {
        await ctx.answerCallbackQuery().catch(() => {});
        const session = await ctx.session;
        const selectedId = session.other.dedicatedType?.selectedDedicatedId ?? -1;
        if (selectedId < 0) {
          await ctx.reply(ctx.t("bad-error"));
          return;
        }

        const pricesList = await prices();
        const server = pricesList.dedicated_servers?.[selectedId];
        if (!server) {
          await ctx.reply(ctx.t("bad-error"));
          return;
        }

        const isBulletproof = session.other.dedicatedType?.bulletproof || false;
        const basePrice = isBulletproof && server.price.bulletproof
          ? server.price.bulletproof
          : server.price.default;

        const dataSource = await getAppDataSource();
        const usersRepo = dataSource.getRepository(User);
        const user = await usersRepo.findOneBy({ id: session.main.user.id });
        if (!user) {
          await ctx.reply(ctx.t("bad-error"));
          return;
        }

        const price = await getPriceWithPrimeDiscount(dataSource, user.id, basePrice);

        if (user.balance < price) {
          await ctx.reply(
            ctx.t("money-not-enough", {
              amount: price - user.balance,
            })
          );
          return;
        }

        user.balance -= price;
        await usersRepo.save(user);
        session.main.user.balance = user.balance;
        session.main.user.referralBalance = user.referralBalance ?? 0;

        session.other.dedicatedOrder = {
          step: "idle",
          requirements: undefined,
        };
        const keyboard = new InlineKeyboard()
          .url(ctx.t("button-support"), "tg://resolve?domain=diorhost");
        await ctx.reply(ctx.t("dedicated-purchase-success"), {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      } catch (error: any) {
        const { Logger } = await import("../app/logger.js");
        Logger.error("Failed to start order dedicated conversation:", error);
        await ctx.editMessageText(ctx.t("error-unknown", { error: error.message || "Unknown error" }));
      }
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      await ctx.editMessageText(buildServiceHeader(ctx, "button-dedicated-server"), {
        parse_mode: "HTML",
        reply_markup: dedicatedServersMenu,
      });
    }
  );

export const domainsMenu = new Menu<AppContext>("domains-menu")
  .text(
    (ctx) => ctx.t("button-register-domain"),
    async (ctx) => {
      try {
        await ctx.conversation.enter("domainRegisterConversation");
      } catch (error: any) {
        console.error("Failed to start domain register conversation:", error);
        await ctx.reply(ctx.t("error-unknown", { error: error.message || "Unknown error" }));
      }
    }
  )
  .text(
    (ctx) => ctx.t("button-my-domains"),
    async (ctx) => {
      // Navigate to amper domains menu
      ctx.menu.nav("amper-domains-menu");
    }
  )
  .row()
  .dynamic(async (ctx, range) => {
    const dataSource = await getAppDataSource();
    const userId = (await ctx.session)?.main?.user?.id;
    const domainZones = (await prices()).domains;
    let count = 0;

    for (const zone in domainZones) {
      const basePrice = domainZones[zone as keyof typeof domainZones].price;
      const price =
        userId != null
          ? await getPriceWithPrimeDiscount(dataSource, userId, basePrice)
          : basePrice;

      range.text(
        `${zone} - ${price} $`,
        async (ctx) => {
          const session = await ctx.session;
          const ds = await getAppDataSource();
          const priceForCheck = await getPriceWithPrimeDiscount(
            ds,
            session.main.user.id,
            basePrice
          );
          if (session.main.user.balance < priceForCheck) {
            await ctx.reply(
              ctx.t("money-not-enough", {
                amount: priceForCheck - session.main.user.balance,
              })
            );
            return;
          }
          session.other.domains.pendingZone = zone;
          await ctx.reply(
            ctx.t("domain-question", {
              zoneName: zone,
            }),
            {
              reply_markup: new InlineKeyboard().text(
                ctx.t("button-cancel"),
                "domain-register-cancel"
              ),
              parse_mode: "HTML",
            }
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
  .row()
  .text(
    (ctx) => ctx.t("prime-button-menu-row"),
    async (ctx) => {
      try {
        const { getDomainsListWithPrimeScreen } = await import("../ui/menus/amper-domains-menu.js");
        const { fullText, keyboard } = await getDomainsListWithPrimeScreen(ctx, {
          backCallback: "prime-back-to-domains-zones",
        });
        await ctx.editMessageText(fullText, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      } catch (error: any) {
        const { Logger } = await import("../app/logger.js");
        Logger.error("Failed to open Prime screen from domains menu:", error);
        await ctx.editMessageText(ctx.t("error-unknown", { error: error.message || "Unknown error" }));
      }
    }
  )
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
        parse_mode: "HTML",
      });
    }
  );

export const domainQuestion = new StatelessQuestion<AppContext>(
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
export const domainOrderMenu = new Menu<AppContext>(
  "domain-order-menu"
).dynamic((ctx, range) => {});
