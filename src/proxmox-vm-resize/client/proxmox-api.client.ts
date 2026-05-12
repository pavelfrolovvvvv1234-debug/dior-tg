/**
 * Low-level HTTP client for Proxmox VE JSON API (QEMU resize and related).
 *
 * @module proxmox-vm-resize/client/proxmox-api.client
 */

import axios, { type AxiosInstance, isAxiosError } from "axios";
import https from "https";
import type { ProxmoxResizeConfig } from "../config/proxmox-resize.config.js";
import type { ProxmoxJsonEnvelope, ProxmoxQemuResizeData, ProxmoxQemuResizeResult } from "../dtos/proxmox-api.types.js";
import { ProxmoxApiHttpError, ProxmoxApiTransportError } from "../errors/proxmox-resize.errors.js";
import { Logger } from "../../app/logger.js";

const LOG_PREFIX = "[ProxmoxApiClient]";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProxmoxEnvelope(body: unknown, context: { method: string; url: string }): ProxmoxJsonEnvelope<ProxmoxQemuResizeData> {
  if (!isPlainRecord(body) || !Object.prototype.hasOwnProperty.call(body, "data")) {
    throw new ProxmoxApiHttpError("Proxmox response missing `data` envelope field.", {
      status: 502,
      statusText: "Bad Gateway",
      method: context.method,
      url: context.url,
      responseBody: body,
      requestBody: {},
    });
  }
  const rawData: unknown = body["data"];
  let normalized: ProxmoxQemuResizeData;
  if (rawData === null) {
    normalized = null;
  } else if (typeof rawData === "string") {
    normalized = rawData;
  } else if (typeof rawData === "number" && Number.isFinite(rawData)) {
    normalized = String(rawData);
  } else {
    throw new ProxmoxApiHttpError("Proxmox `data` field has unexpected type for resize response.", {
      status: 502,
      statusText: "Bad Gateway",
      method: context.method,
      url: context.url,
      responseBody: body,
      requestBody: {},
    });
  }
  return { data: normalized };
}

function extractTaskUpid(envelope: ProxmoxJsonEnvelope<ProxmoxQemuResizeData>): string | null {
  const v = envelope.data;
  if (typeof v === "string" && v.startsWith("UPID:")) {
    return v;
  }
  return null;
}

function isRetryableAxiosError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false;
  }
  const code = String(error.code ?? "");
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND") {
    return true;
  }
  const status = error.response?.status;
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class ProxmoxApiClient {
  private readonly http: AxiosInstance;

  public constructor(private readonly config: ProxmoxResizeConfig) {
    this.http = axios.create({
      baseURL: `${this.config.PROXMOX_BASE_URL}/api2/json`,
      timeout: this.config.PROXMOX_HTTP_TIMEOUT_MS,
      headers: {
        Accept: "application/json",
        Authorization: `PVEAPIToken=${this.config.PROXMOX_TOKEN_ID}=${this.config.PROXMOX_TOKEN_SECRET}`,
      },
      httpsAgent: this.config.PROXMOX_INSECURE_TLS
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined,
      validateStatus: () => true,
    });
  }

  /**
   * Executes QEMU disk resize with retries on transient transport / gateway failures.
   */
  public async qemuResizeWithRetries(
    node: string,
    vmId: number,
    disk: string,
    size: string,
    method: "PUT" | "POST"
  ): Promise<ProxmoxQemuResizeResult> {
    const path = `/nodes/${encodeURIComponent(node)}/qemu/${vmId}/resize`;
    const form = new URLSearchParams();
    form.set("disk", disk);
    form.set("size", size);
    const requestBody: Record<string, string> = { disk, size };

    const maxAttempts = this.config.PROXMOX_RESIZE_MAX_RETRIES;
    const baseDelay = this.config.PROXMOX_RESIZE_RETRY_BASE_DELAY_MS;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.executeResizeOnce(path, method, form, requestBody);
      } catch (error: unknown) {
        lastError = error;
        const retryableAxios = isRetryableAxiosError(error);
        const retryableHttp =
          error instanceof ProxmoxApiHttpError &&
          [429, 502, 503, 504].includes(error.payload.status);
        if ((!retryableAxios && !retryableHttp) || attempt === maxAttempts) {
          throw error;
        }
        const backoff = baseDelay * 2 ** (attempt - 1);
        Logger.warn(
          `${LOG_PREFIX} transient error on resize attempt ${attempt}/${maxAttempts}, retrying in ${backoff}ms`,
          isAxiosError(error)
            ? { status: error.response?.status, code: error.code, message: error.message }
            : { message: String(error) }
        );
        await sleep(backoff);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new ProxmoxApiTransportError("Resize failed after retries with unknown error.", lastError);
  }

  private async executeResizeOnce(
    path: string,
    method: "PUT" | "POST",
    form: URLSearchParams,
    requestBody: Record<string, string>
  ): Promise<ProxmoxQemuResizeResult> {
    const url = `${this.config.PROXMOX_BASE_URL}/api2/json${path}`;
    try {
      const response = await this.http.request<unknown>({
        method,
        url: path,
        data: form,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const status = response.status;
      const statusText = response.statusText || "";

      if (status < 200 || status >= 300) {
        throw new ProxmoxApiHttpError(`Proxmox resize HTTP ${status} ${statusText}`, {
          status,
          statusText,
          method,
          url,
          responseBody: response.data,
          requestBody,
        });
      }

      const envelope = parseProxmoxEnvelope(response.data, { method, url });
      Logger.info(`${LOG_PREFIX} resize OK method=${method} url=${url} taskUpid=${extractTaskUpid(envelope) ?? "none"}`);
      return { raw: envelope, taskUpid: extractTaskUpid(envelope), methodUsed: method };
    } catch (error: unknown) {
      if (error instanceof ProxmoxApiHttpError) {
        throw error;
      }
      if (isAxiosError(error)) {
        if (error.response) {
          const st = error.response.status;
          const stText = error.response.statusText || "";
          throw new ProxmoxApiHttpError(`Proxmox resize HTTP ${st} ${stText}`, {
            status: st,
            statusText: stText,
            method,
            url,
            responseBody: error.response.data,
            requestBody,
          });
        }
        throw new ProxmoxApiTransportError(
          `Proxmox resize transport error: ${error.message}`,
          error
        );
      }
      throw new ProxmoxApiTransportError("Proxmox resize failed with non-Axios error.", error);
    }
  }
}
