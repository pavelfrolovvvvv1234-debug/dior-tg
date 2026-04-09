import { Menu } from "@grammyjs/menu";
import { mainMenu } from "..";
import type { AppContext, AppConversation } from "../shared/types/context";
import prices from "@helpers/prices";
import { StatelessQuestion } from "@grammyjs/stateless-question";

import DomainChecker from "@api/domain-checker";
import { escapeUserInput } from "@helpers/formatting";
import { InlineKeyboard } from "grammy";
import { getAppDataSource } from "../infrastructure/db/datasource.js";
import User, { Role } from "@/entities/User";
import VirtualDedicatedServer, {
  generatePassword,
  generateRandomName,
} from "@/entities/VirtualDedicatedServer";
import ms from "@/lib/multims";
import { showTopupForMissingAmount } from "@helpers/deposit-money";
import { cdnMenu } from "../ui/menus/cdn-menu.js";
import { createInitialOtherSession } from "../shared/session-initial.js";
import { showVpsVdsInServiceMenus } from "../app/config.js";
import { DedicatedProvisioningService } from "../domain/dedicated/DedicatedProvisioningService.js";
import { DedicatedOrderPaymentStatus } from "../entities/DedicatedServerOrder.js";
import { getModeratorChatId } from "../shared/moderator-chat.js";
import { UserRepository } from "../infrastructure/db/repositories/UserRepository.js";
import { invalidateUser } from "../shared/user-cache.js";

const renderMultiline = (text: string): string => text.replace(/\\n/g, "\n");

// Note: amperDomainsMenu will be registered in broadcast-tickets-integration.ts

/**
 * Dedicated server type selection menu (Standard/Bulletproof).
 */
const buildServiceHeader = (ctx: AppContext, labelKey: string): string =>
  `${ctx.t("menu-service-for-buy-choose")}\n\n${ctx.t(labelKey)}`;

/** Location key suffixes for dedicated order (FTL: dedicated-location-{key}). Table: Germany, NL/USA/Turkey. */
const DEDICATED_LOCATION_KEYS = [
  "de-germany",
  "nl-amsterdam",
  "usa",
  "tr-istanbul",
] as const;

/** OS key suffixes for dedicated order (FTL: dedicated-os-{key}). Win Server 2019/2025, Win11, Alma 8/9, CentOS 9, Debian 11/12/13, Ubuntu 22/24. */
const DEDICATED_OS_KEYS = [
  "winserver2019",
  "winserver2025",
  "windows11",
  "alma8",
  "alma9",
  "centos9",
  "debian11",
  "debian12",
  "debian13",
  "ubuntu2204",
  "ubuntu2404",
] as const;

/** Apply Prime −10% discount if user has active Prime. */
async function getPriceWithPrimeDiscount(
  dataSource: AppContext["appDataSource"],
  userId: number,
  basePrice: number
): Promise<number> {
  const userRepo = dataSource.getRepository(User);
  const user = await userRepo.findOneBy({ id: userId });
  const hasPrime = user?.primeActiveUntil && new Date(user.primeActiveUntil) > new Date();
  return hasPrime ? Math.round(basePrice * 0.9 * 100) / 100 : basePrice;
}

export const dedicatedTypeMenu = new Menu<AppContext>("dedicated-type-menu", { autoAnswer: false, onMenuOutdated: false })
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
export const vdsTypeMenu = new Menu<AppContext>("vds-type-menu", { autoAnswer: false, onMenuOutdated: false })
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

async function openDomainsPurchaseScreen(ctx: AppContext): Promise<void> {
  await ctx.editMessageText(ctx.t("abuse-domains-service"), {
    parse_mode: "HTML",
  });
}

async function openDedicatedCategoryScreen(ctx: AppContext): Promise<void> {
  await ctx.editMessageText(buildServiceHeader(ctx, "button-dedicated-server"), {
    parse_mode: "HTML",
  });
}

/** Смена языка на экране «Покупка услуг» и перерисовка клавиатуры (только 3 категории в текущей локали). */
async function switchServicesPurchaseLocale(
  ctx: AppContext,
  menu: Menu<AppContext>,
  nextLocale: "ru" | "en"
): Promise<void> {
  await ctx.answerCallbackQuery().catch(() => {});
  const session = await ctx.session;
  session.main.locale = nextLocale;
  (ctx as any)._requestLocale = nextLocale;
  const userRepo = new UserRepository(ctx.appDataSource);
  try {
    await userRepo.updateLanguage(session.main.user.id, nextLocale);
    if (ctx.chatId) invalidateUser(Number(ctx.chatId));
  } catch {
    // ignore
  }
  const header =
    typeof (ctx as any).fluent?.translateForLocale === "function"
      ? (ctx as any).fluent.translateForLocale(nextLocale, "menu-service-for-buy-choose")
      : ctx.t("menu-service-for-buy-choose");
  await ctx.editMessageText(header, {
    parse_mode: "HTML",
    reply_markup: menu,
  });
}

