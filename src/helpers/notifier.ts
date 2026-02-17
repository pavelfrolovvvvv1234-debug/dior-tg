import type { AppContext } from "../shared/types/context";
import User, { Role } from "@entities/User";

export async function notifyAllAdminsAboutPromotedUser(
  ctx: AppContext,
  promotedUser: {
    telegramId: string;
    name: string;
    id: number;
    role: Role;
  }
) {
  const { id, name, role, telegramId } = promotedUser;

  ctx.appDataSource.manager
    .find(User, {
      where: {
        role: Role.Admin,
      },
    })
    .then((admins) => {
      admins.forEach((admin) => {
        ctx.api.sendMessage(
          admin.telegramId,
          ctx.t("admin-notification-about-promotion", {
            telegramId,
            name,
            id,
            role,
          }),
          {
            parse_mode: "HTML",
          }
        );
      });
    });
}
