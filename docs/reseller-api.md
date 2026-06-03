# Reseller API

Production base URL:

- `https://api.dior.host`

Reference (enable `RESELLER_API_EXPOSE_DOCS=1`):

- `GET /reseller/openapi.json` — OpenAPI 3 with request/response schemas
- `GET /reseller/docs`
- `GET /reseller/v1/errors` — machine-readable error codes
- `GET /reseller/v1/webhooks/events` — webhook event names

## Auth headers

| Header | Required | Description |
|--------|----------|-------------|
| `x-api-key` | yes | Reseller API key |
| `x-timestamp` | yes | Unix seconds |
| `x-nonce` | yes | One-time UUID |
| `x-signature` | yes | `hex(HMAC_SHA256(secret, "<timestamp>.<raw_json_body>"))` |
| `x-idempotency-key` | recommended | Unique key for POST retries (create, import, reinstall) |

All JSON responses include `x-request-id`. On idempotent replay: `"idempotentReplay": true`.

Parallel duplicate POSTs with the same idempotency key receive `409 idempotency_request_in_progress` until the first call finishes.

**Production:** configure `REDIS_URL` so idempotency and nonce keys survive restarts and work with multiple API workers. Wallet ledger table `reseller_wallet_transactions` is created automatically on API startup if missing.

## Catalog

### `GET /reseller/v1/plans`

List VPS tariffs from the reseller price list (bulletproof pricing used for API create/renew).

**Response `items[]`:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Plan name, e.g. `Lite 1` |
| `cpu` | int | vCPU |
| `ramGb` | int | RAM |
| `diskGb` | int | SSD |
| `networkMbps` | int | Port speed |
| `createPriceUsd` | number | Debited on create (30 days) |
| `renewPriceUsd` | number | Per month on renew |

### `GET /reseller/v1/locations`

**Response `items[]`:** `key`, `labelKey` (FTL key for UI), `tier` (`standard` \| `bulletproof`), `automatedProvisioning` (only `nl-amsterdam` is auto on Proxmox).

### `GET /reseller/v1/os-templates`

**Response `items[]`:** `osId` (Proxmox template VMID), `osKey`, `name`, optional `minRamMib`, `repository`.

---

## Billing

### `GET /reseller/v1/billing/balance`

```json
{ "ok": true, "balanceUsd": 120.5, "currency": "USD", "requestId": "..." }
```

Wallet is the Telegram user linked to the reseller in DIOR CONTROL.

### `GET /reseller/v1/billing/transactions?limit=50`

Unified history: **wallet debits** (`service_create`, `service_renew` with `amountUsd` negative) and **completed bot top-ups** (`balance_topup`, positive).

### `GET /reseller/v1/billing/ledger?limit=50`

Recent rows from `reseller_audit_log` (DIOR CONTROL actions only).

Create/renew prices: see `GET /reseller/v1/plans` (`createPriceUsd`, `renewPriceUsd`). Next charge date = service `billing.nextChargeAt` / `expireAt`.

---

## Services

### Service object (list & detail)

| Field | Description |
|-------|-------------|
| `serviceId` | Internal DB id (use in URL `:id`) |
| `vmid` | Hypervisor VMID |
| `status` | `online` \| `offline` \| `suspended` \| `installing` \| `error` |
| `hypervisorState` | Raw state: `active`, `stopped`, `creating`, … |
| `ip` / `ipv4[]` | Primary IPv4 |
| `resources` | `cpu`, `ramGb`, `diskGb`, `networkMbps`, optional live `vmCpu`, `vmRamMib` |
| `traffic.limitMbps` | Plan port cap; byte counters → `GET .../metrics` |
| `location` | `key`, `node` |
| `billing.renewalPriceUsd`, `billing.nextChargeAt`, `billing.autoRenewEnabled` |
| `expireAt`, `createdAt`, `updatedAt` |
| `flags.isBlocked` | Admin or subscription lock |

### `POST /reseller/v1/services/create`

**Body (JSON):**

| Field | Required | Description |
|-------|----------|-------------|
| `rateName` | yes | From `GET /plans`, e.g. `Lite 1` |
| `clientExternalId` | yes | Your customer id (≤128 chars) |
| `osId` | no | Template VMID; default **900** |
| `name` | no | VM hostname |
| `displayName` | no | Label; default = `clientExternalId` |

**Response 200:**

```json
{
  "ok": true,
  "item": { "...service object..." },
  "credentials": { "login": "root", "password": "..." },
  "requestId": "..."
}
```

**Errors:** `402 insufficient_balance` (+ webhook `payment_failed`), `400 unknown_rate_name`, `502 vm_create_failed`, `409 idempotency_key_body_mismatch`.

### `POST /reseller/v1/services/import-existing`

| Field | Required |
|-------|----------|
| `vmid` | yes |
| `rateName` | yes |
| `clientExternalId` | yes |
| `expireAt` | yes (ISO 8601) |
| `ip`, `osId`, `displayName` | no |

### `GET /reseller/v1/services` / `GET /reseller/v1/services/:id`

List (max 500) or single service with live status/resources when hypervisor is reachable.

### `GET /reseller/v1/services/:id/metrics`

