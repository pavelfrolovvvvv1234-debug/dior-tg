# Деплой: GitHub и VPS

## 1. Деплой на GitHub (со своей машины)

Закоммитить и запушить все изменения в ветку `main`:

```bash
git add -A
git status
git commit -m "feat: admin by Telegram ID, deploy docs"
git push origin main
```

Если репозиторий ещё не привязан к GitHub:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

## 2. Деплой на VPS

### Вариант A: Автоматический (GitHub Actions)

Если в репозитории настроены **Secrets**:

- `SSH_HOST` — IP или хост VPS  
- `SSH_USER` — пользователь (например `root`)  
- `SSH_KEY` — приватный SSH-ключ (содержимое, без пароля)  
- при необходимости: `SSH_PORT`, `DEPLOY_PATH`  

то при каждом `git push origin main` workflow **Deploy Bot** сам соберёт проект и задеплоит на сервер (scp + ssh). Проверить: **Actions** → последний run **Deploy to Server**.

### Вариант B: Вручную на VPS

Зайти по SSH на VPS и выполнить (путь к проекту замените на свой, например `/opt/bot` или `~/dior-tg`):

```bash
cd /opt/bot
git fetch origin
git reset --hard origin/main
npm ci
npm run build
npm run fix-dist
pm2 restart all
```

Если бот ещё не запускался на этом сервере:

```bash
npm run build
npm run fix-dist
pm2 start ecosystem.config.js
pm2 save
```

**Важно:** файл `.env` на VPS должен быть создан и заполнен вручную (его нет в репозитории). Скопируйте настройки с `.env.example` и добавьте свои значения.

**Чтобы выдать себе админку по Telegram ID**, в `.env` на VPS добавь (подставь свой ID, без пробелов):
```env
ADMIN_TELEGRAM_IDS=7568177886
```
После изменения `.env` выполни `pm2 restart all`. Затем открой бота в Telegram (приватный чат), нажми «Профиль» или отправь `/start` — кнопка «Админ» появится в главном меню; также работает команда `/admin`.

**Проверка:** в логах при первом запросе должно появиться сообщение `[Config] Admin Telegram IDs (ADMIN_TELEGRAM_IDS): 7568177886`. Если его нет — переменная не подхватилась (проверь путь к `.env`, перезапуск после правки, отсутствие пробелов в значении).

---

## Краткий чеклист

| Шаг | Где | Действие |
|-----|-----|----------|
| 1 | Локально | `git add -A && git commit -m "..." && git push origin main` |
| 2 | GitHub | Убедиться, что push прошёл (при настроенных Secrets — проверить Actions) |
| 3 | VPS | Подключиться по SSH → `cd проект` → `git fetch && git reset --hard origin/main` → `npm ci && npm run build && npm run fix-dist` → `pm2 restart all` |

После деплоя: `pm2 logs` — просмотр логов, `pm2 status` — статус процессов.

---

## Prime: «Я подписался» показывает «Сначала подпишитесь на канал»

1. **В .env на VPS** должны быть заданы канал для проверки и (по желанию) ссылка:
   - `PRIME_CHANNEL_ID=-1001234567890` — числовой ID канала (приватный канал с ссылкой t.me/+xxx). Узнать: добавь в канал @userinfobot или перешли сообщение из канала боту @getidsbot.
   - Или `PRIME_CHANNEL_USERNAME=diorhost_news` — для публичного канала (username без @).
   - Бот **обязательно** должен быть администратором этого канала, иначе проверка подписки не сработает.

2. **Посмотреть логи в момент нажатия «Я подписался»:**
   ```bash
   pm2 logs dior-host-bot --lines 30
   ```
   - Если видишь **`Prime getChatMember failed`** и в логе есть `error`/`code` — значит запрос к Telegram не прошёл: проверь, что бот админ канала и что `PRIME_CHANNEL_ID` (или `PRIME_CHANNEL_USERNAME`) указан верно.
   - Если видишь **`Prime check: user not subscribed`** и `status: left` — пользователь не в канале (нужно подписаться именно на тот канал, ID которого задан в .env).
