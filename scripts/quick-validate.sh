#!/bin/bash

# 🔍 Quick Validation Script - Fast syntax and structure check

echo "🔍 Quick Validation for ML Ecosystem"
echo "===================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

errors=0
warnings=0

# Check file structure
echo "📁 Checking file structure..."

critical_files=(
    "services/user-service/src/app.js"
    "services/user-service/src/routes/auth.js"
    "services/user-service/src/models/User.js"
    "services/integration-service/src/app.js"
    "services/integration-service/src/routes/ml-api.js"
    "services/integration-service/src/utils/mlRateLimiter.js"
    "package.json"
    ".env.example"
)

for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
    else
        echo -e "${RED}❌${NC} $file (missing)"
        errors=$((errors + 1))
    fi
done

# Check syntax
echo ""
echo "🔧 Checking syntax..."

services=("user-service" "integration-service")

for service in "${services[@]}"; do
    if [ -f "services/$service/src/app.js" ]; then
        cd "services/$service"
        if node -c src/app.js 2>/dev/null; then
            echo -e "${GREEN}✅${NC} $service syntax check passed"
        else
            echo -e "${RED}❌${NC} $service syntax check failed"
            errors=$((errors + 1))
        fi
        cd ../..
    fi
done

# Check package.json structure
echo ""
echo "📦 Checking package.json files..."

for service in "${services[@]}"; do
    if [ -f "services/$service/package.json" ]; then
        if python3 -c "import json; json.load(open('services/$service/package.json'))" 2>/dev/null; then
            echo -e "${GREEN}✅${NC} $service package.json is valid JSON"
        else
            echo -e "${RED}❌${NC} $service package.json is invalid"
            errors=$((errors + 1))
        fi
    fi
done

# Check environment setup
echo ""
echo "🔐 Checking environment setup..."

if [ -f ".env" ]; then
    echo -e "${GREEN}✅${NC} .env file exists"
else
    echo -e "${YELLOW}⚠️${NC} .env file missing (will be created from .env.example)"
    warnings=$((warnings + 1))
fi

if [ -f ".env.example" ]; then
    echo -e "${GREEN}✅${NC} .env.example template exists"
else
    echo -e "${RED}❌${NC} .env.example template missing"
    errors=$((errors + 1))
fi

# Check Docker setup (optional)
echo ""
echo "🐳 Checking Docker setup..."

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅${NC} Docker is available"
else
    echo -e "${YELLOW}⚠️${NC} Docker not available (some features may be limited)"
    warnings=$((warnings + 1))
fi

# Check Node.js version
echo ""
echo "🟢 Checking Node.js..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo -e "${GREEN}✅${NC} Node.js $NODE_VERSION (compatible)"
    else
        echo -e "${RED}❌${NC} Node.js $NODE_VERSION (requires 18+)"
        errors=$((errors + 1))
    fi
else
    echo -e "${RED}❌${NC} Node.js not found"
    errors=$((errors + 1))
fi

# Summary
echo ""
echo "📊 Validation Summary"
echo "===================="

if [ $errors -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical checks passed!${NC}"
    echo "✅ File structure: Complete"
    echo "✅ Syntax validation: Passed"
    echo "✅ Configuration: Ready"
    
    if [ $warnings -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $warnings warnings detected${NC}"
    fi
    
    echo ""
    echo "🚀 Ready for development!"
    echo "Next steps:"
    echo "1. Run './scripts/dev-setup.sh' for full setup"
    echo "2. Configure .env with your ML credentials"
    echo "3. Run 'npm run dev' to start services"
    
    exit 0
else
    echo -e "${RED}❌ $errors critical errors detected${NC}"
    echo -e "${YELLOW}⚠️  $warnings warnings detected${NC}"
    echo ""
    echo "Please fix the errors above before proceeding."
    exit 1
fi