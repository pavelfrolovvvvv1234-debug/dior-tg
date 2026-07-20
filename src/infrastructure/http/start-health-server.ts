/**
 * Minimal HTTP server for health probes (polling or webhook mode).
 *
 * @module infrastructure/http/start-health-server
 */

import express from "express";
import type { Api, Bot, RawApi } from "grammy";
import { registerHealthRoute } from "./register-health-route.js";
import { mountAdminBillingApi } from "./mount-admin-billing-api.js";
import { Logger } from "../../app/logger.js";

export async function startHealthServer(
  port: number,
  deps?: { getBot?: () => Bot<any, Api<RawApi>> | null }
): Promise<() => void> {
  const app = express();
  registerHealthRoute(app);

  if (deps?.getBot) {
    await mountAdminBillingApi(app, { getBot: deps.getBot });
  }

  const server = app.listen(port, () => {
    Logger.info(`Health server listening on port ${port}`);
  });
  return () => {
    server.close();
  };
}
