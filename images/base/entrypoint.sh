#!/bin/bash
set -e

# Start opencode serve in background (always running)
echo "Starting opencode serve..."
opencode serve --hostname 0.0.0.0 --port 4096 &
OPENCODE_PID=$!

# Wait for opencode to be healthy
echo "Waiting for opencode serve to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:4096/global/health > /dev/null 2>&1; then
    echo "opencode serve is ready"
    break
  fi
  sleep 1
done

# Start agent
echo "Starting agent..."
tsx /app/agent.ts

# If agent exits, also stop opencode
kill $OPENCODE_PID 2>/dev/null
