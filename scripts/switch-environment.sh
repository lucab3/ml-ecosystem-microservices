#!/bin/bash

# ML Ecosystem - Environment Switcher
# Easy switch between development (mock data) and production (real credentials)

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

show_usage() {
    echo "Usage: $0 [development|production|status]"
    echo ""
    echo "Commands:"
    echo "  development  - Switch to development mode (mock data, test credentials)"
    echo "  production   - Switch to production mode (real ML credentials, no test data)"
    echo "  status       - Show current environment configuration"
    echo ""
    echo "Examples:"
    echo "  $0 development"
    echo "  $0 production"
    echo "  $0 status"
}

check_environment() {
    print_info "Checking current environment configuration..."
    
    if [ -f ".env" ]; then
        if grep -q "USE_MOCK_DB=true" .env; then
            echo "Current mode: DEVELOPMENT (mock data)"
        elif grep -q "NODE_ENV=production" .env; then
            echo "Current mode: PRODUCTION (real credentials)"
        else
            echo "Current mode: UNKNOWN (custom configuration)"
        fi
        
        echo ""
        echo "Database configuration:"
        grep -E "POSTGRES_HOST|REDIS_HOST|MONGODB_HOST" .env | head -3
        
        echo ""
        echo "ML API configuration:"
        grep -E "ML_CLIENT_ID|ML_API_BASE_URL" .env | head -2
        
        echo ""
        echo "Authorized ML users:"
        grep "AUTHORIZED_ML_USERS" .env
    else
        print_warning "No .env file found"
    fi
}

switch_to_development() {
    print_info "Switching to DEVELOPMENT mode..."
    
    # Backup current .env if exists
    if [ -f ".env" ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        print_info "Current .env backed up"
    fi
    
    # Copy development configuration
    cp .env.local .env
    print_success "Development configuration activated"
    
    # Update docker-compose to use test data
    print_info "Docker setup: Using docker-compose.dev.yml with test data"
    
    echo ""
    print_success "✅ DEVELOPMENT MODE ACTIVATED"
    echo ""
    echo "Configuration:"
    echo "  📊 Database: PostgreSQL with test data"
    echo "  🧪 ML API: Mock server (localhost:3333)"
    echo "  👥 Users: demo@example.com, seller@example.com, buyer@example.com"
    echo "  🔑 Password: password123 (for all test users)"
    echo "  📦 Products: 5 test products with dynamic stock"
    echo "  🚨 Alerts: Low stock simulation enabled"
    echo ""
    echo "Start with: docker-compose -f docker-compose.dev.yml up -d"
    echo "Then run: node start-demo.js"
}

switch_to_production() {
    print_info "Switching to PRODUCTION mode..."
    
    # Check if production env exists
    if [ ! -f ".env.production" ]; then
        print_error ".env.production file not found!"
        print_error "Please create .env.production with your real MercadoLibre credentials"
        exit 1
    fi
    
    # Backup current .env if exists
    if [ -f ".env" ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        print_info "Current .env backed up"
    fi
    
    # Copy production configuration
    cp .env.production .env
    print_success "Production configuration activated"
    
    # Update docker-compose to use production setup
    print_info "Docker setup: Using docker-compose.prod.yml (schema only, no test data)"
    
    echo ""
    print_warning "⚠️  PRODUCTION MODE ACTIVATED"
    echo ""
    print_warning "IMPORTANT: Make sure you have set these environment variables:"
    echo "  🔑 POSTGRES_PASSWORD"
    echo "  🔑 REDIS_PASSWORD"
    echo "  🔑 MONGODB_PASSWORD"
    echo "  🔑 ML_CLIENT_ID (your real MercadoLibre app ID)"
    echo "  🔑 ML_CLIENT_SECRET (your real MercadoLibre app secret)"
    echo "  🔑 AUTHORIZED_ML_USERS (comma-separated real ML user IDs)"
    echo "  🔑 JWT_SECRET"
    echo "  🔑 SERVICE_TOKEN"
    echo "  🔑 ADMIN_TOKEN"
    echo ""
    echo "Configuration:"
    echo "  📊 Database: PostgreSQL with production schema (no test data)"
    echo "  🌐 ML API: Real MercadoLibre API (api.mercadolibre.com)"
    echo "  👥 Users: Only authorized ML users can access"
    echo "  📦 Products: Real user products from MercadoLibre"
    echo "  🚨 Alerts: Real stock monitoring"
    echo ""
    echo "Start with: docker-compose -f docker-compose.prod.yml up -d"
    echo "Then deploy your services to production"
}

# Main script logic
case "$1" in
    development|dev)
        switch_to_development
        ;;
    production|prod)
        switch_to_production
        ;;
    status)
        check_environment
        ;;
    *)
        show_usage
        exit 1
        ;;
esac