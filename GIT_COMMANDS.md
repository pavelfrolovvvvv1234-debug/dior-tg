# 🔄 Git команды для быстрого старта

## 🚀 Быстрая настройка GitHub

### Шаг 1: Инициализация Git (если еще не сделано)

```bash
# Проверить статус
git status

# Если не инициализирован, выполните:
git init
```

### Шаг 2: Добавить файлы

```bash
# Добавить все файлы (кроме тех, что в .gitignore)
git add .

# Проверить что будет закоммичено
git status
```

### Шаг 3: Первый коммит

```bash
# Создать коммит
git commit -m "Initial commit: Refactored bot architecture with clean code structure"
```

### Шаг 4: Создать репозиторий на GitHub

1. Перейдите на https://github.com/new
2. Создайте новый репозиторий (например, `drip-hosting-bot`)
3. **НЕ** инициализируйте с README, .gitignore или лицензией (у вас уже всё есть)

### Шаг 5: Подключить к GitHub

```bash
# Добавить remote (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/drip-hosting-bot.git

# Переименовать ветку в main (если нужно)
git branch -M main

# Отправить код на GitHub
git push -u origin main
```

## 🔐 Настройка Secrets в GitHub

После создания репозитория:

1. Перейдите: **Settings** → **Secrets and variables** → **Actions**
2. Нажмите **New repository secret**
3. Добавьте все переменные из вашего `.env` файла:

```
BOT_TOKEN
BOT_USERNAME
WEBSITE_URL
SUPPORT_USERNAME_TG
PAYMENT_AAIO_ID
PAYMENT_AAIO_SECRET_ONE
PAYMENT_AAIO_SECRET_TWO
PAYMENT_AAIO_TOKEN
PAYMENT_CRYSTALPAY_ID
PAYMENT_CRYSTALPAY_SECRET_ONE
PAYMENT_CRYSTALPAY_SECRET_TWO
VMM_EMAIL
VMM_PASSWORD
VMM_ENDPOINT_URL
```

## ✅ Проверка что всё работает

После push на GitHub:

1. Перейдите в **Actions** вкладку
2. Должен запуститься workflow "CI/CD Pipeline"
3. Дождитесь завершения (зеленая галочка ✅)

## 🔄 Последующие коммиты

```bash
# Добавить изменения
git add .

# Закоммитить
git commit -m "Описание изменений"

# Отправить на GitHub
git push
```

## 🐛 Решение проблем

### "fatal: not a git repository"

```bash
# Инициализировать git
git init
```

### "remote origin already exists"

```bash
# Проверить текущий remote
git remote -v

# Изменить URL remote
git remote set-url origin https://github.com/YOUR_USERNAME/drip-hosting-bot.git
```

### "Permission denied"

```bash
# Использовать SSH вместо HTTPS:
git remote set-url origin git@github.com:YOUR_USERNAME/drip-hosting-bot.git

# Или настройте Personal Access Token для HTTPS
```

### Нужно обновить .gitignore

```bash
# Если добавили файлы в .gitignore после коммита
git rm -r --cached .
git add .
git commit -m "Update .gitignore"
git push
```

## 📋 Полезные команды

```bash
# Проверить статус
git status

# Посмотреть историю коммитов
git log --oneline

# Посмотреть разницу
git diff

# Создать новую ветку
git checkout -b feature/new-feature

# Вернуться в main
git checkout main

# Объединить ветки
git merge feature/new-feature

# Удалить ветку
git branch -d feature/new-feature
```

## 🎯 Чек-лист

- [ ] Git инициализирован (`git init`)
- [ ] Файлы добавлены (`git add .`)
- [ ] Первый коммит создан (`git commit`)
- [ ] Репозиторий создан на GitHub
- [ ] Remote добавлен (`git remote add origin`)
- [ ] Код отправлен на GitHub (`git push`)
- [ ] Secrets добавлены в GitHub Settings
- [ ] GitHub Actions работают (проверить в Actions вкладке)

## 🚀 Готово!

Теперь ваш код на GitHub и автоматически тестируется при каждом push!
