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