```json
{
  "ok": true,
  "metrics": {
    "cpuUsagePercent": 12.5,
    "ramUsedMib": 512,
    "ramTotalMib": 1024,
    "ramUsagePercent": 50,
    "diskUsedBytes": 1000000000,
    "diskTotalBytes": 20000000000,
    "diskUsagePercent": 5,
    "networkInBytes": 12345,
    "networkOutBytes": 67890,
    "uptimeSec": 86400,
    "sampledAt": "2026-06-03T12:00:00.000Z"
  }
}
```

Available on **Proxmox** (`VM_PROVIDER=proxmox`). Otherwise `metrics` may be `null`.

### Network (Proxmox)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/services/:id/network` | `ipv4[]`, `dns.nameservers`, `firewall[]` |
| PUT | `/services/:id/network/dns` | Body: `{ "nameservers": ["1.1.1.1","8.8.8.8"] }` |
| GET | `/services/:id/firewall` | List VM firewall rules |
| PUT | `/services/:id/firewall` | Body: `{ "rules": [{ "action":"ACCEPT","type":"in","proto":"tcp","dport":"22" }] }` |
| POST | `/services/:id/network/ipv4` | Assigns `ipconfig1` from bridge pool |
| POST | `/services/:id/network/reset` | Re-applies cloud-init network; refreshes IP in DB |

### Console & access

| Method | Path | Notes |
|--------|------|-------|
| GET | `/services/:id/console` | Proxmox VNC: `ticket`, `port`, `websocketUrl`, `expiresAt` (~5 min) |
| POST | `/services/:id/password/reset` | New root password in `credentials` |
| POST | `/services/:id/ssh-keys` | Body: `{ "keys": ["ssh-ed25519 AAAA..."] }` (cloud-init) |

### Reinstall

**Preferred:** `POST /reseller/v1/services/:id/reinstall`

**Body:**

```json
{ "osId": 900, "password": "optional-min-8-chars", "sshKey": "ssh-ed25519 AAAA... optional" }
```

Supports `x-idempotency-key`. Webhooks: `service_reinstall_started`, `service_reinstall_completed`.

**Legacy:** `POST /services/:id/actions/reinstall` with `{ "osId": N }`.

### Snapshots / backups (Proxmox)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/services/:id/snapshots` | List snapshots |
| POST | `/services/:id/snapshots` | Body: `{ "name?", "description?" }` |
| DELETE | `/services/:id/snapshots/:snapname` | Delete snapshot |
| POST | `/services/:id/snapshots/:snapname/restore` | Rollback |
| POST | `/services/:id/backups` | Starts `vzdump` (202 + `taskId`); webhook `backup_completed` when done |

Requires `PROXMOX_STORAGE` for backups.

### Actions (legacy)

`POST /reseller/v1/services/:id/actions/:action`

| action | Body |
|--------|------|
| `start`, `stop`, `reboot` | — |
| `reset-password` | — |
| `set-password` | `{ "password": "..." }` |
| `renew` | `{ "months": 1\|3\|6\|12 }` optional |
| `reinstall` | `{ "osId", "password", "sshKey" }` optional |
| `delete` | — irreversible |

### `POST /reseller/v1/services/delete-by-ip`

Body: `{ "ip": "1.2.3.4" }` (IPv4).

---

## Webhooks

Configure URL per reseller (`RESELLER_WEBHOOKS_JSON` or DIOR CONTROL). Optional signing secret.

| Event | When |
|-------|------|
| `service_created` | VPS created |
| `service_imported` | Existing VM attached |
| `service_deleted` | VPS removed |
| `service_status_changed` | Start/stop (`data.status`: `online` / `offline`) |
| `service_started`, `service_stopped`, `service_rebooted` | Power actions |
| `service_password_reset`, `service_password_set` | Password |
| `service_renewed` | Period extended |
| `service_reinstall_started`, `service_reinstall_completed` | Reinstall |
| `payment_failed` | Create/renew with insufficient balance |
| `backup_completed` | Reserved (not emitted until backup API exists) |

Payload shape:

```json
{
  "event": "service_created",
  "resellerId": "r_abc",
  "timestamp": "2026-06-03T12:00:00.000Z",
  "data": { "...service fields..." }
}
```

---

## HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Validation / unknown action |
| 401 | Auth / signature |
| 402 | Insufficient balance |
| 403 | Invalid key / IP / reseller setup |
| 404 | Service not found |
| 409 | Nonce replay / idempotency conflict / ambiguous IP |
| 429 | Rate limit (`retryAfterSec`) |
| 501 | Feature not on current hypervisor |
| 502 | Upstream (Proxmox) failure (`upstreamStatus` when available) |
| 503 | Signing secret missing |

---

## Example (Node.js)

```js
import crypto from "crypto";
import axios from "axios";

const baseUrl = "https://api.dior.host";
const apiKey = process.env.DIOR_RESELLER_API_KEY;
const signSecret = process.env.DIOR_RESELLER_SIGN_SECRET;

function sign(ts, body) {
  return crypto.createHmac("sha256", signSecret).update(`${ts}.${body}`).digest("hex");
}

async function createService() {
  const payload = {
    rateName: "Lite 1",
    clientExternalId: "client_123",
    osId: 900,
  };

  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));

  const res = await axios.post(`${baseUrl}/reseller/v1/services/create`, payload, {
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "x-timestamp": ts,
      "x-nonce": crypto.randomUUID(),
      "x-signature": sign(ts, body),
      "x-idempotency-key": crypto.randomUUID(),
    },
    timeout: 120000,
  });

  return res.data;
}
```

Isolation: API key → one `reseller_id`; only that reseller's `resellerId` rows are visible.
