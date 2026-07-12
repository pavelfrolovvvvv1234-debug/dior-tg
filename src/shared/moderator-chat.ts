/**
 * Moderator/staff chat ID for operational notifications (tickets, provisioning).
 *
 * @module shared/moderator-chat
 */

import { getStaffNotifyChatIdFromEnv } from "../app/config.js";

let moderatorChatId: number | null = null;

/**
 * Store the chat ID where moderators want to receive notifications (runtime override).
 */
export const setModeratorChatId = (chatId: number): void => {
  if (Number.isInteger(chatId) && chatId !== 0) {
    moderatorChatId = chatId;
  }
};

/**
 * Staff notify chat: runtime value from last admin/mod interaction, else STAFF_NOTIFY_CHAT_ID from env.
 */
export const getModeratorChatId = (): number | null => {
  if (moderatorChatId !== null) return moderatorChatId;
  return getStaffNotifyChatIdFromEnv();
};
