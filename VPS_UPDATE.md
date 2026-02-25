# Обновление бота на VPS

После того как код запушен на GitHub, на сервере выполни:

## 1. Подключись по SSH к VPS

```bash
ssh user@твой-vps-ip
```

## 2. Перейди в папку проекта

```bash
cd /путь/к/проекту
# Например: cd ~/dior-bot  или  cd /var/www/dior-host-bot
```

## 3. Подтяни код и пересобери

```bash
git fetch origin
git reset --hard origin/main
npm ci
npm run build
npm run fix-dist
```

## 4. Перезапусти бота (PM2)

```bash
pm2 restart dior-host-bot
# или, если бот запущен как "all":
pm2 restart all
```

## 5. Проверь

```bash
pm2 status
pm2 logs dior-host-bot --lines 30
```

---

**Кратко одной строкой (подставь свой путь):**

```bash
cd /путь/к/проекту && git fetch origin && git reset --hard origin/main && npm ci && npm run build && npm run fix-dist && pm2 restart dior-host-bot
```

После правок в `.env` на VPS всегда делай: `pm2 restart dior-host-bot`.
