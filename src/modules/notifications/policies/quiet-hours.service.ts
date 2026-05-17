/**
 * UTC quiet hours — defer delivery to next allowed window.
 *
 * @module modules/notifications/policies/quiet-hours.service
 */

import type { NotificationEngineConfig } from "../types.js";

export class QuietHoursService {
  constructor(private readonly config: NotificationEngineConfig) {}

  isQuietHourUtc(date: Date = new Date()): boolean {
    const hour = date.getUTCHours();
    const start = this.config.quietHoursStartUtc;
    const end = this.config.quietHoursEndUtc;
    if (start > end) {
      return hour >= start || hour < end;
    }
    return hour >= start && hour < end;
  }

  nextAllowedTime(from: Date = new Date()): Date {
    if (!this.isQuietHourUtc(from)) return from;
    const next = new Date(from);
    const end = this.config.quietHoursEndUtc;
    next.setUTCHours(end, 0, 0, 0);
    if (next <= from) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }
}
