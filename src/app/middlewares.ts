/**
 * Bot middlewares for user management, locale, and context setup.
 *
 * @module app/middlewares
 */

import type { AppContext } from "../shared/types/context.js";
import { Role, UserStatus } from "../entities/User.js";
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
    session.main.user.referralBalance = user.referralBalance ?? 0;
    session.main.user.id = user.id;
    session.main.user.role = user.role;
    session.main.user.status = user.status;
    session.main.user.isBanned = user.isBanned;
  }

  return next();
}

/**
 * Middleware to initialize locale from user settings.
 * For new users (locale === "0"), we don't set it automatically - they will choose it on first /start.
 */
export async function localeMiddleware(ctx: AppContext, next: () => Promise<void>): Promise<void> {
  const session = await ctx.session;

  // If locale not set and user exists in DB, try to load from DB
  if ((session.main.locale === "0" || !session.main.locale) && session.main.user.id > 0) {
    const dataSource = await getAppDataSource();
    const userRepo = new UserRepository(dataSource);

    try {
      const user = await userRepo.findOneBy({ id: session.main.user.id });
      if (user && user.lang) {
        session.main.locale = user.lang;
      }
      // If user.lang is null, keep locale as "0" to show language selection
    } catch (error) {
      Logger.error("Failed to load user language", error);
      // Keep locale as "0" to show language selection
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
