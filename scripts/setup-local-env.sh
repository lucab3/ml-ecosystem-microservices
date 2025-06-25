#!/bin/bash

# ML Ecosystem - Local Environment Setup Script
# Sets up databases and environment without Docker

set -e

echo "🚀 Setting up ML Ecosystem local development environment..."

# Function to check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not installed"
        return 1
    else
        echo "✅ $1 is available"
        return 0
    fi
}

# Check required dependencies
echo "📋 Checking dependencies..."

# Node.js
if check_command node; then
    NODE_VERSION=$(node --version)
    echo "   Node.js version: $NODE_VERSION"
fi

# NPM
if check_command npm; then
    NPM_VERSION=$(npm --version)
    echo "   NPM version: $NPM_VERSION"
fi

# Check optional dependencies
echo ""
echo "📋 Checking optional dependencies..."

DOCKER_AVAILABLE=false
if check_command docker; then
    DOCKER_AVAILABLE=true
    echo "   Docker is available - can use containerized databases"
else
    echo "   Docker not available - will use alternative setup"
fi

# PostgreSQL
POSTGRES_AVAILABLE=false
if check_command psql; then
    POSTGRES_AVAILABLE=true
    echo "   PostgreSQL client available"
fi

# Redis
REDIS_AVAILABLE=false
if check_command redis-cli; then
    REDIS_AVAILABLE=true
    echo "   Redis client available"
fi

# MongoDB
MONGO_AVAILABLE=false
if check_command mongosh || check_command mongo; then
    MONGO_AVAILABLE=true
    echo "   MongoDB client available"
fi

echo ""
echo "🔧 Setting up environment files..."

# Create .env file for development
cat > .env << 'EOF'
# ML Ecosystem - Development Environment
NODE_ENV=development

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ml_ecosystem
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redispass

# MongoDB Configuration
MONGODB_URI=mongodb://admin:password@localhost:27017/ml_ecosystem

# Kafka Configuration
KAFKA_BROKER=localhost:9092

# MercadoLibre API Configuration (MOCK for development)
ML_CLIENT_ID=mock_client_id
ML_CLIENT_SECRET=mock_client_secret
ML_REDIRECT_URI=http://localhost:3001/auth/callback
ML_API_BASE_URL=http://localhost:3333

# JWT Configuration
JWT_SECRET=dev_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=24h

# Service Ports
USER_SERVICE_PORT=3001
INTEGRATION_SERVICE_PORT=3002
CATALOG_SERVICE_PORT=3003
ANALYTICS_SERVICE_PORT=3004
INVENTORY_SERVICE_PORT=3005
NOTIFICATION_SERVICE_PORT=3006

# Mock ML API
MOCK_ML_API_PORT=3333
EOF

echo "✅ Created .env file with development configuration"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."

if [ -f "package.json" ]; then
    npm install
    echo "✅ Root dependencies installed"
fi

