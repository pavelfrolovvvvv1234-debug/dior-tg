# DripHosting Bot

Production-ready Telegram bot built with grammY, TypeORM, SQLite, and Fluent i18n. Features payment integration (AAIO/CrystalPay), VMManager API, domain management, and service provisioning.

## 📋 Requirements

- **Node.js**: v18+ (v23 recommended)
- **pnpm**: Latest version ([installation guide](https://pnpm.io/installation))
- **SQLite3**: System dependency

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
pnpm install
```

### 2. Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
BOT_TOKEN="your_telegram_bot_token"
WEBSITE_URL="https://driphosting.com/"
SUPPORT_USERNAME_TG="drip_sup"
BOT_USERNAME="your_bot_username"

# Payment providers (at least one required)
PAYMENT_AAIO_ID="..."
PAYMENT_AAIO_SECRET_ONE="..."
PAYMENT_AAIO_SECRET_TWO="..."
PAYMENT_AAIO_TOKEN="..."

PAYMENT_CRYSTALPAY_ID="..."
PAYMENT_CRYSTALPAY_SECRET_ONE="..."
PAYMENT_CRYSTALPAY_SECRET_TWO="..."

# VMManager API
VMM_EMAIL="example@example.com"
VMM_PASSWORD="your_password"
VMM_ENDPOINT_URL="https://vm.driphosting.com/"

# Optional
DOMAINR_TOKEN="domain_checker_token"
```

### 3. Database Initialization

The database will be automatically created and initialized on first run using TypeORM synchronization. For production, consider using migrations:

```bash
# Generate migration (when ready)
pnpm run migration:generate

# Run migrations
pnpm run migration:run
```

### 4. Development

```bash
# Start with hot-reload (nodemon)
pnpm dev

# Build TypeScript
pnpm build

# Run production build
pnpm start
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
pnpm dev          # Start development server (nodemon)
pnpm build        # Compile TypeScript to dist/
pnpm start        # Run production build
pnpm lint         # Run ESLint
pnpm format       # Format code with Prettier
pnpm typecheck    # Type check without emitting
pnpm test         # Run tests
```

## 🌐 Localization

Supported languages:
- English (`en`) - Default
- Russian (`ru`)

Translation files are located in `locales/{lang}/`:
- `translation.ftl` - General translations
- `services.ftl` - Service-specific translations

## 🔒 Security

- Never commit `.env`, `data.db`, `sessions/`, or `dist/`
- All environment variables are validated on startup via Zod
- Sensitive operations use database transactions
- Rate limiting on sensitive commands

## 🐳 Docker Deployment

```bash
# Build image
docker build -t driphosting-bot .

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
