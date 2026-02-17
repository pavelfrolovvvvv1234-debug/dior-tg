# 🚀 Деплой на VPS без Git репозитория

## Вариант 1: Загрузка через SCP (простой способ)

### Шаг 1: Подготовка файлов на локальной машине

**На Windows (PowerShell):**

```powershell
# Перейди в папку проекта
cd C:\Users\xd-user\Desktop\dior\bot

# Создай архив проекта (исключая ненужные файлы)
# Используй WinRAR или 7-Zip, или PowerShell:
Compress-Archive -Path * -DestinationPath dior-bot.zip -Exclude node_modules,dist,data,sessions,logs,.env
```

**Или создай архив вручную:**
- Выдели все файлы в папке `bot`
- Исключи: `node_modules`, `dist`, `data`, `sessions`, `logs`, `.env`
- Создай ZIP архив

### Шаг 2: Загрузка на VPS

**Через SCP (из PowerShell или Git Bash):**

```bash
# Замени user и your-vps-ip на свои данные
scp dior-bot.zip user@your-vps-ip:~/
```

**Или через WinSCP (GUI):**
1. Скачай WinSCP: https://winscp.net/
2. Подключись к VPS
3. Перетащи архив в домашнюю директорию

### Шаг 3: Настройка на VPS

```bash
# Подключись к VPS
ssh user@your-vps-ip

# Установи Node.js и PM2 (если еще не установлены)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3
sudo npm install -g pm2

# Распакуй архив
cd ~
unzip dior-bot.zip -d dior-bot
cd dior-bot

# Создай .env файл
cp .env.example .env
nano .env
# Заполни все переменные (BOT_TOKEN, VMM_EMAIL, etc.)

# Установи зависимости
npm install

# Собери проект
npm run build

# Создай необходимые директории
mkdir -p data sessions logs
chmod 755 data sessions logs

# Запусти через PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Выполни команду, которую выведет PM2

# Проверь статус
pm2 status
pm2 logs dior-host-bot
```

---

## Вариант 2: Загрузка через rsync (для обновлений)

**На Windows установи Git Bash или используй WSL:**

```bash
# Из Git Bash или WSL
rsync -avz --exclude 'node_modules' \
           --exclude 'dist' \
           --exclude 'data' \
           --exclude 'sessions' \
           --exclude 'logs' \
           --exclude '.env' \
           --exclude '.git' \
           ./ user@your-vps-ip:~/dior-bot/
```

---

## Вариант 3: Создание репозитория на GitHub (рекомендуется для будущего)

Если хочешь создать репозиторий для удобства обновлений:

### 1. Создай репозиторий на GitHub
- Зайди на https://github.com
- Создай новый приватный репозиторий (например, `dior-bot`)

### 2. Загрузи код

**На локальной машине (PowerShell):**

```powershell
cd C:\Users\xd-user\Desktop\dior\bot

# Инициализируй Git (если еще не сделано)
git init

# Добавь все файлы (кроме тех что в .gitignore)
git add .

# Создай первый коммит
git commit -m "Initial commit"

# Добавь remote репозиторий
git remote add origin https://github.com/YOUR_USERNAME/dior-bot.git

# Загрузи на GitHub
git branch -M main
git push -u origin main
```

### 3. На VPS клонируй репозиторий

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/dior-bot.git
cd dior-bot

# Создай .env
cp .env.example .env
nano .env

# Установи и запусти
npm install
npm run build
mkdir -p data sessions logs
pm2 start ecosystem.config.js
pm2 save
```

---

## Быстрый скрипт для загрузки (Windows PowerShell)

Создай файл `upload-to-vps.ps1`:

```powershell
# upload-to-vps.ps1
$VPS_USER = "user"
$VPS_IP = "your-vps-ip"
$VPS_PATH = "~/dior-bot"

# Создай архив
Write-Host "📦 Создаю архив..." -ForegroundColor Green
Compress-Archive -Path * -DestinationPath dior-bot-temp.zip -Force

# Загрузи на VPS
Write-Host "⬆️  Загружаю на VPS..." -ForegroundColor Green
scp dior-bot-temp.zip "${VPS_USER}@${VPS_IP}:~/"

# Удали временный архив
Remove-Item dior-bot-temp.zip

Write-Host "✅ Загрузка завершена!" -ForegroundColor Green
Write-Host "Теперь на VPS выполни:" -ForegroundColor Yellow
Write-Host "  cd ~ && unzip dior-bot-temp.zip -d dior-bot && cd dior-bot" -ForegroundColor Cyan
```

---

## Обновление бота без Git

Если нужно обновить код на VPS:

1. **На локальной машине:** Создай новый архив (исключая `node_modules`, `dist`, `data`, `sessions`, `logs`)
2. **Загрузи на VPS:** `scp dior-bot.zip user@vps-ip:~/`
3. **На VPS:**
   ```bash
   cd ~/dior-bot
   pm2 stop dior-host-bot
   unzip -o ~/dior-bot.zip -d ~/dior-bot-temp
   cp -r ~/dior-bot-temp/* ~/dior-bot/
   rm -rf ~/dior-bot-temp
   npm install
   npm run build
   pm2 restart dior-host-bot
   ```

---

## ⚠️ Важно

1. **НЕ загружай `.env`** на VPS через архив — создай его вручную на сервере
2. **НЕ загружай `node_modules`** — установи через `npm install` на VPS
3. **НЕ загружай `dist`** — собери через `npm run build` на VPS
4. **НЕ загружай `data`, `sessions`, `logs`** — они создадутся автоматически

---

## 📋 Чеклист перед загрузкой

- [ ] Создан архив без `node_modules`, `dist`, `data`, `sessions`, `logs`, `.env`
- [ ] На VPS установлен Node.js 20+
- [ ] На VPS установлен PM2
- [ ] На VPS создан `.env` файл с правильными токенами
- [ ] На VPS установлены зависимости (`npm install`)
- [ ] Проект собран (`npm run build`)
- [ ] Бот запущен через PM2

---

## 🆘 Если что-то не работает

```bash
# Проверь логи
pm2 logs dior-host-bot --lines 100

# Проверь что все файлы на месте
ls -la ~/dior-bot

# Проверь что .env заполнен
cat ~/dior-bot/.env | grep -v "SECRET\|PASSWORD\|TOKEN"

# Пересобери проект
cd ~/dior-bot
rm -rf dist node_modules
npm install
npm run build
pm2 restart dior-host-bot
```
