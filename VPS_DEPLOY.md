# 🚀 Деплой на VPS - Полная инструкция

## 📋 Подготовка VPS

### 1. Подключитесь к VPS

```bash
ssh root@your-vps-ip
# или
ssh username@your-vps-ip
```

### 2. Обновите систему

```bash
# Ubuntu/Debian
apt update && apt upgrade -y

# CentOS/RHEL
yum update -y
```

### 3. Установите необходимые инструменты

```bash
# Node.js 20+ (через nvm или напрямую)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Или через nvm (рекомендуется)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Git
apt-get install -y git

# PM2 (для управления процессами)
npm install -g pm2

# Docker (опционально, если используете Docker)
apt-get install -y docker.io docker-compose
systemctl start docker
systemctl enable docker
```

## 🎯 Вариант 1: Деплой через Git + PM2 (Рекомендуется)

### Шаг 1: Клонируйте репозиторий

```bash
# Создайте директорию для проекта
mkdir -p /opt/bot
cd /opt/bot

# Клонируйте репозиторий
git clone https://github.com/pavelfrolovvvvv1234-debug/dior-bot.git .
# или через SSH
# git clone git@github.com:pavelfrolovvvvv1234-debug/dior-bot.git .
```

### Шаг 2: Настройте окружение

```bash
# Создайте .env файл
nano .env
# или
vim .env
```

**Скопируйте содержимое вашего локального `.env` файла:**

```env
BOT_TOKEN=your_bot_token
BOT_USERNAME=your_bot_username
WEBSITE_URL=https://your-website.com
SUPPORT_USERNAME_TG=@your_support

# Payment providers
PAYMENT_AAIO_ID=your_aaio_id
PAYMENT_AAIO_SECRET_ONE=your_secret_one
PAYMENT_AAIO_SECRET_TWO=your_secret_two
PAYMENT_AAIO_TOKEN=your_aaio_token

PAYMENT_CRYSTALPAY_ID=your_crystalpay_id
PAYMENT_CRYSTALPAY_SECRET_ONE=your_secret_one
PAYMENT_CRYSTALPAY_SECRET_TWO=your_secret_two

# VMManager
VMM_EMAIL=your_email
VMM_PASSWORD=your_password
VMM_ENDPOINT_URL=https://your-vmm-endpoint.com

# Optional
NODE_ENV=production
DOMAINR_TOKEN=your_token
```

**Сохраните файл:** `Ctrl+O`, `Enter`, `Ctrl+X` (nano) или `:wq` (vim)

### Шаг 3: Установите зависимости и соберите проект

```bash
# Установите зависимости
npm install

# Соберите проект
npm run build

# Проверьте что сборка прошла успешно
ls -la dist/
```

### Шаг 4: Настройте права доступа

```bash
# Создайте директории для данных
mkdir -p data sessions logs

# Установите права доступа
chmod 755 data sessions logs
```

### Шаг 5: Запустите с PM2

```bash
# Запустите бота
pm2 start ecosystem.config.js

# Сохраните конфигурацию PM2 для автозапуска
pm2 save

# Настройте автозапуск при перезагрузке системы
pm2 startup
# Выполните команду, которую выведет PM2 (обычно что-то вроде: sudo env PATH=... pm2 startup systemd -u username --hp /home/username)

# Проверьте статус
pm2 status

# Просмотрите логи
pm2 logs drip-hosting-bot

# Мониторинг в реальном времени
pm2 monit
```

### Шаг 6: Обновите бота (после изменений)

```bash
cd /opt/bot

# Получите последние изменения
git pull origin main

# Установите новые зависимости (если есть)
npm install

# Пересоберите проект
npm run build

# Перезапустите бота
pm2 restart drip-hosting-bot

# Проверьте логи
pm2 logs drip-hosting-bot --lines 50
```

## 🐳 Вариант 2: Деплой через Docker (Альтернатива)

### Шаг 1: Клонируйте репозиторий

```bash
mkdir -p /opt/bot
cd /opt/bot
git clone https://github.com/pavelfrolovvvvv1234-debug/dior-bot.git .
```

### Шаг 2: Создайте .env файл

```bash
nano .env
# Добавьте все переменные окружения (как в Варианте 1)
```

### Шаг 3: Соберите и запустите контейнер

```bash
# С помощью docker-compose (рекомендуется)
docker-compose up -d --build

# Или напрямую через Docker
docker build -t dior-bot:latest .
docker run -d \
  --name dior-bot \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/sessions:/app/sessions \
  -p 3002:3002 \
  dior-bot:latest
```

### Шаг 4: Проверьте статус

```bash
# Docker Compose
docker-compose ps
docker-compose logs -f bot

# Docker
docker ps
docker logs -f dior-bot
```

### Шаг 5: Обновите бота (Docker)

```bash
cd /opt/bot

# Получите последние изменения
git pull origin main

# Пересоберите и перезапустите
docker-compose up -d --build

# Или через Docker
docker stop dior-bot
docker rm dior-bot
docker build -t dior-bot:latest .
docker run -d \
  --name dior-bot \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/sessions:/app/sessions \
  -p 3002:3002 \
  dior-bot:latest
```

