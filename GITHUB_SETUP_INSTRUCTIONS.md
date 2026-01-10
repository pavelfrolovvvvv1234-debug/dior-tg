# 🚀 Инструкция: Загрузка на GitHub

## 📋 Текущая ситуация

✅ Git репозиторий инициализирован  
✅ Remote уже настроен на **GitLab**: `https://flexice@gitlab.com/flexice/driphosting-bot.git`  
⏳ Есть незакоммиченные изменения (38 файлов)  
🎯 Нужно добавить GitHub или изменить remote

## 🔄 Варианты настройки GitHub

### Вариант 1: Использовать GitHub ВМЕСТО GitLab (рекомендуется) 🔄

Если хотите полностью переключиться на GitHub:

```bash
# 1. Сначала закоммитьте текущие изменения
git add .
git commit -m "Refactored bot architecture: Clean code structure"

# 2. Изменить remote на GitHub
git remote set-url origin https://github.com/YOUR_USERNAME/drip-hosting-bot.git

# 3. Создать репозиторий на GitHub (см. ниже)

# 4. Загрузить код на GitHub
git push -u origin main
```

### Вариант 2: Использовать GitHub И GitLab одновременно (оба remote) 🔀

Если хотите держать код и на GitLab, и на GitHub:

```bash
# 1. Закоммитьте текущие изменения
git add .
git commit -m "Refactored bot architecture: Clean code structure"

# 2. Добавить GitHub как дополнительный remote
git remote add github https://github.com/YOUR_USERNAME/drip-hosting-bot.git

# 3. Создать репозиторий на GitHub (см. ниже)

# 4. Загрузить на GitHub
git push -u github main

# 5. В будущем можно пушить в оба:
git push origin main    # GitLab
git push github main    # GitHub
```

### Вариант 3: Использовать PowerShell скрипт (Windows) 🤖

Просто запустите скрипт:

```powershell
.\setup-github.ps1
```

Он поможет настроить всё автоматически.

## 📝 Пошаговая инструкция

### Шаг 1: Закоммитьте текущие изменения

```bash
# Проверить статус
git status

# Добавить все файлы
git add .

# Создать коммит
git commit -m "Refactored bot architecture: Clean code, TypeScript, Zod validation, repositories, services, payment abstraction, Docker, GitHub Actions"
```

### Шаг 2: Создать репозиторий на GitHub

1. Перейдите на https://github.com/new
2. Repository name: `drip-hosting-bot` (или другое имя)
3. Description: "Production-ready Telegram bot with clean architecture"
4. Visibility: **Private** (рекомендуется) или **Public**
5. **НЕ** добавляйте:
   - ❌ README (у вас уже есть)
   - ❌ .gitignore (у вас уже есть)
   - ❌ Лицензию (можно добавить позже)
6. Нажмите **"Create repository"**

### Шаг 3: Подключить к GitHub

**Если хотите заменить GitLab на GitHub:**

```bash
# Изменить remote
git remote set-url origin https://github.com/YOUR_USERNAME/drip-hosting-bot.git

# Проверить
git remote -v

# Отправить на GitHub
git branch -M main  # Переименовать ветку в main (если нужно)
git push -u origin main
```

**Если хотите использовать оба (GitLab + GitHub):**

```bash
# Добавить GitHub как github remote (GitLab останется как origin)
git remote add github https://github.com/YOUR_USERNAME/drip-hosting-bot.git

# Проверить все remotes
git remote -v

# Отправить на GitHub
git push -u github main

# В будущем:
git push origin main    # Отправить на GitLab
git push github main    # Отправить на GitHub
```

### Шаг 4: Проверить что всё загрузилось

1. Откройте ваш GitHub репозиторий: `https://github.com/YOUR_USERNAME/drip-hosting-bot`
2. Проверьте, что все файлы на месте:
   - ✅ `src/` папка
   - ✅ `.github/workflows/` с CI/CD
   - ✅ `package.json`, `README.md`, и т.д.
3. Перейдите в **Actions** вкладку
4. Должен запуститься workflow "CI/CD Pipeline"
5. Дождитесь завершения (зеленая галочка ✅)

### Шаг 5: Настроить Secrets в GitHub

1. Перейдите: **Settings** → **Secrets and variables** → **Actions**
2. Нажмите **"New repository secret"**
3. Добавьте все переменные из `.env`:

```
BOT_TOKEN → ваш токен бота
BOT_USERNAME → имя бота
WEBSITE_URL → URL сайта
SUPPORT_USERNAME_TG → имя поддержки
PAYMENT_AAIO_ID → AAIO ID
PAYMENT_AAIO_SECRET_ONE → AAIO Secret 1
PAYMENT_AAIO_SECRET_TWO → AAIO Secret 2
PAYMENT_AAIO_TOKEN → AAIO Token
PAYMENT_CRYSTALPAY_ID → CrystalPay ID
PAYMENT_CRYSTALPAY_SECRET_ONE → CrystalPay Secret 1
PAYMENT_CRYSTALPAY_SECRET_TWO → CrystalPay Secret 2
VMM_EMAIL → VMManager email
VMM_PASSWORD → VMManager password
VMM_ENDPOINT_URL → VMManager endpoint URL
```

4. Сохраните все secrets

## ✅ После настройки

### Автоматические действия:

При каждом push в main/master:
- ✅ Запустится CI/CD Pipeline
- ✅ Проверится TypeScript компиляция
- ✅ Запустится линтер
- ✅ Проверится форматирование
- ✅ Соберется проект

### Проверка работы:

1. Откройте **Actions** вкладку на GitHub
2. Должен быть workflow run "CI/CD Pipeline"
3. Проверьте статус:
   - ✅ Зеленая галочка = всё хорошо
   - ❌ Красный крестик = есть ошибки (проверьте логи)

## 🔍 Полезные команды

```bash
# Проверить все remotes
git remote -v

# Изменить remote URL
git remote set-url origin https://github.com/YOUR_USERNAME/REPO.git

# Добавить дополнительный remote
git remote add github https://github.com/YOUR_USERNAME/REPO.git

# Удалить remote
git remote remove origin

# Отправить на конкретный remote
git push github main
git push origin main
```

## 🎯 Рекомендация

**Для начала используйте Вариант 2** (оба remote):
- ✅ GitLab останется как есть
- ✅ GitHub добавится как дополнительный
- ✅ Можно тестировать GitHub Actions без потери GitLab

Позже, если всё работает на GitHub, можно переключиться полностью.

## 📚 Дополнительные ресурсы

- `GITHUB_SETUP.md` - Детальная инструкция
- `GITHUB_QUICK_START.md` - Быстрый старт
- `GIT_COMMANDS.md` - Полезные Git команды
- `UPLOAD_TO_GITHUB.md` - Общая инструкция по загрузке

## 🚀 Готово!

После выполнения этих шагов ваш проект будет на GitHub с автоматическим тестированием!

**Удачи! 🎉**
