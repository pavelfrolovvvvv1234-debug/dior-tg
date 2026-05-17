/**
 * Notification & retention engine — public API.
 *
 * @module modules/notifications
 */

export { startNotificationEngine } from "./notification.engine.js";
export type { NotificationEngineHandle } from "./notification.engine.js";
export {
  trackVpsCheckoutFunnel,
  completeVpsCheckoutFunnel,
} from "./events/notification-event-handler.js";
export { DEFAULT_ENGINE_CONFIG } from "./types.js";
export type { CampaignKey, NotificationSegment, EnqueueOptions } from "./types.js";
