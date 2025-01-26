import { Menu } from "@grammyjs/menu";
import { MyAppContext } from "..";

export const servicesMenu = new Menu<MyAppContext>("services-menu")
  .text((ctx) => ctx.t("button-domains"))
  .row()
  .back((ctx) => ctx.t("button-back"));