/** Открытие CDN из меню покупки услуг (fallback callback в index — строка CDN в меню). */
export async function openCdnPurchaseFromServicesMenu(ctx: AppContext): Promise<void> {
  await ctx.answerCallbackQuery().catch(() => {});
  const session = await ctx.session;
  if (!session.other) (session as any).other = createInitialOtherSession();
  if (!session.other.cdn) session.other.cdn = { step: "idle" };
  session.other.cdn.fromManage = false;
  const t =
    typeof (ctx as any).t === "function"
      ? (ctx as any).t.bind(ctx)
      : ((k: string, v?: { error?: string }) =>
          k === "cdn-error" && v?.error
            ? `Ошибка CDN: ${v.error}`
            : k === "cdn-welcome" || k === "cdn-service"
              ? "CDN — тарифы и заказ в боте."
              : k);
  try {
    const text =
      typeof (ctx as any).t === "function" ? (ctx as any).t("cdn-welcome") : "CDN — тарифы и заказ в боте.";
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: cdnMenu,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Bot] CDN menu open error:", msg);
    await ctx.reply(t("cdn-error", { error: msg })).catch(() => {});
  }
}

function buildServicesMenu(): Menu<AppContext> {
  const menu = new Menu<AppContext>("services-menu", { autoAnswer: false, onMenuOutdated: false })
    .submenu((ctx) => ctx.t("button-service-buy-domains"), "domains-menu", openDomainsPurchaseScreen)
    .row()
    .text((ctx) => ctx.t("button-service-buy-cdn"), openCdnPurchaseFromServicesMenu)
    .row()
    .submenu(
      (ctx) => ctx.t("button-service-buy-dedicated"),
      "dedicated-type-menu",
      openDedicatedCategoryScreen
    )
    .row()
    .dynamic(async (ctx, range) => {
      const session = await ctx.session;
      const isEn = session.main.locale === "en";
      if (isEn) {
        range.text((c) => c.t("button-purchase-lang-ru"), async (c) => {
          await switchServicesPurchaseLocale(c, menu, "ru");
        });
      } else {
        range.text((c) => c.t("button-purchase-lang-en"), async (c) => {
          await switchServicesPurchaseLocale(c, menu, "en");
        });
      }
    })
    .row();

  let m = menu;

  if (showVpsVdsInServiceMenus()) {
    m = m
      .submenu(
        (ctx) => ctx.t("button-vds"),
        "vds-type-menu",
        async (ctx) => {
          await ctx.editMessageText(buildServiceHeader(ctx, "button-vds"), {
            parse_mode: "HTML",
          });
        }
      )
      .row();
  }

  return m.back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;
      await ctx.editMessageText(ctx.t("welcome", { balance: session.main.user.balance }), {
        parse_mode: "HTML",
      });
    }
  );
}

export const servicesMenu = buildServicesMenu();

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
    await showTopupForMissingAmount(ctx, price - user.balance);
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
    await ctx.reply(ctx.t("bad-error"));
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
  newVds.autoRenewEnabled = true;
  newVds.adminBlocked = false;
  newVds.managementLocked = false;
  newVds.extraIpv4Count = 0;

  await vdsRepo.save(newVds);

  user.balance -= price;

  await usersRepo.save(user);

  await ctx.reply(ctx.t("vds-created"), {
    reply_markup: mainMenu,
  });
}

