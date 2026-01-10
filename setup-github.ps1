# PowerShell script для настройки GitHub репозитория
# Запуск: .\setup-github.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GitHub Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка наличия Git
try {
    $gitVersion = git --version
    Write-Host "[OK] Git installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Git not found! Please install Git first." -ForegroundColor Red
    exit 1
}

# Проверка наличия .env
if (Test-Path .env) {
    Write-Host "[OK] .env file exists" -ForegroundColor Green
} else {
    Write-Host "[WARN] .env file not found! You'll need to create it." -ForegroundColor Yellow
}

# Инициализация Git (если еще не инициализирован)
if (-not (Test-Path .git)) {
    Write-Host ""
    Write-Host "[INFO] Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "[OK] Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "[OK] Git repository already initialized" -ForegroundColor Green
}

# Проверка .gitignore
if (Test-Path .gitignore) {
    Write-Host "[OK] .gitignore exists" -ForegroundColor Green
} else {
    Write-Host "[WARN] .gitignore not found!" -ForegroundColor Yellow
}

# Проверка наличия изменений
$status = git status --porcelain
if ($status) {
    Write-Host ""
    Write-Host "[INFO] Uncommitted changes found:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    
    $add = Read-Host "Do you want to add all files? (y/n)"
    if ($add -eq "y" -or $add -eq "Y") {
        git add .
        Write-Host "[OK] Files added" -ForegroundColor Green
        
        $commit = Read-Host "Do you want to commit? (y/n)"
        if ($commit -eq "y" -or $commit -eq "Y") {
            $message = Read-Host "Commit message (default: 'Initial commit: Refactored bot architecture')"
            if ([string]::IsNullOrWhiteSpace($message)) {
                $message = "Initial commit: Refactored bot architecture"
            }
            git commit -m $message
            Write-Host "[OK] Files committed" -ForegroundColor Green
        }
    }
} else {
    Write-Host "[OK] No uncommitted changes" -ForegroundColor Green
}

# Проверка remote
$remote = git remote -v
if ($remote) {
    Write-Host ""
    Write-Host "[OK] Remote repository configured:" -ForegroundColor Green
    git remote -v
} else {
    Write-Host ""
    Write-Host "[INFO] No remote repository configured" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To connect to GitHub:" -ForegroundColor Cyan
    Write-Host "1. Create a new repository on GitHub (https://github.com/new)" -ForegroundColor White
    Write-Host "2. Run these commands:" -ForegroundColor White
    Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git" -ForegroundColor Gray
    Write-Host "   git branch -M main" -ForegroundColor Gray
    Write-Host "   git push -u origin main" -ForegroundColor Gray
    Write-Host ""
    
    $setupRemote = Read-Host "Do you want to setup remote now? (y/n)"
    if ($setupRemote -eq "y" -or $setupRemote -eq "Y") {
        $repoUrl = Read-Host "Enter GitHub repository URL (e.g., https://github.com/username/repo.git)"
        if ($repoUrl) {
            git remote add origin $repoUrl
            Write-Host "[OK] Remote added: $repoUrl" -ForegroundColor Green
            
            $branch = Read-Host "Branch name (default: main)"
            if ([string]::IsNullOrWhiteSpace($branch)) {
                $branch = "main"
            }
            git branch -M $branch
            
            $push = Read-Host "Do you want to push to GitHub now? (y/n)"
            if ($push -eq "y" -or $push -eq "Y") {
                git push -u origin $branch
                Write-Host "[OK] Code pushed to GitHub!" -ForegroundColor Green
            }
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Add secrets to GitHub (Settings → Secrets → Actions)" -ForegroundColor White
Write-Host "   See GITHUB_SETUP.md for list of required secrets" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Check GitHub Actions after push:" -ForegroundColor White
Write-Host "   https://github.com/YOUR_USERNAME/YOUR_REPO/actions" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Read GITHUB_SETUP.md for detailed instructions" -ForegroundColor White
Write-Host ""
