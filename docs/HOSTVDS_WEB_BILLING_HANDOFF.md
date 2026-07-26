# HostVDS → Web Billing Handoff

Документ для переноса **автовыдачи обычных (standard) VPS через HostVDS OpenStack** в другой проект (веб-биллинг).  
Абузоустойчивые (Proxmox / bulletproof) **не трогать** — отдельный путь.

Источник истины в Telegram-боте: `src/infrastructure/hostvds/*`, shop-flow `createStandardVpsOrderHostVds`, pricing `src/domain/vds/standard-vps-pricing.ts`.

---

## 1. Что должно получиться в веб-биллинге

После оплаты ordinary VPS:

1. Списать баланс / подтвердить платёж (идемпотентно).
2. Создать VM в HostVDS (Nova).
3. Дождаться `ACTIVE` + IPv4.
4. Убедиться, что TCP/22 открыт (security group + cloud-init).
5. Сохранить в БД: UUID HostVDS, IP, login `root`, пароль, тариф, срок, hypervisor=`hostvds`.
6. Показать клиенту ready-экран (IP / login / password / SSH).
7. При любой ошибке после create — **удалить orphan VM** и вернуть деньги / откатить заказ.
8. Day-2: start / stop / reboot / delete / (опционально reinstall) через тот же OpenStack API.

Bulletproof / Proxmox / тикеты — **без изменений**.

---

## 2. Критические уроки (иначе «не логинится / Flavor not found»)

| # | Проблема | Правило |
|---|----------|---------|
| 1 | UUID flavor/image/network **разные в каждом регионе** | В конфиге хранить **имена** (`hostvds-1`, `Ubuntu-24.04-amd64`, `Internet-03`), резолвить в UUID через API **активного региона** |
| 2 | `adminPass` Nova **не ставит** пароль на Ubuntu cloud | Всегда слать **cloud-init user_data** (chpasswd + PermitRootLogin + PasswordAuthentication) |
| 3 | SG `default` **не пускает SSH с интернета** | На create вешать `allow_all` (или свою SG с TCP/22 0.0.0.0/0) |
| 4 | ACTIVE ≠ SSH готов | После ACTIVE ждать TCP/22 (+ небольшой settle ~15s) |
| 5 | UI-локация ≠ регион OpenStack | Пока один `HOSTVDS_REGION_NAME` (напр. `eu-west2`); geo-кнопки — UX/stock, не переключают Nova, пока нет map location→region/network |
| 6 | Create **никогда** не оборачивать в retry | Таймаут сети → дубль VM; retry только на GET/resolve |
| 7 | Auth URL | `https://os-api.hostvds.com/identity/v3` (нужен `/v3`) |

---

## 3. OpenStack API (HostVDS)

### Auth (Keystone)

- `POST {AUTH_URL}/auth/tokens`
- Header ответа: `X-Subject-Token`
- Scope: project name + domain `Default`
- Catalog → endpoints `public` для региона: `compute`, `image`, `network`

### Compute (Nova)

- `GET /flavors/detail`
- `GET /servers/{id}`
- `POST /servers` — create **один раз**
- `POST /servers/{id}/action` — `os-start`, `os-stop`, `addSecurityGroup`, `rebuild`
- `DELETE /servers/{id}`

### Image (Glance)

- `GET /v2/images?limit=200`

### Network (Neutron)

- `GET /v2.0/networks`
- `GET /v2.0/security-groups`

### Create body (минимум)

```json
{
  "server": {
    "name": "hostname",
    "imageRef": "<uuid>",
    "flavorRef": "<uuid>",
    "networks": [{ "uuid": "<network-uuid>" }],
    "adminPass": "<password>",
    "user_data": "<base64 cloud-init>",
    "security_groups": [{ "name": "allow_all" }],
    "metadata": {
      "managed_by": "web_billing",
      "os_key": "ubuntu2404",
      "rate_id": "0",
      "user_id": "123"
    }
  }
}
```

### Cloud-init (обязателен)

```yaml
#cloud-config
ssh_pwauth: true
disable_root: false
chpasswd:
  expire: false
  users:
    - name: root
      password: 'PLAINTEXT_PASSWORD'
      type: text
users:
  - name: root
    lock_passwd: false
    ssh_pwauth: true
write_files:
  - path: /etc/ssh/sshd_config.d/99-billing.conf
    permissions: '0644'
    content: |
      PermitRootLogin yes
      PasswordAuthentication yes
      KbdInteractiveAuthentication yes
runcmd:
  - bash -lc "echo 'root:PLAINTEXT_PASSWORD' | chpasswd"
  - bash -lc "systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null || true"
```

Пароль: alphanumeric (без YAML-спецсимволов) или экранировать.

