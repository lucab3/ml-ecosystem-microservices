#!/bin/bash

# 🎯 ML Ecosystem - Interview Demo Script
# Automated demo for interview presentation

echo "🚀 ML Ecosystem Microservices - Interview Demo"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Environment Check
print_step "1. Checking environment..."

if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"

if ! command -v curl &> /dev/null; then
    print_error "curl not found. Please install curl"
    exit 1
fi

print_success "Environment check complete"
echo ""

# Step 2: Start Services
print_step "2. Starting ML Ecosystem services..."

# Kill any existing processes
print_info "Cleaning up existing processes..."
lsof -ti:3000,3001,3002,3333 | xargs kill -9 2>/dev/null || true

# Start the demo
print_info "Starting all microservices..."
node start-demo.js &
DEMO_PID=$!

# Wait for services to start
print_info "Waiting for services to initialize..."
sleep 5

# Step 3: Health Check
print_step "3. Verifying services health..."

services=(
    "3333:Mock ML API"
    "3001:User Service" 
    "3002:Integration Service"
    "3000:Frontend Server"
)

all_healthy=true

for service in "${services[@]}"; do
    port="${service%%:*}"
    name="${service##*:}"
    
    if curl -s http://localhost:$port/health > /dev/null; then
        print_success "$name (port $port) - HEALTHY"
    else
        print_error "$name (port $port) - FAILED"
        all_healthy=false
    fi
done

if [ "$all_healthy" = false ]; then
    print_error "Some services failed to start. Exiting..."
    kill $DEMO_PID 2>/dev/null
    exit 1
fi

echo ""
print_success "All services are running successfully!"
echo ""

# Step 4: Demo URLs and Commands
print_step "4. Demo Information"
echo ""
echo "🌐 FRONTEND URL:"
echo "   👉 http://localhost:3000"
echo ""
echo "📡 API ENDPOINTS:"
echo "   • Mock ML API:     http://localhost:3333/health"
echo "   • User Service:    http://localhost:3001/health"  
echo "   • Integration:     http://localhost:3002/health"
echo "   • Frontend:        http://localhost:3000/health"
echo ""

# Step 5: Sample API Calls for Demo
print_step "5. Sample API calls for demo..."
echo ""

print_info "Testing User Service - List users:"
echo "Command: curl -s http://localhost:3001/api/users | jq"
curl -s http://localhost:3001/api/users | head -3
echo ""

print_info "Testing Integration Service - ML Sites:"
echo "Command: curl -s http://localhost:3002/api/ml/sites/MLA | jq"
curl -s http://localhost:3002/api/ml/sites/MLA | head -3
echo ""

print_info "Creating a new user for demo:"
echo "Command: curl -X POST http://localhost:3001/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"interview@demo.com\",\"password\":\"demo123\"}'"
result=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"interview@demo.com","password":"demo123"}')
echo $result | head -3
echo ""

# Step 6: Architecture Overview
print_step "6. Architecture Overview"
echo ""
echo "📋 MICROSERVICES ARCHITECTURE:"
echo "   ┌─────────────────┐    ┌─────────────────┐"
echo "   │   Frontend      │────│  API Gateway    │"
echo "   │  (Port 3000)    │    │   (Nginx)       │"
echo "   └─────────────────┘    └─────────────────┘"
echo "            │                       │"
echo "   ┌─────────────────┐    ┌─────────────────┐"
echo "   │  User Service   │    │ Integration     │"
echo "   │  (Port 3001)    │    │ Service (3002)  │"
echo "   └─────────────────┘    └─────────────────┘"
echo "            │                       │"
echo "   ┌─────────────────┐    ┌─────────────────┐"
echo "   │   PostgreSQL    │    │ Mock ML API     │"
echo "   │     Redis       │    │  (Port 3333)    │"
echo "   └─────────────────┘    └─────────────────┘"
echo ""

# Step 7: Key Features to Demonstrate
print_step "7. Key features to demonstrate in frontend:"
echo ""
echo "✅ MICROSERVICES STATUS:"
echo "   • Green indicators show all services healthy"
echo "   • Real-time health monitoring"
echo ""
echo "✅ PRODUCT MANAGEMENT:"
echo "   • Browse products from MercadoLibre"
echo "   • Search and filter functionality"
echo "   • Product details modal"
echo ""
echo "✅ USER MANAGEMENT:"
echo "   • User registration and authentication"
echo "   • Profile management"
echo "   • Session handling"
echo ""
echo "✅ INTEGRATION:"
echo "   • Real MercadoLibre API structure (mocked)"
echo "   • Rate limiting and caching"
echo "   • Error handling and resilience"
echo ""

# Step 8: Technical Talking Points
print_step "8. Technical talking points:"
echo ""
echo "🏗️  ARCHITECTURE DECISIONS:"
echo "   • Microservices for scalability and maintainability"
echo "   • RESTful APIs with proper HTTP status codes"
echo "   • JWT authentication for stateless services"
echo "   • Circuit breaker pattern for resilience"
echo ""
echo "🔧 INFRASTRUCTURE:"
echo "   • Docker containers for consistency"
echo "   • Redis for caching and rate limiting"
echo "   • PostgreSQL for relational data"
echo "   • Nginx as API gateway and load balancer"
echo ""
echo "📊 MONITORING & OBSERVABILITY:"
echo "   • Health checks for all services"
echo "   • Structured logging with correlation IDs"
echo "   • Prometheus metrics collection"
echo "   • Grafana dashboards for visualization"
echo ""

# Step 9: Demo Cleanup Instructions
echo ""
print_step "9. Demo control:"
echo ""
echo "🎬 TO SHOW FRONTEND:"
echo "   Open browser: http://localhost:3000"
echo ""
echo "🧪 TO TEST APIs:"
echo "   curl http://localhost:3001/api/users"
echo "   curl http://localhost:3002/api/ml/sites/MLA"
echo ""
echo "⏹️  TO STOP DEMO:"
echo "   Press Ctrl+C or run: kill $DEMO_PID"
echo ""

# Wait for user input
print_info "Demo is ready! Press Enter to continue with live demonstration..."
read -r

print_success "🎉 ML Ecosystem Demo is now running!"
print_success "Open http://localhost:3000 in your browser to start the demo"
echo ""
print_info "Service PID: $DEMO_PID"
print_info "To stop all services: kill $DEMO_PID"

# Keep script running until user stops it
echo ""
print_info "Press Ctrl+C to stop all services and exit demo..."

# Trap Ctrl+C to cleanup
trap 'echo ""; print_info "Stopping demo..."; kill $DEMO_PID 2>/dev/null; print_success "Demo stopped. Good luck with your interview! 🚀"; exit 0' INT

# Wait indefinitely
while true; do
    sleep 1
done