export const vdsRateOs = new Menu<AppContext>("vds-select-os").dynamic(
  async (ctx, range) => {
    const session = await ctx.session;

    const osList = ctx.osList;

    if (!osList) {
      await ctx.reply(ctx.t("bad-error"));
      return;
    }

    if (session.other.vdsRate.selectedOs != -1) {
      range.text(ctx.t("vds-select-os-next"), async (ctx) => {
        const session = await ctx.session;

        ctx.menu.close();
        await ctx.editMessageText(ctx.t("await-please"));

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

          await ctx.reply(
            ctx.t("welcome", { balance: session.main.user.balance }),
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

          await ctx.reply(
            ctx.t("welcome", { balance: session.main.user.balance }),
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
            await ctx.menu.close();
            await showTopupForMissingAmount(ctx, price - session.main.user.balance);
            return;
          }
        } else {
          ctx.menu.close();
          return;
        }

        session.other.vdsRate.selectedRateId = Number(ctx.match);

        await ctx.editMessageText(ctx.t("vds-os-select"), {
          parse_mode: "HTML",
        });
      }
    );
  })
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      await ctx.editMessageText(ctx.t("vds-service"), {
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

export const vdsMenu = new Menu<AppContext>("vds-menu", { autoAnswer: false, onMenuOutdated: false })
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
export const dedicatedServersMenu = new Menu<AppContext>("dedicated-servers-menu", { autoAnswer: false, onMenuOutdated: false })
  .dynamic(async (ctx, range) => {
    const pricesList = await prices();
    const session = await ctx.session;

    // Ensure dedicatedType is set (e.g. when opening list from Back or direct path)
    if (!session.other.dedicatedType) {
      session.other.dedicatedType = { bulletproof: false, selectedDedicatedId: -1 };
    }

    const list = pricesList.dedicated_servers ?? [];
    if (!list.length) {
      range.text(ctx.t("button-back"), async (ctx) => {
        await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
          parse_mode: "HTML",
        });
      });
      return;
    }

    const isBulletproof = session.other.dedicatedType.bulletproof;

    // Filter servers by category: standard vs bulletproof (abuse-resistant)
    const serverIndices: number[] = [];
    list.forEach((server: any, id) => {
      const category = server.category ?? "standard";
      if (!isBulletproof && category === "standard") {
        serverIndices.push(id);
      }
      if (isBulletproof && category === "bulletproof") {
        serverIndices.push(id);
      }
    });

    if (serverIndices.length === 0) {
      range
        .row()
        .text(ctx.t("button-back"), async (ctx) => {
          const session = await ctx.session;
          await ctx.editMessageText(buildServiceHeader(ctx, "button-dedicated-server"), {
            parse_mode: "HTML",
            reply_markup: dedicatedTypeMenu,
          });
        });
      return;
    }

    let dataSource: AppContext["appDataSource"] | null = null;
    try {
      dataSource = ctx.appDataSource;
    } catch {
      // DB may be unavailable; we still show servers with base price
    }
    const userId = session.main?.user?.id ?? 0;

    for (const id of serverIndices) {
      const server = list[id];
      const priceObj = server.price ?? {};
      const basePrice =
        isBulletproof && priceObj.bulletproof != null
          ? (priceObj.bulletproof as number)
          : (priceObj.default ?? 0);
      let price = basePrice;
      if (dataSource && userId > 0) {
        try {
          price = await getPriceWithPrimeDiscount(dataSource, userId, basePrice);
        } catch {
          // keep basePrice on error
        }
      }

      range
        .submenu(
          {
            text: server.name ?? "",
            payload: id.toString(),
          },
          "dedicated-selected-server",
          async (ctx) => {
            const session = await ctx.session;
            if (session.other.dedicatedType) session.other.dedicatedType.selectedDedicatedId = id;
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
 * @param replyMarkup - Optional keyboard (e.g. dedicatedSelectedServerMenu when returning from location menu).
 */
const editMessageDedicatedServer = async (
  ctx: AppContext,
  serverId: number,
  replyMarkup?: Menu<AppContext>
) => {
  const pricesList = await prices();
  const session = await ctx.session;
  const server = pricesList.dedicated_servers[serverId];

  if (!server) {
    await ctx.editMessageText(ctx.t("error-unknown", { error: "Server not found" }));
    return;
  }

  const isBulletproof = session.other.dedicatedType?.bulletproof || false;
  const basePrice: number =
    (isBulletproof && server.price.bulletproof
      ? server.price.bulletproof
      : server.price.default) ?? 0;
  const dataSource = ctx.appDataSource;
  const userId: number = session.main?.user?.id ?? 0;
  const price = await getPriceWithPrimeDiscount(dataSource, userId, basePrice);

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
      ...(replyMarkup && { reply_markup: replyMarkup }),
    }
  );
};

/**
 * Dedicated location selection menu (after Make Order).
 * Shows only locations allowed for the selected server (server.locations in prices.json).
 */
export const dedicatedLocationMenu = new Menu<AppContext>("dedicated-location-menu")
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;
    const selectedId = session.other.dedicatedType?.selectedDedicatedId ?? -1;
    const pricesList = await prices();
    const server = pricesList.dedicated_servers?.[selectedId] as { locations?: string[] } | undefined;
    const locationKeys =
      server?.locations?.length &&
      DEDICATED_LOCATION_KEYS.filter((k) => server.locations!.includes(k)).length > 0
        ? (server.locations as readonly string[]).filter((k) =>
            (DEDICATED_LOCATION_KEYS as readonly string[]).includes(k)
          )
        : [...DEDICATED_LOCATION_KEYS];

    for (const key of locationKeys) {
      const labelKey = `dedicated-location-${key}` as const;
      range
        .text((c) => c.t(labelKey), async (ctx) => {
          await ctx.answerCallbackQuery().catch(() => {});
          const session = await ctx.session;
          session.other.dedicatedOrder = session.other.dedicatedOrder ?? { step: "idle", requirements: undefined };
          session.other.dedicatedOrder.selectedLocationKey = key;
          const osKeyboard = new InlineKeyboard();
          for (const osKey of DEDICATED_OS_KEYS) {
            osKeyboard.text(ctx.t(`dedicated-os-${osKey}`), `dedicated-os:${osKey}`).row();
          }
          osKeyboard.text(ctx.t("button-return-to-main"), "dedicated-os:back");
          await ctx.editMessageText(ctx.t("dedicated-os-select-title"), {
            parse_mode: "HTML",
            reply_markup: osKeyboard,
          });
        })
        .row();
    }
  })
  .row()
  .back((ctx) => ctx.t("button-back"), async (ctx) => {
    const session = await ctx.session;
    const selectedId = session.other.dedicatedType?.selectedDedicatedId ?? -1;
    const pricesList = await prices();
    const server = pricesList.dedicated_servers?.[selectedId];
    if (server !== undefined) {
      await editMessageDedicatedServer(ctx, selectedId, dedicatedSelectedServerMenu);
    } else {
      await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), { parse_mode: "HTML" });
    }
  });

