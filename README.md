# Dior Host Bot

Production-ready Telegram bot built with grammY, TypeORM, SQLite, and Fluent i18n. Features payment integration (CrystalPay/CryptoBot), VMManager API, domain management, and service provisioning.

## 📋 Requirements

- **Node.js**: v18+ (v20–22 recommended; matches Docker/CI)
- **npm**: Comes with Node.js
- **SQLite3**: System dependency

## 🚀 Quick Start

### 1. Installation

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
BOT_TOKEN="your_telegram_bot_token"
WEBSITE_URL="https://diorhost.com/"
SUPPORT_USERNAME_TG="diorhost"
BOT_USERNAME="your_bot_username"

# Payment providers (at least one required)
PAYMENT_CRYSTALPAY_ID="..."
PAYMENT_CRYSTALPAY_SECRET_ONE="..."
PAYMENT_CRYSTALPAY_SECRET_TWO="..."

# VMManager API
VMM_EMAIL="example@example.com"
VMM_PASSWORD="your_password"
VMM_ENDPOINT_URL="https://vm.diorhost.com/"

# Optional
DOMAINR_TOKEN="domain_checker_token"
```

### 3. Database Initialization

The database is created automatically on first run via TypeORM synchronization.

### 4. Development

```bash
# Start with hot-reload (nodemon)
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
```

## 🏗 Project Structure

```
src/
├── app/              # Bootstrap & configuration
│   ├── bot.ts       # Bot initialization
│   ├── config.ts    # Environment validation (Zod)
│   └── server.ts    # Webhook server (if enabled)
├── domain/          # Business logic layer
│   ├── billing/     # Payment & balance logic
│   ├── services/    # VDS & domain service logic
│   └── users/       # User management
├── infrastructure/  # External integrations
│   ├── db/         # TypeORM datasource & repositories
│   ├── payments/   # Payment provider adapters
│   └── vmmanager/  # VMManager API client
├── ui/             # Telegram UI layer
│   ├── screens/    # Screen renderers
│   ├── menus/      # Grammy menu definitions
│   └── components/ # Reusable UI components
└── shared/         # Shared utilities
    ├── errors/     # Error handling
    ├── types/      # TypeScript types
    └── utils/      # Helper functions
```

## 📦 Scripts

```bash
npm run dev          # Start development server (nodemon)
npm run build        # Compile TypeScript to dist/
npm start            # Run production build
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run typecheck    # Type check without emitting
npm test             # Run tests
```

## 🌐 Localization

Supported languages:
- Russian (`ru`) — default
- English (`en`)

Translation files are located in `locales/{lang}/`:
- `translation.ftl` - General translations
- `services.ftl` - Service-specific translations

## 🔒 Security

- Never commit `.env`, `data.db`, `sessions/`, or `dist/`
- All environment variables are validated on startup via Zod
- Sensitive operations use database transactions
- Rate limiting on sensitive commands

## 🖥 Deploy on VPS (after code changes)

Чтобы бот на VPS собирался и запускался, репозиторий на сервере должен совпадать с тем, где сделаны правки.

1. **На своей машине (где правки):** закоммитить и запушить всё в `main`:
   ```bash
   git add -A
   git status   # убедиться, что в коммит попадают нужные файлы
   git commit -m "fix: TypeScript and session/context types for build"
   git push origin main
   ```

2. **На VPS:** подтянуть код и пересобрать:
   ```bash
   cd ~/dior-tg
   git fetch origin
   git reset --hard origin/main
   npm ci
   npm run build
   pm2 restart all
   ```
   Если `git pull` пишет "Already up to date", но ошибки сборки остаются — значит с dev-машины ещё не был выполнен `git push`. Сначала пуш с той машины, где правили код.

3. Ошибка **`Cannot find module '@/database'`** после сборки: после `npm run build` выполнить `npm run fix-dist` (или вручную заменить в `dist/*.js` все `require("@/...")` на относительные пути). В `package.json` должен быть скрипт `"fix-dist": "node scripts/fix-dist-aliases.cjs || node scripts/fix-dist-fallback.cjs"`.

## 🐳 Docker Deployment

```bash
# Build image
docker build -t dior-host-bot .

# Run with docker-compose
docker-compose up -d
```

See `Dockerfile` and `docker-compose.yml` for details.

## 🔄 GitHub Setup & CI/CD

Проект настроен для работы с GitHub Actions:

### Быстрая настройка:

```bash
# Windows - используйте скрипт:
.\setup-github.ps1

# Linux/Mac - используйте скрипт:
chmod +x setup-github.sh && ./setup-github.sh

# Или вручную:
git init
git add .
git commit -m "Initial commit: Refactored bot architecture"
git remote add origin https://github.com/YOUR_USERNAME/drip-hosting-bot.git
git branch -M main
git push -u origin main
```

### Настройка Secrets в GitHub:

1. Перейдите: **Settings** → **Secrets and variables** → **Actions**
2. Добавьте все переменные из `.env` как secrets
3. См. `GITHUB_SETUP.md` для детальной инструкции

### GitHub Actions Workflows:

- ✅ **CI Pipeline** - автоматическое тестирование при каждом push
- ✅ **Test Bot** - проверка функциональности при pull requests
- ✅ **Deploy Bot** - автоматический деплой при push в main/master

См. `.github/workflows/` для деталей.

**Документация:**
- `GITHUB_SETUP.md` - Детальная инструкция по настройке GitHub
- `GIT_COMMANDS.md` - Полезные Git команды

## 📱 PM2 Deployment

For production deployment with PM2:

```bash
# Start with ecosystem config
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs driphosting-bot
```

See `ecosystem.config.js` for configuration.

## ⚙️ Webhook Mode

> ⚠️ **Not recommended** - Webhook mode is unstable. Use long polling instead.

If you must use webhooks:

1. Set up an HTTPS endpoint
2. Add to `.env`:
   ```env
   IS_WEBHOOK="https://your-domain.com/webhook"
   PORT_WEBHOOK="3002"
   ```
3. Ensure SSL certificate is valid
4. Restart the bot

## 🔧 Configuration

All configuration is validated via `src/app/config.ts` using Zod schemas. Missing or invalid environment variables will cause the bot to exit with a clear error message.

## 📝 Development Guidelines

1. **Architecture**: Follow clean architecture principles (domain → infrastructure → UI)
2. **Types**: Use TypeScript strictly - no `any` types
3. **Testing**: Write unit tests for business logic
4. **UX**: Use `editMessageText` instead of new messages when possible
5. **Errors**: Always handle errors gracefully with user-friendly messages

## 🤝 Contributing

1. Follow the existing code style (ESLint + Prettier)
2. Write tests for new features
3. Update translations for UI changes
4. Update README if needed

## 📄 License

PRIVATE

## 🆘 Support

For issues or questions, contact the support team via Telegram: @drip_sup
