#!/bin/bash
# Bash script для настройки GitHub репозитория (Linux/Mac)
# Запуск: chmod +x setup-github.sh && ./setup-github.sh

echo "========================================"
echo "  GitHub Setup Script"
echo "========================================"
echo ""

# Проверка наличия Git
if ! command -v git &> /dev/null; then
    echo "[ERROR] Git not found! Please install Git first."
    exit 1
fi

echo "[OK] Git installed: $(git --version)"

# Проверка наличия .env
if [ -f .env ]; then
    echo "[OK] .env file exists"
else
    echo "[WARN] .env file not found! You'll need to create it."
fi

# Инициализация Git (если еще не инициализирован)
if [ ! -d .git ]; then
    echo ""
    echo "[INFO] Initializing Git repository..."
    git init
    echo "[OK] Git repository initialized"
else
    echo "[OK] Git repository already initialized"
fi

# Проверка .gitignore
if [ -f .gitignore ]; then
    echo "[OK] .gitignore exists"
else
    echo "[WARN] .gitignore not found!"
fi

# Проверка наличия изменений
if [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo "[INFO] Uncommitted changes found:"
    git status --short
    echo ""
    
    read -p "Do you want to add all files? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        echo "[OK] Files added"
        
        read -p "Do you want to commit? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "Commit message (default: 'Initial commit: Refactored bot architecture'): " message
            message=${message:-"Initial commit: Refactored bot architecture"}
            git commit -m "$message"
            echo "[OK] Files committed"
        fi
    fi
else
    echo "[OK] No uncommitted changes"
fi

# Проверка remote
if git remote -v | grep -q origin; then
    echo ""
    echo "[OK] Remote repository configured:"
    git remote -v
else
    echo ""
    echo "[INFO] No remote repository configured"
    echo ""
    echo "To connect to GitHub:"
    echo "1. Create a new repository on GitHub (https://github.com/new)"
    echo "2. Run these commands:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
    
    read -p "Do you want to setup remote now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter GitHub repository URL: " repo_url
        if [ -n "$repo_url" ]; then
            git remote add origin "$repo_url"
            echo "[OK] Remote added: $repo_url"
            
            read -p "Branch name (default: main): " branch
            branch=${branch:-main}
            git branch -M "$branch"
            
            read -p "Do you want to push to GitHub now? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git push -u origin "$branch"
                echo "[OK] Code pushed to GitHub!"
            fi
        fi
    fi
fi

echo ""
echo "========================================"
echo "  Next Steps:"
echo "========================================"
echo "1. Add secrets to GitHub (Settings → Secrets → Actions)"
echo "   See GITHUB_SETUP.md for list of required secrets"
echo ""
echo "2. Check GitHub Actions after push:"
echo "   https://github.com/YOUR_USERNAME/YOUR_REPO/actions"
echo ""
echo "3. Read GITHUB_SETUP.md for detailed instructions"
echo ""