## 🔄 Вариант 3: Автоматический деплой через GitHub Actions

### Шаг 1: Настройте SSH ключ на VPS

```bash
# На VPS создайте SSH ключ для GitHub Actions
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# Добавьте публичный ключ в authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Покажите приватный ключ (скопируйте его полностью)
cat ~/.ssh/github_actions
```

### Шаг 2: Добавьте Secrets в GitHub

1. Перейдите: https://github.com/pavelfrolovvvvv1234-debug/dior-bot/settings/secrets/actions
2. Добавьте следующие secrets:

```
SSH_HOST=your-vps-ip
SSH_USER=root (или ваш username)
SSH_KEY=<содержимое приватного SSH ключа>
DEPLOY_PATH=/opt/bot
```

### Шаг 3: Обновите GitHub Actions workflow

Создайте или обновите `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd ${{ secrets.DEPLOY_PATH }}
            git pull origin main
            npm install
            npm run build
            pm2 restart drip-hosting-bot
```

### Шаг 4: Автоматический деплой

Теперь при каждом `git push` на `main` ветку бот автоматически обновится на VPS!

## 📊 Мониторинг и управление

### PM2 команды

```bash
# Статус всех процессов
pm2 status

# Логи бота
pm2 logs drip-hosting-bot

# Логи за последние 100 строк
pm2 logs drip-hosting-bot --lines 100

# Мониторинг в реальном времени
pm2 monit

# Перезапуск
pm2 restart drip-hosting-bot

# Остановка
pm2 stop drip-hosting-bot

# Удаление из PM2
pm2 delete drip-hosting-bot

# Информация о процессе
pm2 info drip-hosting-bot
```

### Docker команды

```bash
# Docker Compose
docker-compose logs -f bot
docker-compose restart bot
docker-compose stop bot
docker-compose down
docker-compose ps

# Docker
docker logs -f dior-bot
docker restart dior-bot
docker stop dior-bot
docker start dior-bot
docker ps
```

## 🔒 Безопасность

### 1. Настройте Firewall

```bash
# UFW (Ubuntu)
ufw allow 22/tcp    # SSH
ufw allow 3002/tcp  # Webhook (если используете)
ufw enable

# iptables
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 3002 -j ACCEPT
iptables -P INPUT DROP
```

### 2. Защитите .env файл

```bash
# Установите права только для чтения владельцем
chmod 600 .env

# Убедитесь что .env в .gitignore (не коммитьте!)
```

### 3. Регулярные бэкапы

```bash
# Создайте скрипт для бэкапа
cat > /opt/bot/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/bot"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)

# Бэкап базы данных
cp /opt/bot/data/data.db $BACKUP_DIR/data_$DATE.db

# Бэкап сессий
tar -czf $BACKUP_DIR/sessions_$DATE.tar.gz /opt/bot/sessions/

# Бэкап .env (осторожно с правами!)
cp /opt/bot/.env $BACKUP_DIR/.env_$DATE

# Удаляем старые бэкапы (старше 7 дней)
find $BACKUP_DIR -type f -mtime +7 -delete
EOF

chmod +x /opt/bot/backup.sh

# Добавьте в crontab для ежедневного бэкапа
crontab -e
# Добавьте строку:
# 0 2 * * * /opt/bot/backup.sh
```

## 🚨 Решение проблем

### Бот не запускается

```bash
# Проверьте логи
pm2 logs drip-hosting-bot --lines 100
# или
docker-compose logs bot

# Проверьте .env файл
cat .env

# Проверьте что Node.js установлен
node --version

# Проверьте что проект собран
ls -la dist/

# Проверьте права доступа
ls -la data/ sessions/
```

### Ошибки базы данных

```bash
# Проверьте права на директорию data/
chmod 755 data/
chmod 644 data/data.db

# Проверьте место на диске
df -h
```

### Проблемы с зависимостями

```bash
# Очистите node_modules и переустановите
rm -rf node_modules package-lock.json
npm install
npm run build
```

## ✅ Чек-лист деплоя

- [ ] VPS подготовлен (Node.js, Git, PM2/Docker установлены)
- [ ] Репозиторий клонирован на VPS
- [ ] `.env` файл создан и заполнен
- [ ] Зависимости установлены (`npm install`)
- [ ] Проект собран (`npm run build`)
- [ ] Бот запущен (PM2 или Docker)
- [ ] Бот работает (проверены логи)
- [ ] Автозапуск настроен (`pm2 startup` или `restart: unless-stopped`)
- [ ] Firewall настроен
- [ ] Бэкапы настроены
- [ ] Мониторинг работает

## 🎉 Готово!

Ваш бот должен быть запущен и работать на VPS!

**Проверьте:**
1. Логи бота - нет ошибок
2. Telegram - бот отвечает на `/start`
3. Меню - все кнопки работают

**Удачи! 🚀**