/**
 * Handles dedicated OS selection: payment and contact-support message.
 * Used from callback "dedicated-os:{osKey}" when OS is chosen from manual keyboard.
 */
export async function handleDedicatedOsSelect(ctx: AppContext, osKey: string): Promise<void> {
  await ctx.answerCallbackQuery().catch(() => {});
  const session = await ctx.session;
  const selectedId = session.other.dedicatedType?.selectedDedicatedId ?? -1;
  const locationKey = session.other.dedicatedOrder?.selectedLocationKey;
  if (selectedId < 0 || !locationKey) {
    await ctx.reply(ctx.t("bad-error"));
    return;
  }
  const pricesList = await prices();
  const server = pricesList.dedicated_servers?.[selectedId];
  if (!server) {
    await ctx.reply(ctx.t("bad-error"));
    return;
  }
  const isBulletproof = session.other.dedicatedType?.bulletproof ?? false;
  const basePrice: number =
    (isBulletproof && server.price.bulletproof
      ? server.price.bulletproof
      : server.price.default) ?? 0;
  const dataSource = ctx.appDataSource;
  const usersRepo = dataSource.getRepository(User);
  let user: User | null = null;
  let price = 0;
  let deducted = false;
  try {
    user = await usersRepo.findOneBy({ id: session.main.user.id });
    if (!user) {
      await ctx.reply(ctx.t("bad-error"));
      return;
    }
    const userId: number = user.id ?? 0;
    price = await getPriceWithPrimeDiscount(dataSource, userId, basePrice);
    if (user.balance < price) {
      await showTopupForMissingAmount(ctx, price - user.balance);
      return;
    }
    user.balance -= price;
    await usersRepo.save(user);
    deducted = true;
    session.main.user.balance = user.balance;
    session.main.user.referralBalance = user.referralBalance ?? 0;
    session.other.dedicatedOrder = {
      step: "idle",
      requirements: undefined,
      selectedLocationKey: locationKey,
      selectedOsKey: osKey,
    };
    const provisioningService = new DedicatedProvisioningService(dataSource);
    const location = ctx.t(`dedicated-location-${locationKey}`);
    const os = ctx.t(`dedicated-os-${osKey}`);
    const idempotencyKey = ctx.callbackQuery?.id
      ? `tgcb:${ctx.callbackQuery.id}`
      : `dedicated:${session.main.user.id}:${selectedId}:${locationKey}:${osKey}:${Date.now()}`;
    const category = session.other.dedicatedType?.bulletproof ? "bulletproof" : "standard";
    const created = await provisioningService.createPaidOrderAndTicket({
      userId: user.id,
      telegramUserId: ctx.from?.id ?? null,
      telegramUsername: ctx.from?.username ?? null,
      fullName: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || null,
      customerLanguage: session.main.locale,
      paymentAmount: price,
      paymentMethod: "balance",
      paymentStatus: DedicatedOrderPaymentStatus.PAID,
      balanceUsedAmount: price,
      idempotencyKey,
      config: {
        productId: String(selectedId),
        productName: server.name ?? `Dedicated #${selectedId}`,
        category,
        cpuModel: server.cpu != null ? String(server.cpu) : null,
        cpuThreads: Number(server.cpuThreads ?? 0) || null,
        ram: server.ram != null ? String(server.ram) : null,
        storageSize: server.storage != null ? String(server.storage) : null,
        bandwidth: server.bandwidth != null ? String(server.bandwidth) : null,
        uplinkSpeed: server.network != null ? String(server.network) : null,
        unmeteredTraffic: String(server.bandwidth ?? "").toLowerCase() === "unlimited",
        locationKey,
        locationLabel: location,
        osKey,
        osLabel: os,
        ddosProtection: session.other.dedicatedType?.bulletproof ? "enhanced" : "standard",
        deploymentNotes: null,
      },
    });

    const order = created.order;
    const ticket = created.ticket;
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply(ctx.t("dedicated-purchase-success-deducted", { amount: price }), {
      parse_mode: "HTML",
    });

    const buyerText = renderMultiline(ctx.t("dedicated-provisioning-ticket-created", {
      ticketId: ticket.id,
      orderId: order.id,
      serviceName: server.name ?? `#${selectedId}`,
      location,
      os,
    }));
    await ctx.reply(buyerText, {
      parse_mode: "HTML",
    });

    const moderators = await usersRepo.find({
      where: [{ role: Role.Admin }, { role: Role.Moderator }],
    });
    const staffText = renderMultiline(ctx.t("dedicated-provisioning-staff-notification", {
      ticketId: ticket.id,
      orderId: order.id,
      userId: user.id,
      amount: price,
      serviceName: server.name ?? `#${selectedId}`,
      location,
      os,
    }));
    const staffKeyboard = new InlineKeyboard()
      .text(ctx.t("button-open"), `prov_view_${ticket.id}`)
      .text(ctx.t("button-close"), `ticket_notify_close_${ticket.id}`);
    const recipientChatIds = new Set<number>();
    for (const mod of moderators) {
      recipientChatIds.add(mod.telegramId);
    }
    const moderatorChatId = getModeratorChatId();
    if (moderatorChatId) {
      recipientChatIds.add(moderatorChatId);
    }

    for (const chatId of recipientChatIds) {
      await ctx.api
        .sendMessage(chatId, staffText, {
          parse_mode: "HTML",
          reply_markup: staffKeyboard,
        })
        .catch(() => {});
    }
  } catch (error: any) {
    if (deducted && user) {
      try {
        user.balance += price;
        await usersRepo.save(user);
        session.main.user.balance = user.balance;
      } catch {
        // ignore rollback failure, original error is still returned below
      }
    }
    const errorMessage = error?.message || "Unknown error";
    await ctx.reply(ctx.t("error-unknown", { error: errorMessage }), { parse_mode: "HTML" }).catch(() => {});
  }
}

