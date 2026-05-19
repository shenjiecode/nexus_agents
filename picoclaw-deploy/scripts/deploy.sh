#!/usr/bin/env bash
set -euo pipefail

# PicoClaw One-Click Deploy Script
# Usage: ./deploy.sh [base|full] [server]
# Example: ./deploy.sh full myserver

FLAVOR="${1:-full}"
SERVER="${2:-}"

DEPLOY_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="crpi-3cv0rta9jago3ag6.cn-hangzhou.personal.cr.aliyuncs.com/changingstudy"

if [[ "$FLAVOR" != "base" && "$FLAVOR" != "full" ]]; then
    echo "Usage: $0 [base|full] [server]"
    echo "  base  - Lightweight (picoclaw + WebUI + curl)"
    echo "  full  - Full (picoclaw + WebUI + curl + git + node + python + uv)"
    exit 1
fi

# \─\ Detect architecture and select the right image tag ──
# Tries manifest list first (if registry supports it), falls back to arch-specific tag.

detect_arch() {
    local cmd="$1"
    local arch
    if [[ "$cmd" == "local" ]]; then
        arch=$(uname -m 2>/dev/null || echo "unknown")
    else
        arch=$(${cmd} uname -m 2>/dev/null || echo "unknown")
    fi
    case "${arch}" in
        x86_64)  echo "amd64" ;;
        aarch64) echo "arm64" ;;
        armv7l)  echo "arm64" ;;
        riscv64) echo "riscv64" ;;
        *)       echo "amd64" ;;  # fallback
    esac
}

resolve_image() {
    local arch="$1"
    local base="${REGISTRY}/picoclaw-${FLAVOR}:latest"
    # Use arch-specific tag for ACR Personal Edition compatibility
    echo "${base}-${arch}"
}

echo "=== PicoClaw Deploy (${FLAVOR}) ==="
echo "Image: ${IMAGE}"

# --- Local deploy (podman/docker) ---
deploy_local() {
    local arch
    arch=$(detect_arch "local")
    IMAGE=$(resolve_image "${arch}")
    echo "Arch:  ${arch}"

    echo ""
    echo "[1/6] Creating data directory..."
    mkdir -p "${DEPLOY_ROOT}/${FLAVOR}/data"

    echo "[2/6] Pulling image..."
    if command -v podman &>/dev/null; then
        podman pull "${IMAGE}"
    else
        docker pull "${IMAGE}"
    fi

    echo "[3/6] Checking for existing workspace..."
    if [[ ! -d "${DEPLOY_ROOT}/${FLAVOR}/data/workspace" ]]; then
        echo "  No workspace found. Running onboard to generate defaults..."
        if command -v podman &>/dev/null; then
            podman run --rm -v "${DEPLOY_ROOT}/${FLAVOR}/data:/root/.picoclaw" \
                --entrypoint "" "${IMAGE}" sh -c "echo 'n' | picoclaw onboard"
        else
            docker run --rm -v "${DEPLOY_ROOT}/${FLAVOR}/data:/root/.picoclaw" \
                --entrypoint "" "${IMAGE}" sh -c "echo 'n' | picoclaw onboard"
        fi
        echo "  ✓ Workspace generated"
    else
        echo "  ✓ Workspace already exists"
    fi

    echo "[4/6] Copying config files (non-destructive)..."
    for f in config.json .security.yml; do
        if [[ -f "${DEPLOY_ROOT}/${FLAVOR}/${f}" ]] && [[ ! -f "${DEPLOY_ROOT}/${FLAVOR}/data/${f}" ]]; then
            cp "${DEPLOY_ROOT}/${FLAVOR}/${f}" "${DEPLOY_ROOT}/${FLAVOR}/data/${f}"
            echo "  ✓ ${f}"
        elif [[ -f "${DEPLOY_ROOT}/${FLAVOR}/data/${f}" ]]; then
            echo "  ✓ ${f} (already exists, skipped)"
        fi
    done

    echo "[5/6] Patching docker-compose.yml with arch-specific image..."
    sed -i.bak "s|picoclaw-${FLAVOR}:latest|picoclaw-${FLAVOR}:latest-${arch}|g" \
        "${DEPLOY_ROOT}/${FLAVOR}/docker-compose.yml" 2>/dev/null || true
    rm -f "${DEPLOY_ROOT}/${FLAVOR}/docker-compose.yml.bak"

    echo "[6/6] Starting container..."
    cd "${DEPLOY_ROOT}/${FLAVOR}"
    if command -v podman &>/dev/null; then
        podman compose up -d
    else
        docker compose up -d
    fi

    echo ""
    echo "=== Deploy Complete ==="
    echo "Arch:     ${arch}"
    echo "Image:    ${IMAGE}"
    echo "WebUI:    http://localhost:18800"
    echo "Gateway:  http://localhost:18790"
}

