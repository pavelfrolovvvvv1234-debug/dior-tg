# 🚀 Настройка GitHub для проекта

## 📋 Что нужно сделать

### 1. Инициализация Git репозитория (если еще не сделано)

```bash
# Проверить, есть ли уже git репозиторий
git status

# Если нет - инициализировать
git init

# Добавить все файлы (кроме тех, что в .gitignore)
git add .

# Первый коммит
git commit -m "Initial commit: Refactored bot architecture"
```

### 2. Создать репозиторий на GitHub

1. Перейдите на https://github.com/new
2. Создайте новый репозиторий (например, `drip-hosting-bot`)
3. НЕ инициализируйте с README (если у вас уже есть код)

### 3. Подключить локальный репозиторий к GitHub

```bash
# Добавить remote
git remote add origin https://github.com/YOUR_USERNAME/drip-hosting-bot.git

# Переименовать ветку в main (если нужно)
git branch -M main

# Отправить код на GitHub
git push -u origin main
```

## 🔐 Настройка Secrets в GitHub

### Для CI/CD workflows:

1. Перейдите в Settings → Secrets and variables → Actions
2. Добавьте следующие secrets:

**Обязательные:**
- `BOT_TOKEN` - Токен Telegram бота
- `BOT_USERNAME` - Имя бота
- `WEBSITE_URL` - URL сайта
- `SUPPORT_USERNAME_TG` - Имя поддержки
- `PAYMENT_AAIO_ID` - AAIO ID
- `PAYMENT_AAIO_SECRET_ONE` - AAIO Secret 1
- `PAYMENT_AAIO_SECRET_TWO` - AAIO Secret 2
- `PAYMENT_AAIO_TOKEN` - AAIO Token
- `PAYMENT_CRYSTALPAY_ID` - CrystalPay ID
- `PAYMENT_CRYSTALPAY_SECRET_ONE` - CrystalPay Secret 1
- `PAYMENT_CRYSTALPAY_SECRET_TWO` - CrystalPay Secret 2
- `VMM_EMAIL` - VMManager email
- `VMM_PASSWORD` - VMManager password
- `VMM_ENDPOINT_URL` - VMManager endpoint URL

**Опциональные (для автоматического деплоя):**
- `SSH_HOST` - SSH хост для деплоя
- `SSH_USER` - SSH пользователь
- `SSH_KEY` - SSH приватный ключ
- `SSH_PORT` - SSH порт (по умолчанию 22)
- `DOCKER_USERNAME` - Docker Hub username (для публикации образов)
- `DOCKER_PASSWORD` - Docker Hub password

## 🔄 GitHub Actions Workflows

Созданы 3 workflow файла:

### 1. CI Pipeline (`.github/workflows/ci.yml`)
- ✅ Запускается при каждом push/PR
- ✅ Проверяет TypeScript компиляцию
- ✅ Запускает линтер
- ✅ Проверяет форматирование
- ✅ Собирает проект

### 2. Test Bot (`.github/workflows/test.yml`)
- ✅ Запускается при pull request
- ✅ Проверяет валидацию конфига
- ✅ Тестирует сборку
- ✅ Проверяет импорты модулей

### 3. Deploy Bot (`.github/workflows/deploy.yml`)
- ✅ Запускается при push в main/master
- ✅ Собирает deployment package
- ✅ Деплоит через SSH (если настроено)
- ✅ Собирает Docker образ (если настроено)

## 🚀 Использование GitHub Actions

### Ручной запуск workflow:

1. Перейдите в Actions → Test Bot (или другой workflow)
2. Нажмите "Run workflow"
3. Выберите ветку и нажмите "Run workflow"

### Автоматический запуск:

Workflows запускаются автоматически при:
- ✅ Push в main/master/develop
- ✅ Pull request в main/master/develop
- ✅ Создании тега (для deploy)

## 📦 Деплой через GitHub

### Вариант 1: Автоматический деплой через SSH

1. Настройте secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`
2. При push в main автоматически задеплоится

### Вариант 2: Ручной деплой через GitHub Releases

1. Создайте release на GitHub
2. Скачайте artifact `deployment-package` из Actions
3. Распакуйте и установите на сервер

### Вариант 3: Docker деплой

1. Настройте secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`
2. При push автоматически соберется Docker образ
3. Используйте образ для деплоя:

```bash
# Pull image
docker pull YOUR_USERNAME/driphosting-bot:latest

# Run container
docker run -d \
  --name drip-hosting-bot \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/sessions:/app/sessions \
  YOUR_USERNAME/driphosting-bot:latest
```

## 🔍 Мониторинг CI/CD

### Просмотр результатов:

1. Перейдите в **Actions** вкладку на GitHub
2. Выберите workflow run
3. Просмотрите логи каждого job

### Уведомления:

- ✅ Email уведомления о статусе (настройте в GitHub Settings)
- ✅ Status badges в README (можно добавить)

## 🎯 Пример использования

### 1. Создать репозиторий и загрузить код:

```bash
# Инициализировать git
git init
git add .
git commit -m "Initial commit"

# Создать репозиторий на GitHub, затем:
git remote add origin https://github.com/YOUR_USERNAME/drip-hosting-bot.git
git branch -M main
git push -u origin main
```

### 2. Настроить secrets на GitHub

Перейдите: Settings → Secrets → New repository secret

Добавьте все необходимые переменные из `.env`

### 3. Проверить что CI работает

- Перейдите в Actions
- Должен запуститься workflow после push
- Проверьте, что все тесты прошли ✅

### 4. Деплой (если настроен)

- При push в main автоматически задеплоится
- Или запустите workflow вручную

## 📝 Пример .github/workflows/badge.yml (опционально)

```yaml
name: Update Badge

on:
  workflow_run:
    workflows: ["CI/CD Pipeline"]
    types:
      - completed

jobs:
  update-badge:
    runs-on: ubuntu-latest
    steps:
      - name: Update status badge
        # Можно добавить обновление статуса в README
```

## ✅ Чек-лист настройки GitHub

- [ ] Git репозиторий инициализирован
- [ ] Репозиторий создан на GitHub
- [ ] Код загружен на GitHub
- [ ] Secrets добавлены в GitHub Settings
- [ ] CI/CD workflows настроены
- [ ] Тесты проходят в GitHub Actions
- [ ] Деплой настроен (опционально)

## 🚨 Важно!

**НЕ коммитьте `.env` файл!**

- ✅ `.env` уже в `.gitignore`
- ✅ Используйте GitHub Secrets для переменных окружения
- ✅ Используйте `.env.example` для документации (создайте, если нужно)

## 📚 Дополнительные ресурсы

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- `DEPLOYMENT.md` - Руководство по деплою
- `README.md` - Основная документация

## 🎉 Готово!

После настройки GitHub Actions:
- ✅ Каждый push будет проверяться автоматически
- ✅ Pull requests будут тестироваться
- ✅ Production деплой может быть автоматизирован
- ✅ История изменений будет в Git

**Удачи! 🚀**
