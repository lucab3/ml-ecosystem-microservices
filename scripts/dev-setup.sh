#!/bin/bash

# 🛠️ Development Setup Script for ML Ecosystem Microservices
# Sets up local development environment with all dependencies

set -e

echo "🛠️  ML Ecosystem Development Setup"
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_status "Checking system requirements..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18+"
    exit 1
fi

print_success "Node.js $(node --version) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install npm"
    exit 1
fi

print_success "npm $(npm --version) detected"

# Check Docker (optional)
if command -v docker &> /dev/null; then
    print_success "Docker $(docker --version | cut -d' ' -f3 | sed 's/,//') detected"
    DOCKER_AVAILABLE=true
else
    print_warning "Docker not found. Some features may be limited."
    DOCKER_AVAILABLE=false
fi

# Setup environment
print_status "Setting up environment configuration..."

if [ ! -f .env ]; then
    cp .env.example .env
    print_success "Created .env file from template"
    print_warning "Please edit .env file with your MercadoLibre API credentials:"
    print_warning "  - ML_CLIENT_ID=your_client_id"
    print_warning "  - ML_CLIENT_SECRET=your_client_secret"
    print_warning "  - JWT_SECRET=your_random_secret_key"
else
    print_status ".env file already exists"
fi

# Install root dependencies
print_status "Installing root dependencies..."
npm install

# Install service dependencies
print_status "Installing service dependencies..."

services=("user-service" "integration-service" "catalog-service" "analytics-service" "inventory-service" "notification-service")

for service in "${services[@]}"; do
    if [ -d "services/$service" ]; then
        print_status "Installing dependencies for $service..."
        (cd "services/$service" && npm install)
        print_success "$service dependencies installed"
    else
        print_warning "Service directory services/$service not found"
    fi
done

# Setup test dependencies
print_status "Installing test dependencies..."

test_packages=("supertest" "nock" "jest")
for package in "${test_packages[@]}"; do
    if ! npm list "$package" &>/dev/null; then
        print_status "Installing test package: $package"
        npm install --save-dev "$package"
    fi
done

# Create development scripts
print_status "Creating development scripts..."

# Create package.json scripts if they don't exist
npm pkg set scripts.dev="concurrently \"npm run dev:user\" \"npm run dev:integration\""
npm pkg set scripts.dev:user="cd services/user-service && npm run dev"
npm pkg set scripts.dev:integration="cd services/integration-service && npm run dev"
npm pkg set scripts.test:local="./scripts/local-test.sh"
npm pkg set scripts.setup="./scripts/dev-setup.sh"

# Setup Git hooks (if .git exists)
if [ -d .git ]; then
    print_status "Setting up Git hooks..."
    
    # Pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."

# Check syntax
npm run test:syntax 2>/dev/null || {
    echo "❌ Syntax check failed"
    exit 1
}

echo "✅ Pre-commit checks passed"
EOF

    chmod +x .git/hooks/pre-commit
    print_success "Git hooks installed"
fi

# Create development database setup
if [ "$DOCKER_AVAILABLE" = true ]; then
    print_status "Setting up development databases with Docker..."
    
    # Create docker-compose for development
    cat > docker-compose.dev.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: ml_ecosystem
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

volumes:
  postgres_data:
  redis_data:
EOF

    print_success "Development Docker setup created"
    print_status "To start development databases: docker-compose -f docker-compose.dev.yml up -d"
fi

# Create helpful development commands
print_status "Creating development utilities..."

# Health check script
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash
echo "🏥 Health Check for ML Ecosystem Services"
echo "========================================"

services=(
    "user-service:3001"
    "integration-service:3002"
    "catalog-service:3003"
    "analytics-service:3005"
)

for service_port in "${services[@]}"; do
    service=$(echo $service_port | cut -d':' -f1)
    port=$(echo $service_port | cut -d':' -f2)
    
    if curl -s "http://localhost:$port/health" > /dev/null; then
        echo "✅ $service (port $port) - Healthy"
    else
        echo "❌ $service (port $port) - Unhealthy"
    fi
done
EOF

chmod +x scripts/health-check.sh

# Service restart script
cat > scripts/restart-service.sh << 'EOF'
#!/bin/bash
if [ -z "$1" ]; then
    echo "Usage: $0 <service-name>"
    echo "Available services: user-service, integration-service, catalog-service, analytics-service"
    exit 1
fi

SERVICE=$1
echo "🔄 Restarting $SERVICE..."

# Kill existing process
pkill -f "services/$SERVICE" || true

# Start service
cd "services/$SERVICE"
npm run dev &
echo "✅ $SERVICE restarted"
EOF

chmod +x scripts/restart-service.sh

# Create VS Code settings (if .vscode doesn't exist)
if [ ! -d .vscode ]; then
    mkdir -p .vscode
    
    cat > .vscode/settings.json << 'EOF'
{
    "editor.tabSize": 2,
    "editor.insertSpaces": true,
    "javascript.preferences.quoteStyle": "single",
    "typescript.preferences.quoteStyle": "single",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    },
    "files.exclude": {
        "**/node_modules": true,
        "**/coverage": true,
        "**/.nyc_output": true
    },
    "search.exclude": {
        "**/node_modules": true,
        "**/coverage": true
    }
}
EOF

    cat > .vscode/launch.json << 'EOF'
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug User Service",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/services/user-service/src/server.js",
            "env": {
                "NODE_ENV": "development"
            },
            "console": "integratedTerminal"
        },
        {
            "name": "Debug Integration Service",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/services/integration-service/src/server.js",
            "env": {
                "NODE_ENV": "development"
            },
            "console": "integratedTerminal"
        }
    ]
}
EOF

    print_success "VS Code configuration created"
fi

# Setup complete
echo ""
echo "🎉 Development Setup Complete!"
echo "=============================="
echo ""
echo "📋 Next Steps:"
echo "1. Edit .env file with your MercadoLibre credentials"
echo "2. Start development databases: docker-compose -f docker-compose.dev.yml up -d"
echo "3. Run local tests: npm run test:local"
echo "4. Start development servers: npm run dev"
echo "5. Check service health: ./scripts/health-check.sh"
echo ""
echo "🔧 Available Commands:"
echo "  npm run dev              - Start all development services"
echo "  npm run test:local       - Run comprehensive local tests"
echo "  ./scripts/health-check.sh - Check service health"
echo "  ./scripts/restart-service.sh <service> - Restart a specific service"
echo ""
print_success "Happy coding! 🚀"