### Resolve helpers (обязательны)

```
resolveFlavor(nameOrUuid)  → list flavors in region → by id OR by name → else error
resolveImage(nameOrUuid)   → same for Glance
resolveNetwork(nameOrUuid) → same for Neutron
```

Никогда не доверять UUID «вслепую» без проверки списка региона.

---

## 4. Регион `eu-west2` — рабочие имена (проверено)

**Не копировать UUID из другого региона.**

### Flavors (имя → типичные спеки)

| Name | vCPU | RAM | Disk |
|------|------|-----|------|
| `hostvds-1` | 1 | 1 GB | 10 |
| `hostvds-2` | 1 | 2 GB | 20 |
| `hostvds-4` | 2 | 4 GB | 40 |
| `hostvds-8` | 2 | 8 GB | 80 |
| `hostvds-16` | 4 | 16 GB | 160 |
| `highload-1` | 1 | 4 GB | 30 |
| `highload-2` | 2 | 8 GB | 50 |
| `highload-4` | 4 | 16 GB | 80 |
| `highload-8` | 8 | 32 GB | 160 |
| `highload-16` | 16 | 64 GB | 320 |
| `highload-24` | 24 | 96 GB | 480 |

### Images (имена)

`Ubuntu-24.04-amd64`, `Ubuntu-22.04-amd64`, `Debian-13-amd64`, `Debian-12-amd64`, `Debian-11-amd64`, `AlmaLinux-8-amd64`, `AlmaLinux-9-amd64`, `RockyLinux-9-amd64`, `CentOS-9-amd64`

### Network

Имя: `Internet-03` (или другой `Internet-XX` из `GET /v2.0/networks` в том же регионе).

### Security group

`allow_all` — ingress/egress 0.0.0.0/0 и ::/0.  
`default` — **не использовать одной** для публичного SSH.

---

## 5. Пример env (шаблон, без секретов)

Скопировать из HostVDS `openrc.sh` / API credentials:

```env
HOSTVDS_AUTH_URL=https://os-api.hostvds.com/identity/v3
HOSTVDS_USERNAME=<from openrc OS_USERNAME>
HOSTVDS_PASSWORD=<from openrc>
HOSTVDS_PROJECT_NAME=<from openrc OS_PROJECT_NAME>
HOSTVDS_USER_DOMAIN_NAME=Default
HOSTVDS_PROJECT_DOMAIN_NAME=Default
HOSTVDS_REGION_NAME=eu-west2

HOSTVDS_NETWORK_ID=Internet-03
HOSTVDS_SECURITY_GROUPS=allow_all

HOSTVDS_IMAGE_MAP={"ubuntu2404":"Ubuntu-24.04-amd64","ubuntu2204":"Ubuntu-22.04-amd64","debian13":"Debian-13-amd64","debian12":"Debian-12-amd64","debian11":"Debian-11-amd64","alma8":"AlmaLinux-8-amd64","alma9":"AlmaLinux-9-amd64","rockylinux":"RockyLinux-9-amd64","centos9":"CentOS-9-amd64"}

HOSTVDS_FLAVOR_MAP={"0":"hostvds-1","1":"hostvds-2","2":"hostvds-4","3":"hostvds-8","4":"hostvds-16","5":"highload-4","6":"highload-8","7":"highload-16","8":"highload-24","9":"highload-24"}

HOSTVDS_POLL_INTERVAL_MS=5000
HOSTVDS_POLL_TIMEOUT_MS=600000
HOSTVDS_SSH_READY_TIMEOUT_MS=180000
HOSTVDS_INSECURE_TLS=0

# Pricing (EUR cost → sell)
HOSTVDS_COST_EUR_MAP={"0":0.99,"1":1.99,"2":3.99,"3":7.99,"4":15.99,"5":19.99,"6":39.99,"7":79.99,"8":119.99,"9":159.99}
HOSTVDS_EUR_USD=1
```

Aliases `OS_*` из openrc тоже ок, если маппишь их в код.

**Важно:** у каждого `rateId` своя себестоимость (и по возможности свой flavor), иначе в каталоге дублируются цены (Lite2=Lite3 и т.д.).

---

## 6. Pricing (standard only)

Себестоимость в **EUR**, наценка, продажа в валюте биллинга (у бота — USD, курс `HOSTVDS_EUR_USD`, default `1`):

| Cost EUR | Markup | Multiplier |
|----------|--------|------------|
| `[0, 2)` | +120% | ×2.2 |
| `[2, 4)` | +100% | ×2.0 |
| `[4, 10)` | +70% | ×1.7 |
| `[10, ∞)` | +50% | ×1.5 |

