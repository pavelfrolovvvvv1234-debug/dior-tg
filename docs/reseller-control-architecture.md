# DIOR CONTROL — Reseller Operating System

Enterprise-style reseller management embedded in the Telegram admin bot (grammY + TypeORM). Stack matches the monolith: **SQLite/MySQL via TypeORM**, optional **Redis** later for rate limits; **not** a separate Nest/Prisma service in v1.

## Folder structure

```
src/
  entities/
    Reseller.ts
    ResellerApiKey.ts
    ResellerAuditLog.ts
  modules/reseller/
    domain/reseller-plans.ts
    rbac/reseller-permissions.ts
    services/
      reseller.service.ts
      reseller-stats.service.ts
      reseller-audit.service.ts
      reseller-crypto.ts
      reseller-auth-runtime.ts
    admin/reseller-admin-panel.ts
    conversations/reseller-onboarding.conversation.ts
  api/reseller-api.ts          # HTTP API (Express), uses auth runtime
docs/
  reseller-api.md
  reseller-control-architecture.md
  deploy-dior-host-reseller-api.md
```

## Telegram entry

**Admin → 🤝 Resellers** opens **DIOR CONTROL** hub:

| Section | Callback | RBAC |
|---------|----------|------|
| Dashboard | `ars:hub` | Admin, Mod (read) |
| Resellers list | `ars:l:{page}` | Admin, Mod |
| ➕ Add Reseller | `ars:add` → wizard | Admin only |
| API Keys | `ars:keys:0` | Admin |
| Services | `admin-resellers-services` | Admin |
| Finance / Analytics / Abuse / Logs / Security / System | `ars:fin` … | per role |

## Fast onboarding (<30s)

1. Telegram ID or `@username`
2. Plan: `starter` | `pro` | `enterprise`
3. Confirm `yes`

Auto: DB reseller, hashed API key, signing + webhook secrets (shown once), referral code, audit log, runtime API registration, optional DM to reseller.

**After `pm2 restart`:** paste keys from bot snippet into `.env` `RESELLER_API_KEYS_JSON` / `RESELLER_API_SIGNING_SECRETS_JSON`.

## API security

- Keys stored as **SHA-256** only in `reseller_api_keys`
- Live keys in `reseller-auth-runtime` (+ env merge) until restart
- Existing HMAC, nonce, IP allowlist, rate limit (reseller-api.ts)

## RBAC (v1)

| Role | Access |
|------|--------|
| Admin | Full |
| Moderator | Hub, list, detail, analytics, abuse view, logs |
| User | None |

Future: `StaffPermission` table for Owner / Finance / Abuse Team granular flags.

## Phase 2 (not in v1)

- Prisma + MySQL migration path
- Redis rate limit / idempotency
- CPU/RAM/bandwidth from Proxmox/VMManager
- Webhook delivery queue + retries
- Anomaly detection in Abuse Center
- 2FA for sensitive admin actions

## Deployment

Same VPS as bot (`/root/dior-tg`). Enable `RESELLER_API_ENABLED=1`, nginx `api.dior.host` → `:3003`. See `deploy-dior-host-reseller-api.md`.
