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

**Важно:** файл `.env` на VPS должен быть создан и заполнен вручную (его нет в репозитории). Скопируйте настройки с `.env.example` и добавьте свои значения, включая `ADMIN_TELEGRAM_IDS=7568177886` при необходимости.

---

## Краткий чеклист

| Шаг | Где | Действие |
|-----|-----|----------|
| 1 | Локально | `git add -A && git commit -m "..." && git push origin main` |
| 2 | GitHub | Убедиться, что push прошёл (при настроенных Secrets — проверить Actions) |
| 3 | VPS | Подключиться по SSH → `cd проект` → `git fetch && git reset --hard origin/main` → `npm ci && npm run build && npm run fix-dist` → `pm2 restart all` |

После деплоя: `pm2 logs` — просмотр логов, `pm2 status` — статус процессов.