# --- Remote deploy (ssh) ---
deploy_remote() {
    local srv="$1"
    local remote_home
    remote_home=$(ssh "$srv" "echo \$HOME")
    local remote_dir="${remote_home}/picoclaw"

    # Detect remote arch
    local arch
    arch=$(detect_arch "ssh $srv")
    IMAGE=$(resolve_image "${arch}")
    echo "Server:  ${srv}"
    echo "Arch:    ${arch}"
    echo "Image:   ${IMAGE}"

    echo ""
    echo "[1/8] Creating directories on ${srv}..."
    ssh "$srv" "mkdir -p ${remote_dir}/data"

    echo "[2/8] Pulling image on ${srv}..."
    ssh "$srv" "docker pull ${IMAGE}"

    echo "[3/8] Checking for existing workspace..."
    if ! ssh "$srv" "test -d ${remote_dir}/data/workspace/skills"; then
        echo "  No workspace found. Running onboard to generate defaults..."
        ssh "$srv" "docker run --rm -v ${remote_dir}/data:/root/.picoclaw \
            --entrypoint '' ${IMAGE} sh -c 'echo n | picoclaw onboard'"
        echo "  ✓ Workspace generated"
    else
        echo "  ✓ Workspace already exists"
    fi

    echo "[4/8] Uploading docker-compose.yml..."
    # Patch the image tag with arch suffix before uploading
    local compose_tmp
    compose_tmp=$(mktemp)
    sed "s|picoclaw-${FLAVOR}:latest|picoclaw-${FLAVOR}:latest-${arch}|g" \
        "${DEPLOY_ROOT}/${FLAVOR}/docker-compose.yml" > "${compose_tmp}"
    scp "${compose_tmp}" "${srv}:${remote_dir}/docker-compose.yml"
    rm -f "${compose_tmp}"

    echo "[5/8] Uploading config files..."
    for f in config.json .security.yml; do
        if [[ -f "${DEPLOY_ROOT}/${FLAVOR}/${f}" ]]; then
            # Use sudo tee because onboard-created files are owned by root
            ssh "$srv" "sudo tee ${remote_dir}/data/${f}" > /dev/null < "${DEPLOY_ROOT}/${FLAVOR}/${f}"
            echo "  ✓ ${f}"
        fi
    done

    echo "[6/8] Restarting container..."
    ssh "$srv" "cd ${remote_dir} && docker compose down" 2>/dev/null || true
    ssh "$srv" "cd ${remote_dir} && docker compose up -d"

    echo "[7/8] Health check..."
    sleep 3
    ssh "$srv" "docker ps --filter name=picoclaw --format '{{.Status}}'"

    echo "[8/8] Reporting..."
    local ip
    ip=$(ssh "$srv" "hostname -I | awk '{print \$1}'" 2>/dev/null || echo "<server-ip>")
    echo ""
    echo "=== Deploy Complete ==="
    echo "Server:   ${srv} (${arch})"
    echo "Image:    ${IMAGE}"
    echo "WebUI:    http://${ip}:18800"
    echo "Gateway:  http://${ip}:18790"
    echo ""
    echo "Logs:  ssh ${srv} 'cd ${remote_dir} && docker compose logs -f'"
    echo "Shell: ssh ${srv} 'docker exec -it picoclaw sh'"
}

if [[ -z "$SERVER" ]]; then
    deploy_local
else
    deploy_remote "$SERVER"
fi