```
sell = round(costEur * (1 + markup) * EUR_USD)
```

Уникальная лестница (EUR_USD=1):  
Lite1→$2, Lite2→$4, Lite3→$8, Elite1→$14, Elite2→$24, Elite3→$30, Mega1→$60, Mega2→$120, Mega3→$180, Mega4→$240.

Bulletproof цены **не** из этой формулы.

---

## 7. Shop catalog (пример тарифов бота)

| rateId | Name | Spec (marketing) | Flavor | Cost EUR | Sell $ |
|--------|------|------------------|--------|----------|--------|
| 0 | Lite 1 | 1C/1G/10G | hostvds-1 | 0.99 | 2 |
| 1 | Lite 2 | 2C/2G/40G | hostvds-2 | 1.99 | 4 |
| 2 | Lite 3 | 2C/4G/50G | hostvds-4 | 3.99 | 8 |
| 3 | Elite 1 | 4C/8G/80G | hostvds-8 | 7.99 | 14 |
| 4 | Elite 2 | 8C/16G/150G | hostvds-16 | 15.99 | 24 |
| 5 | Elite 3 | 8C/24G/200G | highload-4 | 19.99 | 30 |
| 6 | Mega 1 | 12C/32G/250G | highload-8 | 39.99 | 60 |
| 7 | Mega 2 | 16C/64G/300G | highload-16 | 79.99 | 120 |
| 8 | Mega 3 | 24C/96G/500G | highload-24 | 119.99 | 180 |
| 9 | Mega 4 | 24C/128G/700G | highload-24 | 159.99 | 240 |

Замечание: marketing-спеки и реальные flavor не всегда 1:1. Mega4 = max flavor как Mega3, но выше cost для уникальной цены.

Login для Linux: `root`. Windows в HostVDS public images обычно нет.

---

## 8. Модель данных (минимум для биллинга)

```
Service / VpsInstance
  - id (local)
  - userId
  - provider: "hostvds" | "proxmox" | ...
  - providerServerId: OpenStack UUID   // обязательно
  - hostname
  - ipv4
  - login: "root"
  - password (encrypted at rest)
  - osKey
  - planId / rateId
  - region: "eu-west2"
  - status: provisioning | active | suspended | deleted | error
  - expiresAt
  - renewalPrice
  - metadata JSON
```

Локальный numeric id (если нужен): отдельный sequence; **не** пихать UUID в int-поле Proxmox VMID. В боте: `HOSTVDS_LOCAL_VMID_BASE = 2100000000`.

---

## 9. Order lifecycle (рекомендуемый)

```
PAID (idempotent)
  → status=provisioning
  → provisionHostVds()
       resolve image/flavor/network by NAME in region
       createServer ONCE + security_groups + cloud-init
       wait ACTIVE + IPv4
       wait TCP 22
  → save DB
  → status=active + notify user
ON ERROR after Nova accept:
  → deleteServer(uuid) best-effort
  → refund / fail order
  → never leave orphan
ON DB save fail after success:
  → deleteServer(uuid)
  → refund
```

Параллельные заказы одного юзера: mutex / unique provisioning lock.

---

## 10. Day-2 ops

| Action | API |
|--------|-----|
| Start | `os-start` |
| Stop | `os-stop` |
| Delete | `DELETE /servers/{id}` + soft-delete в БД |
| Reinstall | `rebuild` + тот же cloud-init/password (или новый пароль → обновить БД) |
| Password change | лучше rebuild/cloud-init; Nova changePassword на cloud images часто бесполезен |

Маршрутизация: `if provider==hostvds → OpenStack client else → Proxmox`.

---

## 11. Stock / локации (опционально)

В боте UX-каталог `hostvds-catalog.json`: location keys + `available|sold_out|unavailable`.  
Сортировка: доступные сверху, 🔒 снизу.  
Это **не** OpenStack AZ (AZ часто просто `nova`).

---

## 12. Reference code в боте (для копирования логики)

| Module | Path |
|--------|------|
| Config | `src/infrastructure/hostvds/hostvds-config.ts` |
| OpenStack client | `src/infrastructure/hostvds/openstack-client.ts` |
| Provisioner | `src/infrastructure/hostvds/HostVdsProvisioner.ts` |
| Day-2 provider | `src/infrastructure/hostvds/HostVdsProvider.ts` |
| Routing | `src/infrastructure/hostvds/RoutingVmProvider.ts` |
| Shop order | `src/domain/vds/vds-shop-flow.ts` → `createStandardVpsOrderHostVds` |
| Pricing | `src/domain/vds/standard-vps-pricing.ts` |
| Costs | `src/config/hostvds-standard-costs.json` |
| Stock UI | `src/config/hostvds-catalog.json` |

