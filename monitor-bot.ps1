# Simple bot monitor script
# Checks if bot is running and restarts if needed

Write-Host "=== Bot Monitor ===" -ForegroundColor Cyan
Write-Host ""

$botProcess = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*bot*" -or $_.CommandLine -like "*index.ts*" }

if ($botProcess) {
    Write-Host "✅ Bot is running (PID: $($botProcess.Id))" -ForegroundColor Green
    Write-Host "   Started: $($botProcess.StartTime)" -ForegroundColor Gray
    Write-Host "   Runtime: $((Get-Date) - $botProcess.StartTime)" -ForegroundColor Gray
} else {
    Write-Host "❌ Bot is NOT running" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start the bot, run: npm run dev" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Database Status ===" -ForegroundColor Cyan

if (Test-Path "data.db") {
    $dbSize = (Get-Item "data.db").Length
    Write-Host "✅ Database exists ($([math]::Round($dbSize/1KB, 2)) KB)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Database file not found" -ForegroundColor Yellow
}

if (Test-Path "data.db-shm") {
    Write-Host "⚠️  Database lock file exists (data.db-shm)" -ForegroundColor Yellow
    Write-Host "   This might indicate a locked database" -ForegroundColor Gray
}

if (Test-Path "data.db-wal") {
    Write-Host "ℹ️  Database WAL file exists (data.db-wal)" -ForegroundColor Cyan
    Write-Host "   This is normal for SQLite" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Quick Fixes ===" -ForegroundColor Cyan
Write-Host "1. If bot crashed, check logs above" -ForegroundColor White
Write-Host "2. If database is locked, close all Node processes:" -ForegroundColor White
Write-Host "   taskkill /F /IM node.exe" -ForegroundColor Gray
Write-Host "3. Restart bot: npm run dev" -ForegroundColor White
