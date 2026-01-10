/**
 * Grammy context extension types.
 *
 * @module shared/types/context
 */

import { Context, LazySessionFlavor } from "grammy";
import { FluentContextFlavor } from "@grammyjs/fluent";
import { MenuFlavor } from "@grammyjs/menu";
import { ConversationFlavor, Conversation } from "@grammyjs/conversations";
import { DataSource } from "typeorm";
import { VMManager, GetOsListResponse } from "../../infrastructure/vmmanager/VMManager.js";
import { SessionData } from "./session.js";

/**
 * Extended Grammy context with all required flavors and custom properties.
 */
export type AppContext = ConversationFlavor<
  Context &
    FluentContextFlavor &
    LazySessionFlavor<SessionData> &
    MenuFlavor & {
      availableLanguages: string[];
      appDataSource: DataSource;
      vmmanager: VMManager;
      osList: GetOsListResponse | null;
    }
>;

/**
 * Conversation type for Grammy conversations.
 */
export type AppConversation = Conversation<AppContext>;
