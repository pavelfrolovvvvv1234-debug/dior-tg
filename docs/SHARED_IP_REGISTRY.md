# Shared IPv4 registry (bot + billing)

Both **TG-bot** and **dior-billing** must use the same table `network_ip_allocations` in the **same database**.  
That is the only source of truth for “this IP is taken” — no separate IP zones.

## Bot `.env`

```env
VM_PROVIDER=proxmox
SHARED_IP_DATABASE_URL=mysql://USER:PASS@HOST:3306/dior_billing
PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1
PROXMOX_NETWORK=45.74.7.0/24
PROXMOX_GATEWAY=45.74.7.1
```

`SHARED_IP_DATABASE_URL` can be `mysql://` or `postgres://`.  
If bot already uses the same Postgres as billing, you can omit it — bot falls back to `DATABASE_URL` when it is Postgres.

## Billing (dior-billing backend)

Before creating a VPS in Proxmox:

1. Start a DB transaction.
2. `SELECT ip FROM network_ip_allocations WHERE network = ? AND status IN ('reserved','active') FOR UPDATE` (or equivalent lock).
3. Pick a free IP (same subnet + scan Proxmox `ipconfig0` if you still do that).
4. `INSERT INTO network_ip_allocations (ip, network, owner, status, vmid, externalServiceId) VALUES (?, ?, 'billing', 'reserved', ?, ?)`.
5. Commit.
6. Write `ipconfig0` to Proxmox, then `UPDATE status = 'active'`.

On delete / release: `UPDATE ... SET status = 'released', releasedAt = NOW() WHERE vmid = ?`.

**Never** assign an IP only in Proxmox or only in billing DB — always insert into `network_ip_allocations` first.

## Table schema (MySQL)

See `migrations/20260627_network_ip_allocations.mysql.sql`.

## One-time sync (existing VMs)

On the bot server:

```bash
npm run sync:shared-ip-registry -- --dry-run
npm run sync:shared-ip-registry
```

Imports IPs from Proxmox `ipconfig0` + guest-agent into the shared table.

## Verify

After bot restart, create a test VPS — row must appear:

```sql
SELECT ip, owner, status, vmid FROM network_ip_allocations ORDER BY id DESC LIMIT 5;
```

Billing `sync-proxmox-used-ips` / next-free must skip those IPs.
