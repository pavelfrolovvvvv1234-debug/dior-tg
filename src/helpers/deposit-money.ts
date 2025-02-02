import { Menu } from "@grammyjs/menu";
import { MyAppContext } from "..";

const depositValuesOptions = [
  "10$",
  "25$",
  "30$",
  "50$",
  "60$",
  "100$",
  "150$",
];

export const depositMenu = new Menu<MyAppContext>("deposit-menu").dynamic(
  (_ctx, range) => {
    for (let i = 0; i < depositValuesOptions.length; i++) {
      range.text(depositValuesOptions[i], (ctx) => {});

      if (i % 2 === 0) {
        range.row();
      }
    }

    range.text((ctx) => ctx.t("button-any-sum"));
  }
);
