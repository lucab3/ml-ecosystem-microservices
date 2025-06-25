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
