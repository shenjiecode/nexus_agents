#!/bin/bash
# Matrix Server Startup Script (Synapse)
# Generates config files from templates using .env variables

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.example to .env and configure it:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Validate required variables
if [ -z "$MATRIX_SERVER_NAME" ]; then
    echo "ERROR: MATRIX_SERVER_NAME is not set in .env"
    exit 1
fi

if [ -z "$REGISTRATION_SHARED_SECRET" ] || [ "$REGISTRATION_SHARED_SECRET" = "CHANGE_ME_TO_RANDOM_STRING" ]; then
    echo "ERROR: REGISTRATION_SHARED_SECRET must be set to a secure random string"
    echo "Generate one with: openssl rand -hex 32"
    exit 1
fi

if [ -z "$ADMIN_PASSWORD" ] || [ "$ADMIN_PASSWORD" = "CHANGE_ME_TO_ADMIN_PASSWORD" ]; then
    echo "ERROR: ADMIN_PASSWORD must be set in .env"
    exit 1
fi

# Apply defaults
SYNAPSE_HTTP_PORT="${SYNAPSE_HTTP_PORT:-8008}"
ELEMENT_PORT="${ELEMENT_PORT:-8080}"
KETESA_PORT="${KETESA_PORT:-8081}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
POSTGRES_USER="${POSTGRES_USER:-synapse}"
POSTGRES_DB="${POSTGRES_DB:-synapse}"

echo "=========================================="
echo "Matrix Server Configuration (Synapse)"
echo "=========================================="
echo "Server Name:     $MATRIX_SERVER_NAME"
echo "Synapse Port:    $SYNAPSE_HTTP_PORT"
echo "Element Web:     $ELEMENT_PORT"
echo "Ketesa Admin:    $KETESA_PORT"
echo "=========================================="

# Generate homeserver.yaml from template
echo "Generating homeserver.yaml..."
envsubst '${MATRIX_SERVER_NAME} ${POSTGRES_USER} ${POSTGRES_PASSWORD} ${POSTGRES_DB} ${REGISTRATION_SHARED_SECRET}' \
  < config/homeserver.yaml.template > config/homeserver.yaml

# Generate element-config.json from template
echo "Generating element-config.json..."
envsubst '${MATRIX_SERVER_NAME} ${SYNAPSE_HTTP_PORT}' \
  < config/element-config.json.template > config/element-config.json

# Generate ketesa-config.json from template
echo "Generating ketesa-config.json..."
envsubst '${MATRIX_SERVER_NAME} ${SYNAPSE_HTTP_PORT}' \
  < config/ketesa-config.json.template > config/ketesa-config.json

# Generate signing key if not exists
# Synapse `generate` creates homeserver.yaml + log.config + signing key
# We run it only to get the signing key, then overwrite homeserver.yaml with our template
if [ ! -f config/matrix_key.pem ] || [ ! -f config/log.config ]; then
    echo "Generating Synapse signing key and log config..."
    docker run --rm \
      -v "$(pwd)/config:/data" \
      -e "SYNAPSE_SERVER_NAME=$MATRIX_SERVER_NAME" \
      -e "SYNAPSE_REPORT_STATS=no" \
      matrixdotorg/synapse:latest generate

    # Overwrite generated homeserver.yaml with our template
    envsubst '${MATRIX_SERVER_NAME} ${POSTGRES_USER} ${POSTGRES_PASSWORD} ${POSTGRES_DB} ${REGISTRATION_SHARED_SECRET}' \
      < config/homeserver.yaml.template > config/homeserver.yaml

    echo "Signing key generated."
else
    echo "Signing key already exists, skipping generation."
fi

# Ensure data directories exist
mkdir -p data/postgres
mkdir -p data/media_store

echo "Configuration complete!"
echo ""

# Start docker compose
echo "Starting Matrix server..."
docker compose up -d

# Wait for Synapse to become healthy
echo "Waiting for Synapse to start (may take up to 60s)..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:${SYNAPSE_HTTP_PORT}/health > /dev/null 2>&1; then
        echo "Synapse is healthy!"
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    echo "  Waiting... ($WAITED/${MAX_WAIT}s)"
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "WARNING: Synapse health check timed out. Check logs:"
    echo "  docker compose logs synapse"
fi

# Create admin user (idempotent - suppress error if exists)
echo "Creating admin user '$ADMIN_USERNAME'..."
docker exec matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u "$ADMIN_USERNAME" \
  -p "$ADMIN_PASSWORD" \
  -a \
  "http://localhost:8008" 2>/dev/null && \
  echo "Admin user '$ADMIN_USERNAME' created." || \
  echo "Admin user '$ADMIN_USERNAME' already exists (skipped)."

echo ""
echo "=========================================="
echo "Matrix server is running!"
echo "=========================================="
echo ""
echo "Access addresses:"
echo "  - Synapse API:   http://${MATRIX_SERVER_NAME}:${SYNAPSE_HTTP_PORT}"
echo "  - Element Web:   http://${MATRIX_SERVER_NAME}:${ELEMENT_PORT}"
echo "  - Ketesa Admin:  http://${MATRIX_SERVER_NAME}:${KETESA_PORT}"
echo ""
echo "Admin user: $ADMIN_USERNAME"
echo "Registration secret (for Backend config):"
echo "  $REGISTRATION_SHARED_SECRET"
echo "=========================================="
