# Reseller API

Production base URL:

- `https://api.dior.host`

Reference:

- `GET /reseller/openapi.json`
- `GET /reseller/docs`

## Required headers

- `x-api-key`: reseller API key

## Recommended security headers

- `x-timestamp`: unix seconds
- `x-nonce`: random UUID (one-time)
- `x-signature`: `hex(HMAC_SHA256(secret, "<timestamp>.<raw_json_body>"))`
- `x-idempotency-key`: unique logical operation key for POST retries

## Endpoints

### `POST /reseller/v1/services/create` — поля тела (JSON)

**Обязательные**

- `rateName` — тариф (как в вашем прайсе, например `Lite 1`).
- `clientExternalId` — строка: ваш внутренний id клиента у реселлера (до 128 символов).

**Необязательные**

- `osId` — число, шаблон ОС в Proxmox. **Можно не передавать:** тогда подставляется значение по умолчанию (**900** в текущей сборке).
- `name` — имя ВМ; если не указано — генерируется автоматически.
- `displayName` — подпись услуги в боте; если не указано — берётся `clientExternalId`.

### Маршруты

- `GET /reseller/health`
- `GET /reseller/v1/services`
- `POST /reseller/v1/services/create`
- `POST /reseller/v1/services/import-existing`
- `GET /reseller/v1/services/:id`
- `POST /reseller/v1/services/:id/actions/:action`

Action values:

- `start`
- `stop`
- `reboot`
- `reset-password`
- `set-password`
- `renew`
- `reinstall`

## Isolation model

API key is bound to one `reseller_id`; data is isolated by `resellerId`.

## Webhook events

- `service_created`
- `service_imported`
- `service_started`
- `service_stopped`
- `service_rebooted`
- `service_password_reset`
- `service_password_set`
- `service_renewed`
- `service_reinstall_started`

Webhook signing (optional) uses the same timestamp/signature scheme.

## Response metadata

- `x-request-id` header in all responses
- `idempotentReplay: true` in body on successful idempotency cache replay

## Partner integration example (Node.js)

```js
import crypto from "crypto";
import axios from "axios";

const baseUrl = "https://api.dior.host";
const apiKey = process.env.DIOR_RESELLER_API_KEY;
const signSecret = process.env.DIOR_RESELLER_SIGN_SECRET;

function sign(ts, body) {
  return crypto
    .createHmac("sha256", signSecret)
    .update(`${ts}.${body}`)
    .digest("hex");
}

async function createService() {
  const payload = {
    rateName: "Lite 1",
    clientExternalId: "client_123",
    osId: 900,
    name: "client123-vps",
  };

  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const idem = crypto.randomUUID();

  const res = await axios.post(`${baseUrl}/reseller/v1/services/create`, payload, {
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "x-timestamp": ts,
      "x-nonce": nonce,
      "x-signature": sign(ts, body),
      "x-idempotency-key": idem,
    },
    timeout: 20000,
  });

  return res.data;
}
```
