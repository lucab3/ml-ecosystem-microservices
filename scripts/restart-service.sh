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