Репозиторий бота: `dior-tg` (GitHub). Можно переиспользовать клиент как пакет/скопировать модули.

---

## 13. Acceptance checklist

- [ ] Auth Keystone OK, region `eu-west2` endpoints
- [ ] list flavors/images/networks — имена находятся
- [ ] create + ACTIVE + IPv4
- [ ] SG `allow_all` → TCP 22 open снаружи
- [ ] SSH `root` + password из заказа (WinSCP/ssh)
- [ ] fail mid-way → VM deleted, money refunded
- [ ] bulletproof path untouched
- [ ] prices: EUR cost × markup tiers
- [ ] idempotent pay + no double create
- [ ] delete from panel removes OpenStack server

---

# CURSOR PROMPT (скопировать в веб-биллинг)

Ниже готовый промпт для Cursor Agent в репозитории веб-биллинга.

````text
Ты внедряешь автовыдачу ОБЫЧНЫХ (standard) VPS через HostVDS OpenStack в этот веб-биллинг.

## Жёсткие правила
1. НЕ ломать существующую выдачу абузоустойчивых / Proxmox / ручные тикеты.
2. HostVDS только для standard VPS.
3. UUID flavor/image/network НЕ хардкодить — только NAMES, resolve через API активного региона.
4. Create server ровно 1 раз (без retry). Retry только для GET/auth/resolve.
5. После любой ошибки после accept create — delete orphan VM + rollback оплаты/заказа.
6. Обязательно: security group с публичным SSH (allow_all) + cloud-init для root password. Nova adminPass НЕдостаточен.
7. Не писать секреты в git; env/secret store.

## Контекст (уже работает в Telegram-боте dior-tg)
- Auth: https://os-api.hostvds.com/identity/v3
- Region: eu-west2
- Network name: Internet-03
- Security group: allow_all
- Flavors by plan id: 0→hostvds-1, 1→hostvds-2, 2→hostvds-4, 3→hostvds-8, 4→hostvds-16, 5→highload-4, 6→highload-8, 7→highload-16, 8–9→highload-24 (Mega4 premium cost)
- Images by osKey: ubuntu2404→Ubuntu-24.04-amd64, ubuntu2204→Ubuntu-22.04-amd64, debian13→Debian-13-amd64, debian12→Debian-12-amd64, debian11→Debian-11-amd64, alma8→AlmaLinux-8-amd64, alma9→AlmaLinux-9-amd64, rockylinux→RockyLinux-9-amd64, centos9→CentOS-9-amd64
- Pricing EUR cost map: {0:0.99,1:3.99,2:3.99,3:19.99,4:39.99,5:39.99,6:39.99,7:79.99,8:119.99,9:119.99}
- Markup: cost<2 → +120%; <4 → +100%; <10 → +70%; else +50%. sell=round(cost*(1+markup)*EUR_USD), EUR_USD default 1.
- Login: root. Wait ACTIVE + IPv4 + TCP/22 before “ready”.

## Что сделать в ЭТОМ репозитории
1. Изучи текущий order/VPS/billing/provider слой. Опиши коротко куда встраиваешься.
2. Добавь HostVDS OpenStack client + provisioner (+ day-2: start/stop/delete) по паттернам проекта.
3. Встрой только в standard checkout после успешной оплаты.
4. Поля БД: provider=hostvds, providerServerId=UUID, ipv4, password encrypted, plan, os, expiresAt.
5. Env: HOSTVDS_* как в handoff-доке (AUTH, USER, PASS, PROJECT, REGION, NETWORK name, IMAGE_MAP, FLAVOR_MAP, SECURITY_GROUPS, COST_EUR_MAP, EUR_USD, poll/ssh timeouts).
6. UI: после выдачи показать IP/login/password/SSH; ошибки — понятный fail + refund.
7. Тесты: unit на pricing markup + resolve; мок create; e2e checklist в README.
8. Не менять bulletproof цены и Proxmox flow.

## Cloud-init
Используй cloud-config с chpasswd root, ssh_pwauth true, sshd_config.d PermitRootLogin/PasswordAuthentication yes, restart ssh.

## Definition of done
Standard VPS из веба создаётся в HostVDS, SSH по 22 с паролем работает, orphan нет, деньги при ошибке откатываются, bulletproof не задет.
````

---

## 14. Безопасность

- Пароль HostVDS / openrc **не коммитить** и не светить в чатах; после утечки — ротация в панели HostVDS.
- Пароли VM в БД — encrypt at rest.
- Логи: без token/password/user_data plaintext.
- Admin API на смену пароля HostVDS account — отдельно от VM password.

---

*Сгенерировано из рабочей интеграции dior-tg HostVDS (июль 2026).*