# Install service dependencies
for service_dir in services/*/; do
    if [ -d "$service_dir" ] && [ -f "${service_dir}package.json" ]; then
        service_name=$(basename "$service_dir")
        echo "   Installing dependencies for $service_name..."
        (cd "$service_dir" && npm install)
    fi
done

echo "✅ All service dependencies installed"

# Setup database configuration based on available tools
echo ""
echo "🗄️  Setting up database configuration..."

if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "📋 Docker is available - you can use containerized databases:"
    echo "   Run: docker compose -f docker-compose.dev.yml up -d"
    echo ""
    echo "   This will start:"
    echo "   - PostgreSQL on port 5432"
    echo "   - Redis on port 6379"
    echo "   - MongoDB on port 27017"
    echo "   - Kafka on port 9092"
    echo "   - Mock ML API on port 3333"
    echo ""
    echo "   Database URLs:"
    echo "   - PostgreSQL: postgresql://postgres:password@localhost:5432/ml_ecosystem"
    echo "   - Redis: redis://:redispass@localhost:6379"
    echo "   - MongoDB: mongodb://admin:password@localhost:27017/ml_ecosystem"
    echo ""
    echo "   Admin interfaces:"
    echo "   - Adminer (PostgreSQL): http://localhost:8080"
    echo "   - Redis Commander: http://localhost:8081"
else
    echo "⚠️  Docker not available. Alternative database setup options:"
    echo ""
    
    if [ "$POSTGRES_AVAILABLE" = true ]; then
        echo "✅ PostgreSQL client available"
        echo "   You can connect to an existing PostgreSQL instance"
        echo "   Update POSTGRES_HOST in .env if needed"
    else
        echo "❌ PostgreSQL not available locally"
        echo "   Consider installing PostgreSQL or using Docker"
    fi
    
    if [ "$REDIS_AVAILABLE" = true ]; then
        echo "✅ Redis client available" 
        echo "   You can connect to an existing Redis instance"
        echo "   Update REDIS_HOST in .env if needed"
    else
        echo "❌ Redis not available locally"
        echo "   Consider installing Redis or using Docker"
    fi
    
    if [ "$MONGO_AVAILABLE" = true ]; then
        echo "✅ MongoDB client available"
        echo "   You can connect to an existing MongoDB instance"
        echo "   Update MONGODB_URI in .env if needed"
    else
        echo "❌ MongoDB not available locally"
        echo "   Consider installing MongoDB or using Docker"
    fi
fi

# Create mock data directory
echo ""
echo "📄 Setting up mock data..."

mkdir -p data/mock
cat > data/mock/test-users.json << 'EOF'
[
  {
    "id": 1,
    "email": "demo@example.com",
    "password": "password123",
    "first_name": "Demo",
    "last_name": "User",
    "ml_connected": true,
    "ml_user_id": "123456789"
  },
  {
    "id": 2,
    "email": "seller@example.com",
    "password": "password123",
    "first_name": "Test",
    "last_name": "Seller",
    "ml_connected": true,
    "ml_user_id": "987654321"
  }
]
EOF

cat > data/mock/test-products.json << 'EOF'
[
  {
    "ml_item_id": "MLA123456789",
    "title": "iPhone 14 Pro Max 256GB",
    "category_id": "MLA1055",
    "price": 899999.99,
    "currency_id": "ARS",
    "available_quantity": 5,
    "condition": "new"
  },
  {
    "ml_item_id": "MLA987654321",
    "title": "Samsung Galaxy S23 Ultra",
    "category_id": "MLA1055", 
    "price": 749999.99,
    "currency_id": "ARS",
    "available_quantity": 3,
    "condition": "new"
  }
]
EOF

echo "✅ Mock data files created in data/mock/"

# Create startup scripts
echo ""
echo "🚀 Creating startup scripts..."

cat > scripts/start-dev.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting ML Ecosystem development environment..."

# Start mock ML API
echo "📡 Starting Mock ML API server..."
cd scripts && node -e "
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const mockData = {
  '/sites/MLA': { id: 'MLA', name: 'Argentina' },
  '/users/me': { id: 123456789, nickname: 'DEMOSELLER' },
  '/oauth/token': { access_token: 'mock_token', token_type: 'Bearer' }
};

app.get('/health', (req, res) => res.json({status: 'ok'}));
Object.entries(mockData).forEach(([path, data]) => {
  app.get(path, (req, res) => res.json(data));
  app.post(path, (req, res) => res.json(data));
});

const PORT = process.env.MOCK_ML_API_PORT || 3333;
app.listen(PORT, () => console.log(\`Mock ML API running on port \${PORT}\`));
" &

MOCK_PID=$!
echo "✅ Mock ML API started (PID: $MOCK_PID)"

# Wait a moment for mock API to start
sleep 2

# Start services
echo "🏗️  Starting microservices..."

cd services/user-service && npm run dev &
USER_PID=$!
echo "✅ User Service started (PID: $USER_PID)"

cd ../integration-service && npm run dev &
INTEGRATION_PID=$!
echo "✅ Integration Service started (PID: $INTEGRATION_PID)"

echo ""
echo "🎉 ML Ecosystem is running!"
echo ""
echo "📋 Service URLs:"
echo "   - User Service: http://localhost:3001"
echo "   - Integration Service: http://localhost:3002"
echo "   - Mock ML API: http://localhost:3333"
echo ""
echo "📋 Health Checks:"
echo "   - curl http://localhost:3001/health"
echo "   - curl http://localhost:3002/health"
echo "   - curl http://localhost:3333/health"
echo ""
echo "⏹️  To stop services: npm run stop:dev"

# Save PIDs for cleanup
echo "$MOCK_PID $USER_PID $INTEGRATION_PID" > .dev-pids

wait
EOF

cat > scripts/stop-dev.sh << 'EOF'
#!/bin/bash

echo "⏹️  Stopping ML Ecosystem development environment..."

if [ -f ".dev-pids" ]; then
    PIDS=$(cat .dev-pids)
    for PID in $PIDS; do
        if kill -0 $PID 2>/dev/null; then
            echo "Stopping process $PID..."
            kill $PID
        fi
    done
    rm .dev-pids
    echo "✅ All services stopped"
else
    echo "No running services found"
fi
EOF

chmod +x scripts/start-dev.sh scripts/stop-dev.sh

# Update package.json scripts
echo ""
echo "📝 Updating package.json with new scripts..."

# Add new scripts to package.json if not already present
if ! grep -q "setup:local" package.json; then
    # Create a temporary file with updated scripts
    python3 -c "
import json
import sys

with open('package.json', 'r') as f:
    data = json.load(f)

data['scripts'].update({
    'setup:local': './scripts/setup-local-env.sh',
    'start:local': './scripts/start-dev.sh',
    'stop:local': './scripts/stop-dev.sh',
    'dev:mock': 'node scripts/Dockerfile.mock-ml && npm run start:local'
})

with open('package.json', 'w') as f:
    json.dump(data, f, indent=2)
"
    echo "✅ Package.json updated with local development scripts"
fi

echo ""
echo "🎉 Local development environment setup complete!"
echo ""
echo "📋 Available commands:"
echo "   npm run setup:local    # Run this setup again"
echo "   npm run start:local    # Start all services locally"
echo "   npm run stop:local     # Stop all services"
echo "   npm run test:lite      # Run lightweight tests"
echo "   npm run test:mock      # Run tests with mock services"
echo ""

if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "🐳 Docker commands:"
    echo "   docker compose -f docker-compose.dev.yml up -d    # Start containerized databases"
    echo "   docker compose -f docker-compose.dev.yml down     # Stop containers"
    echo ""
fi

echo "🚀 Next steps:"
echo "1. If using Docker: docker compose -f docker-compose.dev.yml up -d"
echo "2. Start services: npm run start:local"
echo "3. Test the setup: npm run test:lite"
echo ""
echo "✅ Ready for development!"