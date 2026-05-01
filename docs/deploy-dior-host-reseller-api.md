# DiorHost + Reseller API Deployment

This guide deploys:

- `dior.host` -> website (existing project)
- `api.dior.host` -> reseller API (this bot project)

## 1) DNS

Create DNS records:

- `A dior.host -> <WEB_SERVER_IP>`
- `A api.dior.host -> <BOT_SERVER_IP>`

If both projects are on one server, both can point to same IP.

## 2) Environment (`/root/dior-tg/.env`)

Add reseller API settings:

```env
RESELLER_API_ENABLED=1
RESELLER_API_PORT=3003

RESELLER_API_KEYS_JSON={"partner_a":"CHANGE_ME_STRONG_API_KEY"}
RESELLER_API_SIGNING_SECRETS_JSON={"partner_a":"CHANGE_ME_HMAC_SECRET"}
RESELLER_API_ALLOWED_IPS_JSON={"partner_a":["203.0.113.10"]}

RESELLER_WEBHOOKS_JSON={"partner_a":"https://partner-a.com/webhooks/dior"}
RESELLER_WEBHOOK_SECRETS_JSON={"partner_a":"CHANGE_ME_WEBHOOK_SECRET"}

RESELLER_API_RATE_WINDOW_SEC=60
RESELLER_API_RATE_MAX=120
RESELLER_API_MAX_SKEW_SECONDS=300
RESELLER_API_IDEMPOTENCY_TTL_SEC=3600
```

## 3) Nginx for `api.dior.host`

Create file `/etc/nginx/sites-available/api.dior.host`:

```nginx
server {
    listen 80;
    server_name api.dior.host;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/api.dior.host /etc/nginx/sites-enabled/api.dior.host
nginx -t && systemctl reload nginx
```

## 4) SSL (Let's Encrypt)

```bash
apt update
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.dior.host -m admin@dior.host --agree-tos --no-eff-email --redirect
```

## 5) Deploy bot/api process

```bash
cd /root/dior-tg
git pull origin main
npm install
npm run build
pm2 restart all
pm2 save
```

## 6) Smoke tests

```bash
curl -s https://api.dior.host/reseller/health
curl -s https://api.dior.host/reseller/docs
curl -s https://api.dior.host/reseller/openapi.json
```

Expected:

- `reseller/health` -> `{"ok":true,"service":"reseller-api"}`
- `reseller/openapi.json` -> OpenAPI JSON

## 7) Security checklist

- Keep port `3003` closed from public internet (proxy only via Nginx 443).
- Use long random values for API/HMAC/webhook secrets.
- Keep partner IP allowlist enabled.
- Rotate keys periodically.
