# 🚀 Быстрый деплой на VPS (5 минут)

## 📋 Вариант 1: Через Git + PM2 (Самый простой)

### На VPS выполните:

```bash
# 1. Установите необходимые инструменты
apt update && apt install -y git nodejs npm
npm install -g pm2

# 2. Клонируйте репозиторий
mkdir -p /opt/bot && cd /opt/bot
git clone https://github.com/pavelfrolovvvvv1234-debug/dior-bot.git .

# 3. Создайте .env файл
nano .env
# Скопируйте все переменные из вашего локального .env

# 4. Установите зависимости и соберите
npm install
npm run build

# 5. Создайте директории
mkdir -p data sessions logs

# 6. Запустите бота
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Выполните команду которую выведет PM2

# 7. Проверьте статус
pm2 status
pm2 logs drip-hosting-bot
```

**Готово! 🎉** Бот запущен на VPS!

### Обновление бота (после изменений):

```bash
cd /opt/bot
git pull origin main
npm install
npm run build
pm2 restart drip-hosting-bot
pm2 logs drip-hosting-bot
```

---

## 📋 Вариант 2: Автоматический деплой через GitHub Actions

### Шаг 1: Настройте SSH на VPS

```bash
# На VPS создайте SSH ключ
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# Добавьте публичный ключ в authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Покажите приватный ключ (скопируйте его полностью)
cat ~/.ssh/github_actions
```

### Шаг 2: Добавьте Secrets в GitHub

1. Перейдите: https://github.com/pavelfrolovvvvv1234-debug/dior-bot/settings/secrets/actions
2. Нажмите **"New repository secret"**
3. Добавьте следующие secrets:

```
SSH_HOST=your-vps-ip
SSH_USER=root
SSH_KEY=<содержимое приватного SSH ключа>
DEPLOY_PATH=/opt/bot
```

### Шаг 3: Первоначальная настройка на VPS

```bash
# На VPS установите необходимое
apt update && apt install -y git nodejs npm
npm install -g pm2

# Создайте директорию для деплоя
mkdir -p /opt/bot
cd /opt/bot

# Создайте .env файл
nano .env
# Добавьте все переменные окружения

# Установите зависимости (первый раз)
git clone https://github.com/pavelfrolovvvvv1234-debug/dior-bot.git .
npm install
npm run build

# Запустите бота
mkdir -p data sessions logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Шаг 4: Автоматический деплой

Теперь при каждом `git push` на `main` ветку GitHub Actions автоматически:
1. Соберет проект
2. Загрузит на VPS
3. Установит зависимости
4. Перезапустит бота через PM2

**Проверьте:** https://github.com/pavelfrolovvvvv1234-debug/dior-bot/actions

---

## 📋 Вариант 3: Через Docker

### На VPS:

```bash
# 1. Установите Docker
apt update && apt install -y docker.io docker-compose

# 2. Клонируйте репозиторий
mkdir -p /opt/bot && cd /opt/bot
git clone https://github.com/pavelfrolovvvvv1234-debug/dior-bot.git .

# 3. Создайте .env файл
nano .env

# 4. Запустите через Docker Compose
docker-compose up -d --build

# 5. Проверьте статус
docker-compose ps
docker-compose logs -f bot
```

### Обновление:

```bash
cd /opt/bot
git pull origin main
docker-compose up -d --build
```

---

## 🎯 Автоматический скрипт деплоя

### Linux/macOS:

```bash
# Скачайте скрипт на VPS
cd /opt/bot
wget https://raw.githubusercontent.com/pavelfrolovvvvv1234-debug/dior-bot/main/deploy.sh
chmod +x deploy.sh

# Или скопируйте скрипт с вашего компьютера
# scp deploy.sh root@your-vps:/opt/bot/

# Запустите
./deploy.sh
```

### Windows (PowerShell на VPS):

```powershell
# Скачайте скрипт
cd C:\bot
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/pavelfrolovvvvv1234-debug/dior-bot/main/deploy.ps1" -OutFile "deploy.ps1"

# Запустите
.\deploy.ps1
```

---

## ✅ Проверка что всё работает

### 1. Проверьте статус

**PM2:**
```bash
pm2 status
pm2 logs drip-hosting-bot
```

**Docker:**
```bash
docker-compose ps
docker-compose logs bot
```

### 2. Проверьте бота в Telegram

1. Откройте Telegram
2. Найдите вашего бота
3. Отправьте `/start`
4. Бот должен ответить

### 3. Проверьте логи

**PM2:**
```bash
pm2 logs drip-hosting-bot --lines 100
```

**Docker:**
```bash
docker-compose logs bot --tail 100
```

---

## 🔧 Полезные команды

### PM2:

```bash
pm2 status                    # Статус
pm2 logs drip-hosting-bot     # Логи
pm2 restart drip-hosting-bot  # Перезапуск
pm2 stop drip-hosting-bot     # Остановка
pm2 monit                     # Мониторинг
```

### Docker:

```bash
docker-compose ps             # Статус
docker-compose logs bot       # Логи
docker-compose restart bot    # Перезапуск
docker-compose stop bot       # Остановка
docker-compose down           # Остановка и удаление
```

---

## 🚨 Решение проблем

### Бот не запускается:

```bash
# Проверьте логи
pm2 logs drip-hosting-bot --lines 100
# или
docker-compose logs bot

# Проверьте .env файл
cat .env

# Проверьте Node.js
node --version

# Проверьте сборку
ls -la dist/
```

### Ошибки прав доступа:

```bash
chmod 755 data sessions logs
chmod 644 data/data.db 2>/dev/null || true
```

### Проблемы с зависимостями:

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📚 Дополнительная информация

- **Подробная инструкция:** `VPS_DEPLOY.md`
- **Общая документация:** `README.md`
- **Запуск локально:** `QUICK_START.md`

---

## 🎉 Готово!

Ваш бот должен быть запущен и работать на VPS!

**Проверьте:**
1. ✅ Логи бота - нет ошибок
2. ✅ Telegram - бот отвечает на `/start`
3. ✅ Меню - все кнопки работают

**Удачи! 🚀**