/**
 * Dedicated OS selection menu (after location). On select: pay and show contact-support message.
 * Also used when navigating from location menu (grammY nav); manual keyboard uses handleDedicatedOsSelect.
 */
export const dedicatedOsMenu = new Menu<AppContext>("dedicated-os-menu")
  .dynamic(async (ctx, range) => {
    for (const osKey of DEDICATED_OS_KEYS) {
      const labelKey = `dedicated-os-${osKey}` as const;
      range
        .text((c) => c.t(labelKey), async (ctx) => {
          await handleDedicatedOsSelect(ctx, osKey);
        })
        .row();
    }
  })
  .row()
  .text((ctx) => ctx.t("button-return-to-main"), async (ctx) => {
    const session = await ctx.session;
    await ctx.editMessageText(
      ctx.t("welcome", { balance: session.main.user.balance }),
      { parse_mode: "HTML", reply_markup: mainMenu }
    );
  });

/**
 * Dedicated server detail menu (shows server info with Order button).
 */
export const dedicatedSelectedServerMenu = new Menu<AppContext>("dedicated-selected-server", {
  onMenuOutdated: (ctx) => {
    ctx.deleteMessage().then();
  },
})
  .row()
  .submenu(
    (ctx) => ctx.t("button-order-dedicated"),
    "dedicated-location-menu",
    async (ctx) => {
      await ctx.editMessageText(ctx.t("dedicated-location-select-title"), {
        parse_mode: "HTML",
      });
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

export const domainsMenu = new Menu<AppContext>("domains-menu", { autoAnswer: false, onMenuOutdated: false })
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
            await showTopupForMissingAmount(ctx, priceForCheck - session.main.user.balance);
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

      await ctx.reply(
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
