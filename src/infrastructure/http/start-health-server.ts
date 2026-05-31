/**
 * Minimal HTTP server for health probes (polling or webhook mode).
 *
 * @module infrastructure/http/start-health-server
 */

import express from "express";
import { registerHealthRoute } from "./register-health-route.js";
import { Logger } from "../../app/logger.js";

export function startHealthServer(port: number): () => void {
  const app = express();
  registerHealthRoute(app);
  const server = app.listen(port, () => {
    Logger.info(`Health server listening on port ${port}`);
  });
  return () => {
    server.close();
  };
}
