#!/bin/sh
# Docker entrypoint for frontend
# Substitutes environment variables into nginx config

set -e

# Default BACKEND_URL if not set
BACKEND_URL=${BACKEND_URL:-http://backend:13207}

# Substitute env vars in nginx config template
envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute the CMD
exec "$@"