/**
 * Express controller for VM disk resize (example integration surface).
 *
 * @module proxmox-vm-resize/controllers/vm-disk-resize.controller
 */

import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import type { VmDiskResizeService } from "../services/vm-disk-resize.service.js";
import { sendProxmoxResizeError } from "../http/proxmox-resize-error.mapper.js";

const paramsSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/)
    .transform((s) => Number.parseInt(s, 10))
    .pipe(z.number().int().min(100)),
});

const bodySchema = z.object({
  disk: z.string().min(1, "disk is required"),
  size: z.string().min(1, "size is required"),
});

export function createVmDiskResizeRouter(service: VmDiskResizeService): Router {
  const router = Router();

  router.post("/vms/:id/resize-disk", async (req: Request, res: Response) => {
    try {
      const { id } = paramsSchema.parse(req.params);
      const { disk, size } = bodySchema.parse(req.body);
      const payload = await service.resizeVmDisk(id, disk, size);
      res.status(200).json(payload);
    } catch (error: unknown) {
      sendProxmoxResizeError(res, error);
    }
  });

  return router;
}
