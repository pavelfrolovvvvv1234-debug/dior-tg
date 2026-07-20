/**
 * Mount internal billing notify API (web billing → Telegram admin alerts).
 *
 * @module infrastructure/http/mount-admin-billing-api
 */

import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { Api, Bot, RawApi } from "grammy";
import { Logger } from "../../app/logger.js";

function mountAdminBillingAuth(app: Express): void {
  const corsOrigin = process.env.CORS_ORIGIN ?? "*";
  app.use(["/api/admin/billing"], (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Admin-API-Key, Authorization"
    );
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    const apiKey = process.env.ADMIN_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({ error: "Admin API disabled: set ADMIN_API_KEY" });
      return;
    }
    const key =
      req.get("X-Admin-API-Key") ??
      req.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (key !== apiKey) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  });
}

export async function registerAdminBillingRoutes(
  app: Express,
  deps: { getBot: () => Bot<any, Api<RawApi>> | null }
): Promise<void> {
  const { createBillingNotifyRouter } = await import("../../api/admin/billing-notify-routes.js");
  app.use("/api/admin/billing", createBillingNotifyRouter(deps));
}

export async function mountAdminBillingApi(
  app: Express,
  deps: { getBot: () => Bot<any, Api<RawApi>> | null }
): Promise<void> {
  app.use(
    express.json({
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as { rawBody?: string }).rawBody = buf.toString("utf8");
      },
    })
  );
  mountAdminBillingAuth(app);
  await registerAdminBillingRoutes(app, deps);
  Logger.info("Admin billing notify API mounted at /api/admin/billing");
}
