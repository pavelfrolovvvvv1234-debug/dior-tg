import { Menu } from "@grammyjs/menu";
import { mainMenu, MyAppContext } from "..";
import DomainRequest, { DomainRequestStatus } from "@/entities/DomainRequest";
import { getAppDataSource } from "@/database";
import { InlineKeyboard } from "grammy";
import VirtualDedicatedServer, {
  generatePassword,
} from "@/entities/VirtualDedicatedServer";
import { ListItem } from "@/api/vmmanager";

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
    "vds-manage-services-list",
    async (ctx) => {
      ctx.editMessageText(ctx.t("vds-manage-title"));
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

export const vdsReinstallOs = new Menu<MyAppContext>("vds-select-os-reinstall")
  .dynamic(async (ctx, range) => {
    const osList = ctx.osList;

    if (!osList) {
      ctx.reply(ctx.t("bad-error"));
      return;
    }

    let count = 0;
    osList.list
      .filter(
        (os) => !os.adminonly && os.name != "NoOS" && os.state == "active"
      )
      .forEach((os) => {
        range.text(os.name, async (ctx) => {
          const session = await ctx.session;

          // Run function for create VM and buy it
          const id = session.other.manageVds.lastPickedId;

          const vdsRepo = ctx.appDataSource.getRepository(
            VirtualDedicatedServer
          );

          const vds = await vdsRepo.findOneBy({
            id: id,
          });

          if (vds) {
            if (vds.targetUserId != session.main.user.id) {
              ctx.reply(ctx.t("bad-error"));
              return;
            }

            await ctx.editMessageText("await-please");
            ctx.menu.close();

            let reinstall;
            for (let attempt = 0; attempt < 4; attempt++) {
              reinstall = await ctx.vmmanager.reinstallOS(vds.vdsId, os.id);
              if (reinstall) break;
            }

            if (!reinstall) {
              ctx.reply(ctx.t("bad-error"));
              return;
            }

            vds.lastOsId = os.id;

            await vdsRepo.save(vds);
            await ctx.deleteMessage();
            await ctx.reply(ctx.t("vds-reinstall-started"));
          }
        });

        count++;
        if (count % 2 === 0) {
          range.row();
        }
      });

    if (count % 2 !== 0) {
      range.row();
    }
  })
  .back((ctx) => ctx.t("button-back"));

export const vdsManageSpecific = new Menu<MyAppContext>(
  "vds-manage-specific"
).dynamic(async (ctx, range) => {
  const session = await ctx.session;

  let vdsId: number;

  if (ctx.match) {
    vdsId = Number(ctx.match);
  } else {
    vdsId = session.other.manageVds.lastPickedId;
  }

  const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

  const vds = await vdsRepo.findOneBy({
    id: Number(vdsId),
  });

  if (!vds) {
    ctx.reply(ctx.t("bad-error"));
    return;
  }

  if (session.main.user.id != vds?.targetUserId) {
    return;
  }

  let info;

  for (let attempt = 0; attempt < 4; attempt++) {
    info = await ctx.vmmanager.getInfoVM(vds.vdsId);
    if (info) break;
  }

  if (!info) {
    ctx.reply(ctx.t("failed-to-retrieve-info"));
    return;
  }

  range.copyText(ctx.t("vds-button-copy-password"), vds.password);

  if (info.state == "creating") {
    range.text(ctx.t("update-button"), async (ctx) => {
      ctx.menu.update();
    });
  } else {
    try {
      await ctx.editMessageText(vdsInfoText(ctx, vds, info), {
        parse_mode: "HTML",
      });
    } catch (err) {
      console.log("[Menu Manage VDS] Okay updated");
    }
  }

  if (info.state == "stopped") {
    range.text(
      {
        text: ctx.t("vds-button-start-machine"),
        payload: vdsId.toString(),
      },
      async (ctx) => {
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = Number(ctx.match);

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: Number(ctx.match),
        });

        if (vds) {
          const result = await ctx.vmmanager.startVM(vds.vdsId);

          let info;

          for (let attempt = 0; attempt < 4; attempt++) {
            info = await ctx.vmmanager.getInfoVM(vds.vdsId);
            if (info) break;
          }

          if (!info) {
            ctx.reply(ctx.t("failed-to-retrieve-info"));
            return;
          }

          info.state = "active";

          if (result) {
            await ctx.editMessageText(vdsInfoText(ctx, vds, info), {
              parse_mode: "HTML",
            });

            await new Promise((resolve) => setTimeout(resolve, 6000));
            ctx.menu.update();
          }
        }
      }
    );
  }

  if (info.state == "active") {
    range.text(
      {
        text: ctx.t("vds-button-stop-machine"),
        payload: vdsId.toString(),
      },
      async (ctx) => {
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = Number(ctx.match);

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: Number(ctx.match),
        });

        if (vds) {
          const result = await ctx.vmmanager.stopVM(vds.vdsId);

          let info;

          while (info == undefined) {
            info = await ctx.vmmanager.getInfoVM(vds.vdsId);
          }

          info.state = "stopped";

          if (result) {
            await ctx.editMessageText(vdsInfoText(ctx, vds, info), {
              parse_mode: "HTML",
            });

            await new Promise((resolve) => setTimeout(resolve, 6000));
            ctx.menu.update();
          }
        }
      }
    );
  }

  if (info.state == "active" || info.state == "stopped") {
    range.row();
    range.text(
      {
        text: ctx.t("vds-button-regenerate-password"),
        payload: vdsId.toString(),
      },
      async (ctx) => {
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = Number(ctx.match);

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: Number(ctx.match),
        });

        if (vds) {
          const result = await ctx.vmmanager.changePasswordVM(vds.vdsId);

          if (result) {
            vds.password = result;
            await vdsRepo.save(vds);

            await ctx.reply(
              ctx.t("vds-new-password", {
                password: vds.password,
              }),
              {
                parse_mode: "HTML",
              }
            );

            let info;

            while (info == undefined) {
              info = await ctx.vmmanager.getInfoVM(vds.vdsId);
            }

            await new Promise((resolve) => setTimeout(resolve, 6000));
            await ctx.editMessageText(vdsInfoText(ctx, vds, info), {
              parse_mode: "HTML",
            });
            ctx.menu.update();
          }
        }
      }
    );

    range.text(
      {
        text: ctx.t("vds-button-reinstall-os"),
        payload: vdsId.toString(),
      },
      async (ctx) => {
        const session = await ctx.session;

        session.other.manageVds.lastPickedId = Number(ctx.match);

        const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

        const vds = await vdsRepo.findOneBy({
          id: Number(ctx.match),
        });

        if (vds) {
          ctx.menu.nav("vds-select-os-reinstall");
        }
      }
    );
  }

  range.row();

  range.text(ctx.t("button-back"), async (ctx) => {
    await ctx.deleteMessage();
    // await ctx.deleteMessage();
    // ctx.menu.close();
  });
});

