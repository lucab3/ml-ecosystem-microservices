#!/bin/bash

echo "🚀 Starting ML Ecosystem (Simple Mode)..."

# Set environment
export NODE_ENV=development
export USE_MOCK_DB=true
export USE_MOCK_REDIS=true  
export USE_MOCK_KAFKA=true

# Kill any existing processes on the ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true  
lsof -ti:3333 | xargs kill -9 2>/dev/null || true

# Wait a moment
sleep 2

echo "📡 Starting Mock ML API Server..."

# Start Mock ML API server inline
node -e "
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Mock ML API endpoints
app.get('/health', (req, res) => res.json({status: 'ok', service: 'mock-ml-api'}));
app.get('/sites/MLA', (req, res) => res.json({ id: 'MLA', name: 'Argentina' }));
app.get('/users/me', (req, res) => res.json({ id: 123456789, nickname: 'DEMOSELLER' }));
app.post('/oauth/token', (req, res) => res.json({ access_token: 'mock_token', token_type: 'Bearer' }));
app.get('/users/:id/items/search', (req, res) => res.json({ results: [] }));
app.get('/items/:id', (req, res) => res.json({ id: req.params.id, title: 'Mock Item' }));

const PORT = 3333;
app.listen(PORT, () => console.log('✅ Mock ML API running on port ' + PORT));
" &

MOCK_PID=$!
echo "✅ Mock ML API started (PID: $MOCK_PID)"

sleep 3

echo "🏗️  Starting User Service..."
cd services/user-service && npm run dev &
USER_PID=$!
echo "✅ User Service started (PID: $USER_PID)"

sleep 3

echo "🏗️  Starting Integration Service..."  
cd ../integration-service && npm run dev &
INTEGRATION_PID=$!
echo "✅ Integration Service started (PID: $INTEGRATION_PID)"

# Save PIDs
echo "$MOCK_PID $USER_PID $INTEGRATION_PID" > .dev-pids

echo ""
echo "🎉 ML Ecosystem is running!"
echo ""
echo "📋 Service URLs:"
echo "   - User Service: http://localhost:3001"
echo "   - Integration Service: http://localhost:3002"  
echo "   - Mock ML API: http://localhost:3333"
echo ""
echo "📋 Health Checks:"
echo "   curl http://localhost:3001/health"
echo "   curl http://localhost:3002/health"
echo "   curl http://localhost:3333/health"
echo ""
echo "📋 Test APIs:"
echo "   curl http://localhost:3001/api/auth/register -d '{\"email\":\"test@test.com\",\"password\":\"test123\"}' -H 'Content-Type: application/json'"
echo ""
echo "⏹️  To stop: npm run stop:local"

wait