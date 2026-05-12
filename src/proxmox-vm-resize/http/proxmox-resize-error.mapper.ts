/**
 * Maps domain / transport errors to HTTP responses (no secrets in payloads).
 *
 * @module proxmox-vm-resize/http/proxmox-resize-error.mapper
 */

import type { Response } from "express";
import { ZodError } from "zod";
import {
  DiskSizeValidationError,
  DiskSlotValidationError,
  ProxmoxApiHttpError,
  ProxmoxApiTransportError,
  ProxmoxResizeDomainError,
  VmIdValidationError,
} from "../errors/proxmox-resize.errors.js";

export interface JsonErrorBody {
  readonly ok: false;
  readonly error: string;
  readonly message: string;
  readonly details?: unknown;
}

export function sendProxmoxResizeError(res: Response, error: unknown): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: error.flatten(),
    } satisfies JsonErrorBody);
    return;
  }

  if (
    error instanceof DiskSizeValidationError ||
    error instanceof DiskSlotValidationError ||
    error instanceof VmIdValidationError ||
    error instanceof ProxmoxResizeDomainError
  ) {
    res.status(400).json({
      ok: false,
      error: error.code,
      message: error.message,
    } satisfies JsonErrorBody);
    return;
  }

  if (error instanceof ProxmoxApiHttpError) {
    const { status, statusText, method, url, responseBody, requestBody } = error.payload;
    res.status(502).json({
      ok: false,
      error: "PROXMOX_HTTP_ERROR",
      message: `Proxmox returned HTTP ${status} ${statusText}.`,
      details: { method, url, responseBody, requestBody },
    } satisfies JsonErrorBody);
    return;
  }

  if (error instanceof ProxmoxApiTransportError) {
    res.status(503).json({
      ok: false,
      error: "PROXMOX_TRANSPORT_ERROR",
      message: error.message,
    } satisfies JsonErrorBody);
    return;
  }

  res.status(500).json({
    ok: false,
    error: "INTERNAL_ERROR",
    message: "Unexpected server error.",
  } satisfies JsonErrorBody);
}
