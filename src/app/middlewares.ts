/**
 * Bot middlewares for user management, locale, and context setup.
 *
 * @module app/middlewares
 */

import type { AppContext } from "../shared/types/context.js";
import { Role } from "../entities/User.js";
import { getAppDataSource } from "../infrastructure/db/datasource.js";
import { UserRepository } from "../infrastructure/db/repositories/UserRepository.js";
import { Logger } from "./logger.js";

/**
 * Middleware to initialize database and user context.
 */
export async function databaseMiddleware(ctx: AppContext, next: () => Promise<void>): Promise<void> {
  const session = await ctx.session;
  const dataSource = await getAppDataSource();
  const userRepo = new UserRepository(dataSource);

  ctx.appDataSource = dataSource;

  if (ctx.hasChatType("private")) {
    // Find or create user
    const user = await userRepo.findOrCreateByTelegramId(ctx.chatId);

    // Update session
    session.main.user.balance = user.balance;
    session.main.user.id = user.id;
    session.main.user.role = user.role;
    session.main.user.isBanned = user.isBanned;
  }

  return next();
}

/**
 * Middleware to initialize locale from user settings or Telegram language.
 */
export async function localeMiddleware(ctx: AppContext, next: () => Promise<void>): Promise<void> {
  const session = await ctx.session;

  // If locale not set, detect from Telegram or default to en
  if (session.main.locale === "0" || !session.main.locale) {
    const dataSource = await getAppDataSource();
    const userRepo = new UserRepository(dataSource);

    // Detect locale from Telegram
    const detectedLocale = ctx.from?.language_code === "ru" ? "ru" : "en";
    session.main.locale = detectedLocale;

    // Save to database if user exists
    if (session.main.user.id > 0) {
      try {
        await userRepo.updateLanguage(session.main.user.id, detectedLocale);
      } catch (error) {
        Logger.error("Failed to update user language", error);
      }
    }
  }

  return next();
}

/**
 * Middleware to check if user is banned.
 */
export async function banCheckMiddleware(ctx: AppContext, next: () => Promise<void>): Promise<void> {
  const session = await ctx.session;

  if (session.main.user.isBanned) {
    await ctx.reply(ctx.t("message-about-block"), {
      parse_mode: "HTML",
    });
    // Delete the message that triggered this (if exists)
    if (ctx.message) {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        // Ignore if message already deleted
      }
    }
    return;
  }

  return next();
}

/**
 * Middleware to setup VMManager and OS list in context.
 */
export function vmmanagerMiddleware(vmManager: import("../infrastructure/vmmanager/VMManager.js").VMManager) {
  return async (ctx: AppContext, next: () => Promise<void>): Promise<void> => {
    ctx.vmmanager = vmManager;

    // Lazy load OS list
    if (ctx.osList == null) {
      try {
        const list = await vmManager.getOsList();
        if (list) {
          ctx.osList = list;
        }
      } catch (error) {
        Logger.error("Failed to load OS list", error);
        ctx.osList = null;
      }
    }

    return next();
  };
}

/**
 * Middleware to setup available languages in context.
 */
export function languagesMiddleware(availableLocales: string[]) {
  return async (ctx: AppContext, next: () => Promise<void>): Promise<void> => {
    ctx.availableLanguages = availableLocales;
    return next();
  };
}
