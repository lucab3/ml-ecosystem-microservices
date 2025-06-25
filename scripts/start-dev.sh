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

cd ../../services/integration-service && npm run dev &
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