const status = (state: ListItem["state"], ctx: MyAppContext) => {
  switch (state) {
    case "creating":
      return ctx.t("vds-creating");
    case "stopped":
      return ctx.t("vds-stopped");
    case "active":
      return ctx.t("vds-work");
  }
};

const vdsInfoText = (
  ctx: MyAppContext,
  vds: VirtualDedicatedServer,
  info: ListItem
) => {
  const os = ctx.osList?.list.find((os) => os.id == vds.lastOsId);

  return ctx.t("vds-current-info", {
    expireAt: vds.expireAt,
    price: vds.renewalPrice,
    abuse: vds.isBulletproof
      ? ctx.t("bulletproof-on")
      : ctx.t("bulletproof-off"),
    rateName: vds.rateName,
    cpu: vds.cpuCount,
    ram: vds.ramSize,
    disk: vds.diskSize,
    ip: vds.ipv4Addr,
    status: status(info.state, ctx),
    osName: os?.name || "undefined",
  });
};

export const vdsManageServiceMenu = new Menu<MyAppContext>(
  "vds-manage-services-list"
)
  .dynamic(async (ctx, range) => {
    const session = await ctx.session;

    const vdsRepo = ctx.appDataSource.getRepository(VirtualDedicatedServer);

    const [vdsList, total] = await vdsRepo.findAndCount({
      where: [
        {
          targetUserId: session.main.user.id,
        },
      ],
      take: LIMIT_ON_PAGE,
      skip: session.other.manageVds.page * LIMIT_ON_PAGE,
    });

    const maxPages = Math.ceil(total / LIMIT_ON_PAGE) - 1;

    for (const vds of vdsList) {
      range
        .text(
          {
            text: ctx.t("vds-manage-list-item", {
              rateName: vds.rateName,
              ip: vds.ipv4Addr,
            }),
            payload: vds.id.toString(),
          },
          async (ctx) => {
            /// vdsManageSpecific
            const session = await ctx.session;

            const vdsRepo = ctx.appDataSource.getRepository(
              VirtualDedicatedServer
            );

            const vds = await vdsRepo.findOneBy({
              id: Number(ctx.match),
            });

            if (!vds) {
              ctx.reply(ctx.t("bad-error"));
              return;
            }

            let info;

            for (let attempt = 0; attempt < 4; attempt++) {
              info = await ctx.vmmanager.getInfoVM(vds.vdsId);
              if (info) break;
            }

            if (!info) {
              ctx.reply(ctx.t("failed-to-retrieve-info"));
              return;
            }

            session.other.manageVds.lastPickedId = Number(ctx.match);

            await ctx.reply(vdsInfoText(ctx, vds, info), {
              parse_mode: "HTML",
              reply_markup: vdsManageSpecific,
            });
          }
        )
        .row();
    }

    if (vdsList.length == LIMIT_ON_PAGE) {
      range.text(
        (ctx) => ctx.t("pagination-left"),
        async (ctx) => {
          if (session.other.manageVds.page - 1 < 0) {
            session.other.manageVds.page = maxPages;
          } else {
            session.other.manageVds.page--;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );
      range.text(() => `${session.other.manageVds.page + 1}/${maxPages + 1}`);
      range.text(
        (ctx) => ctx.t("pagination-right"),
        async (ctx) => {
          session.other.manageVds.page++;

          if (session.other.manageVds.page > maxPages) {
            session.other.manageVds.page = 0;
          }

          await ctx.menu.update({
            immediate: true,
          });
        }
      );
    }

    // range.text(ctx.t("vds-manage-list-item", {
    //   rateName:
    // }));
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

    if (domainRequests.length == LIMIT_ON_PAGE) {
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
    }
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
