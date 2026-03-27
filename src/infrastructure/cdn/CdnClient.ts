/**
 * Client for CDN / proxy-service Bot API.
 * Used to create reverse proxies and list them by Telegram user ID.
 *
 * @module infrastructure/cdn/CdnClient
 */

const getBaseUrl = (): string => {
  const url = process.env.CDN_BASE_URL ?? "";
  return String(url).replace(/\/$/, "");
};

const getApiKey = (): string => {
  return process.env.CDN_BOT_API_KEY ?? "";
};

export interface CdnPriceResponse {
  success: boolean;
  data?: { price: number; currency: string };
  error?: string;
}

export interface CdnCreateProxyResponse {
  success: boolean;
  data?: {
    id: string;
    domain_name: string;
    target_url: string;
    status: string;
    server_ip?: string;
    expires_at?: string;
  };
  cost?: number;
  error?: string;
  code?: string;
}

export interface CdnProxyItem {
  id: string;
  domain_name: string;
  target_url: string | null;
  status: string;
  lifecycle_status: string;
  server_ip: string | null;
  expires_at: string | null;
  created_at: string;
  auto_renew?: boolean;
}

export interface CdnListProxiesResponse {
  success: boolean;
  data?: CdnProxyItem[];
  error?: string;
}

export interface CdnActionResponse {
  success: boolean;
  error?: string;
  code?: string;
}

/**
 * Fetch CDN API with Bot API key.
 */
async function cdnFetch<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown>; headers?: Record<string, string> } = {}
): Promise<T> {
  const base = getBaseUrl();
  const key = getApiKey();
  if (!base || !key) {
    throw new Error("CDN_BASE_URL and CDN_BOT_API_KEY must be set");
  }

  const { method = "GET", body, headers: customHeaders } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Bot-Api-Key": key,
    ...((customHeaders as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? `CDN API ${res.status}`);
    (err as any).status = res.status;
    (err as any).code = (data as { code?: string }).code;
    throw err;
  }
  return data as T;
}

/**
 * Get proxy price (USD) from CDN service.
 */
export async function cdnGetPrice(): Promise<number> {
  const out = await cdnFetch<CdnPriceResponse>("/api/bot/price");
  if (!out.success || out.data?.price == null) {
    throw new Error(out.error ?? "Failed to get CDN price");
  }
  return Number(out.data.price);
}

/**
 * Create a reverse proxy for the given Telegram user (payment already taken by bot).
 */
export async function cdnCreateProxy(params: {
  telegramId: number;
  username?: string;
  domainName: string;
  targetUrl: string;
  description?: string;
  forceHttps?: boolean;
  hostHeader?: "incoming" | "target";
  cachingEnabled?: boolean;
}): Promise<CdnCreateProxyResponse> {
  return cdnFetch<CdnCreateProxyResponse>("/api/bot/create-proxy", {
    method: "POST",
    body: {
      telegramId: params.telegramId,
      username: params.username,
      domainName: params.domainName,
      targetUrl: params.targetUrl,
      description: params.description,
      forceHttps: params.forceHttps ?? true,
      hostHeader: params.hostHeader ?? "incoming",
      cachingEnabled: params.cachingEnabled ?? false,
    },
  });
}

/**
 * List reverse proxies for the given Telegram user.
 */
export async function cdnListProxies(telegramId: number): Promise<CdnProxyItem[]> {
  const out = await cdnFetch<CdnListProxiesResponse>(
    `/api/bot/proxies?telegramId=${encodeURIComponent(telegramId)}`
  );
  if (!out.success) {
    throw new Error(out.error ?? "Failed to list CDN proxies");
  }
  return out.data ?? [];
}

async function tryAction(
  attempts: Array<{
    path: string;
    method?: string;
    body?: Record<string, unknown>;
  }>
): Promise<boolean> {
  for (const attempt of attempts) {
    try {
      const out = await cdnFetch<CdnActionResponse>(attempt.path, {
        method: attempt.method ?? "POST",
        body: attempt.body,
      });
      if (out.success) return true;
    } catch {
      // Try next variant.
    }
  }
  return false;
}

export async function cdnRenewProxy(proxyId: string, telegramId: number): Promise<boolean> {
  return tryAction([
    {
      path: `/api/bot/proxy/${encodeURIComponent(proxyId)}/renew`,
      method: "POST",
      body: { telegramId },
    },
    {
      path: `/api/bot/renew-proxy`,
      method: "POST",
      body: { proxyId, telegramId },
    },
  ]);
}

export async function cdnToggleAutoRenew(
  proxyId: string,
  telegramId: number,
  enabled: boolean
): Promise<boolean> {
  return tryAction([
    {
      path: `/api/bot/proxy/${encodeURIComponent(proxyId)}/auto-renew`,
      method: "POST",
      body: { enabled, telegramId },
    },
    {
      path: `/api/bot/toggle-auto-renew`,
      method: "POST",
      body: { proxyId, enabled, telegramId },
    },
  ]);
}

export async function cdnRetrySsl(proxyId: string, telegramId: number): Promise<boolean> {
  return tryAction([
    {
      path: `/api/bot/proxy/${encodeURIComponent(proxyId)}/retry-ssl`,
      method: "POST",
      body: { telegramId },
    },
    {
      path: `/api/bot/proxy/${encodeURIComponent(proxyId)}/retry-issuance`,
      method: "POST",
      body: { telegramId },
    },
  ]);
}

export async function cdnDeleteProxy(proxyId: string, telegramId: number): Promise<boolean> {
  return tryAction([
    {
      path: `/api/bot/proxy/${encodeURIComponent(proxyId)}?telegramId=${encodeURIComponent(
        telegramId
      )}`,
      method: "DELETE",
    },
    {
      path: `/api/bot/delete-proxy`,
      method: "POST",
      body: { proxyId, telegramId },
    },
  ]);
}
