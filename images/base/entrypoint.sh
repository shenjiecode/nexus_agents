#!/bin/bash
set -e

# Default values
PORT=${OPENCODE_SERVER_PORT:-4096}
HOSTNAME=${OPENCODE_SERVER_HOSTNAME:-0.0.0.0}

# Start OpenCode Serve
# Note: Password authentication is handled internally by OpenCode Serve
# The OPENCODE_SERVER_PASSWORD env var is used for Basic Auth
echo "Starting OpenCode Serve on ${HOSTNAME}:${PORT}"
exec opencode serve --hostname "$HOSTNAME" --port "$PORT"
