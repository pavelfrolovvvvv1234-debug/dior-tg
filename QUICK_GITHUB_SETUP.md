# ⚡ Быстрая инструкция: GitHub за 5 минут

## 🎯 Что нужно сделать

### 1. Закоммитьте изменения (1 минута)

```bash
git add .
git commit -m "Refactored bot architecture"
```

### 2. Создайте репозиторий на GitHub (2 минуты)

1. Откройте https://github.com/new
2. Название: `drip-hosting-bot`
3. Приватность: **Private**
4. **НЕ** добавляйте README, .gitignore, лицензию
5. Нажмите **"Create repository"**

### 3. Добавьте GitHub remote (1 минута)

**Вариант A: Заменить GitLab на GitHub**

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/drip-hosting-bot.git
git push -u origin main
```

**Вариант B: Использовать оба (GitLab + GitHub)**

```bash
git remote add github https://github.com/YOUR_USERNAME/drip-hosting-bot.git
git push -u github main
```

### 4. Проверьте (1 минута)

1. Откройте https://github.com/YOUR_USERNAME/drip-hosting-bot
2. Проверьте, что файлы на месте
3. Перейдите в **Actions** → должен запуститься workflow
4. Дождитесь завершения (зеленая галочка ✅)

### 5. Добавьте Secrets (опционально, позже)

**Settings** → **Secrets** → **Actions** → добавить все из `.env`

## ✅ Готово!

Теперь ваш код на GitHub и автоматически тестируется!

**Полная инструкция:** `GITHUB_SETUP_INSTRUCTIONS.md`
