# Deployment Guide

## 🚀 Quick Deployment

### Option 1: Docker (Recommended)

```bash
# Build and run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f bot

# Stop
docker-compose down
```

### Option 2: PM2 (Production)

```bash
# Build the project
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs drip-hosting-bot

# Restart
pm2 restart drip-hosting-bot

# Stop
pm2 stop drip-hosting-bot
```

### Option 3: Direct Node.js

```bash
# Build the project
npm run build

# Start
npm start

# Or with environment variables
NODE_ENV=production npm start
```

## 📋 Pre-Deployment Checklist

- [ ] Copy `.env.example` to `.env` and fill in all required variables
- [ ] Ensure database directory is writable (`data/`)
- [ ] Ensure sessions directory is writable (`sessions/`)
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Build the project: `npm run build`
- [ ] Test locally: `npm start`

## 🔧 Environment Variables

All environment variables are validated on startup. See `src/app/config.ts` for required variables.

**Required:**
- `BOT_TOKEN` - Telegram bot token
- `BOT_USERNAME` - Bot username (without @)
- `WEBSITE_URL` - Your website URL
- `SUPPORT_USERNAME_TG` - Support Telegram username
- Payment provider credentials (AAIO and/or CrystalPay)
- `VMM_EMAIL`, `VMM_PASSWORD`, `VMM_ENDPOINT_URL` - VMManager API credentials

**Optional:**
- `IS_WEBHOOK` - Webhook URL (for webhook mode)
- `PORT_WEBHOOK` - Webhook port (default: 3002)
- `DOMAINR_TOKEN` - Domain checker token
- `NODE_ENV` - Environment (development/production/test)

## 🐳 Docker Deployment

### Build Image

```bash
docker build -t driphosting-bot:latest .
```

### Run Container

```bash
docker run -d \
  --name drip-hosting-bot \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/sessions:/app/sessions \
  -p 3002:3002 \
  driphosting-bot:latest
```

### Docker Compose

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build
```

## 📱 PM2 Deployment

### Install PM2 (if not installed)

```bash
npm install -g pm2
```

### Start with Ecosystem Config

```bash
pm2 start ecosystem.config.js
```

### Useful PM2 Commands

```bash
# List all processes
pm2 list

# View logs
pm2 logs drip-hosting-bot

# Monitor
pm2 monit

# Restart
pm2 restart drip-hosting-bot

# Stop
pm2 stop drip-hosting-bot

# Delete
pm2 delete drip-hosting-bot

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

## 🔍 Health Checks

### Webhook Mode

If using webhook mode, health check endpoint is available at:
- `http://localhost:3002/health`

### Long Polling Mode

Monitor bot logs for successful startup:
```
[INFO] Bot initialized successfully
[INFO] PaymentStatusChecker started
[INFO] ExpirationService started
[INFO] Bot started in long polling mode
```

## 📊 Monitoring

### Logs Location

- Docker: `docker-compose logs -f bot`
- PM2: `pm2 logs drip-hosting-bot`
- Direct: Console output

### Log Levels

- `DEBUG` - Detailed debugging information (development only)
- `INFO` - General information
- `WARN` - Warning messages
- `ERROR` - Error messages (always logged)

## 🔒 Security Notes

1. **Never commit `.env` file** - Contains sensitive credentials
2. **Use strong passwords** - For VMManager and payment providers
3. **Keep dependencies updated** - Run `npm audit` regularly
4. **Use HTTPS** - For webhook URLs in production
5. **Restrict file permissions** - Database and session files should be protected

## 🚨 Troubleshooting

### Bot doesn't start

1. Check environment variables: `cat .env`
2. Check logs: `docker-compose logs bot` or `pm2 logs`
3. Verify database permissions: `ls -la data/`
4. Check Node.js version: `node --version` (should be 18+)

### Database errors

1. Ensure `data/` directory is writable
2. Check disk space: `df -h`
3. Verify SQLite permissions

### Payment issues

1. Verify payment provider credentials in `.env`
2. Check payment provider API status
3. Review payment logs in bot output

### VMManager errors

1. Verify VMManager credentials
2. Check VMManager API endpoint accessibility
3. Review VMManager logs

## 📝 Updating

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart
pm2 restart drip-hosting-bot
# or
docker-compose restart bot
```

## 🔄 Backup

Important files to backup:

- `data/data.db` - Database file
- `sessions/` - User session files
- `.env` - Environment configuration

```bash
# Backup database
cp data/data.db backup/data-$(date +%Y%m%d).db

# Backup sessions
tar -czf backup/sessions-$(date +%Y%m%d).tar.gz sessions/
```
