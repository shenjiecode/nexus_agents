#!/bin/bash
# Matrix Server Startup Script
# This script generates config files from templates using .env variables

set -e

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

echo "=========================================="
echo "Matrix Server Configuration"
echo "=========================================="
echo "Server Name: $MATRIX_SERVER_NAME"
echo "Dendrite HTTP Port: ${DENDRITE_HTTP_PORT:-8008}"
echo "Element Web Port: ${ELEMENT_PORT:-8080}"
echo "Federation: $([ "${DISABLE_FEDERATION}" = "true" ] && echo "Disabled" || echo "Enabled")"
echo "=========================================="

# Generate dendrite.yaml from template
echo "Generating dendrite.yaml..."
envsubst < config/dendrite.yaml.template > config/dendrite.yaml

# Generate element-config.json from template
echo "Generating element-config.json..."
envsubst < config/element-config.json.template > config/element-config.json

# Ensure matrix_key.pem exists
if [ ! -f config/matrix_key.pem ]; then
    echo "Generating new matrix signing key..."
    docker run --rm -v "$(pwd)/config:/data" matrixdotorg/dendrite:latest --generate-keys --config /data/dendrite.yaml
fi

echo "Configuration complete!"
echo ""

# Start docker-compose
echo "Starting Matrix server..."
docker-compose up -d

# Wait for services
echo "Waiting for services to start..."
sleep 5

# Check health
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "=========================================="
    echo "Matrix server is running!"
    echo "=========================================="
    echo ""
    echo "Access addresses:"
    echo "  - Dendrite API: http://${MATRIX_SERVER_NAME}:${DENDRITE_HTTP_PORT:-8008}"
    echo "  - Element Web:  http://${MATRIX_SERVER_NAME}:${ELEMENT_PORT:-8080}"
    echo ""
    echo "Registration secret (save this for Backend config):"
    echo "  $REGISTRATION_SHARED_SECRET"
    echo "=========================================="
else
    echo "ERROR: Services failed to start. Check logs:"
    echo "  docker-compose logs"
    exit 1
fi
