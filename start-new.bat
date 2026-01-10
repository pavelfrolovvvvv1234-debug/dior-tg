@echo off
REM Quick start script for NEW architecture (Windows)
echo ============================================
echo   DripHosting Bot - NEW Architecture
echo ============================================
echo.

REM Backup old index.ts and use new one
if exist src\index.old.ts (
    echo [INFO] Old backup already exists, using current setup
) else (
    echo [INFO] Creating backup of old index.ts...
    if exist src\index.ts (
        copy src\index.ts src\index.old.ts >nul
    )
)

if exist src\index.new.ts (
    echo [INFO] Using new architecture (index.new.ts)...
    copy src\index.new.ts src\index.temp.ts >nul
    
    REM Temporarily replace index.ts with new one
    if exist src\index.ts (
        del src\index.ts
    )
    copy src\index.temp.ts src\index.ts >nul
    del src\index.temp.ts >nul
) else (
    echo [WARNING] index.new.ts not found! Using old index.ts
)

REM Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found!
    pause
    exit /b 1
)

echo.
echo [INFO] Starting bot with NEW architecture...
echo [INFO] Press Ctrl+C to stop
echo.

call npm run dev

pause
