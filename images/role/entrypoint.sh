#!/bin/bash
set -e

echo "Starting OpenCode serve on 0.0.0.0:4096..."

exec opencode serve --hostname 0.0.0.0 --port 4096 "$@"
