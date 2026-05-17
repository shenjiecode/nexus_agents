#!/bin/bash
# Matrix Server Stop Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Stopping Matrix server..."
docker-compose down

echo "Matrix server stopped."
