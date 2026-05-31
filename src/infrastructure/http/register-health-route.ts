/**
 * Docker / load-balancer health probe.
 *
 * @module infrastructure/http/register-health-route
 */

import type { Express, Request, Response } from "express";

export function registerHealthRoute(app: Express): void {
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, service: "dior-host-bot" });
  });
}
