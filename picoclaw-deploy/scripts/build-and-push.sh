#!/usr/bin/env bash
set -euo pipefail

# PicoClaw Multi-Arch Build & Push Script
#
# Usage: ./build-and-push.sh [base|full|all] [version] [mode]
#
# Modes:
#   --push          Push multi-arch manifest list (requires registry support: GHCR, Docker Hub, ACR Enterprise)
#   --push-split    Push separate arch-specific tags (works with ACR Personal Edition)
#   --no-push       Build locally for current host architecture only
#
# Examples:
#   ./build-and-push.sh all v0.2.8 --push          # ACR Enterprise / GHCR / Docker Hub
#   ./build-and-push.sh all v0.2.8 --push-split     # ACR Personal Edition (default)
#   ./build-and-push.sh all v0.2.8 --no-push        # Local test build

FLAVOR="${1:-all}"
VERSION="${2:-dev}"
MODE="${3:---push-split}"

REGISTRY="crpi-3cv0rta9jago3ag6.cn-hangzhou.personal.cr.aliyuncs.com/changingstudy"
PLATFORMS="linux/amd64,linux/arm64"
PLATFORM_LIST="linux/amd64 linux/arm64"
BUILDER_NAME="picoclaw-builder"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../../Codes/projects/picoclaw" 2>/dev/null && pwd)" || PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BUILD_DIR="${SCRIPT_DIR}/../build"

# \─\ Prerequisites ──────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
    echo "ERROR: docker is required"
    exit 1
fi

if ! docker buildx version &>/dev/null; then
    echo "ERROR: docker buildx is required. Install Docker Buildx plugin."
    exit 1
fi

# \─\ Setup buildx builder ──────────────────────────────────────

setup_builder() {
    echo "--- Setting up buildx builder ---"

    # Install QEMU binfmt for cross-platform emulation
    docker run --privileged --rm tonistiigi/binfmt --install all 2>/dev/null || {
        echo "WARNING: QEMU install failed. Cross-arch builds may not work."
        echo "  Try manually: docker run --privileged --rm tonistiigi/binfmt --install all"
    }

    # Create or reuse named builder
    if docker buildx inspect "${BUILDER_NAME}" &>/dev/null; then
        echo "  Reusing existing builder: ${BUILDER_NAME}"
    else
        docker buildx create \
            --name "${BUILDER_NAME}" \
            --driver docker-container \
            --use \
            --bootstrap
        echo "  Created builder: ${BUILDER_NAME}"
    fi

    docker buildx use "${BUILDER_NAME}"
    echo "✓ Builder ready"
}

# \─\ Login check ────────────────────────────────────────────────

check_login() {
    echo "Checking registry login..."
    if ! docker login "${REGISTRY}" --get-login &>/dev/null; then
        echo "Not logged in. Run: docker login ${REGISTRY}"
        echo "Credentials: shenjiecode@163.com / <password>"
        exit 1
    fi
    echo "✓ Logged in"
}

# \─\ Arch tag suffix ───────────────────────────────────────────

arch_suffix() {
    local platform="$1"
    case "${platform}" in
        linux/amd64)   echo "amd64" ;;
        linux/arm64)   echo "arm64" ;;
        linux/riscv64) echo "riscv64" ;;
        *)             echo "unknown" ;;
    esac
}

# \─\ Build + Push: Manifest list (single tag, multi-arch) ──────

build_and_push_manifest() {
    local name="$1"
    local dockerfile="${BUILD_DIR}/Dockerfile.${name}-launcher"

    echo "--- Building & pushing picoclaw-${name} (manifest list, ${PLATFORMS}) ---"

    docker buildx build \
        --platform "${PLATFORMS}" \
        -f "${dockerfile}" \
        -t "${REGISTRY}/picoclaw-${name}:${VERSION}" \
        -t "${REGISTRY}/picoclaw-${name}:latest" \
        --push \
        "${PROJECT_DIR}"

    echo "✓ picoclaw-${name} pushed (${VERSION} + latest, manifest: ${PLATFORMS})"
}

# \─\ Build + Push: Split arch-specific tags ─────────────────────

build_and_push_split() {
    local name="$1"
    local dockerfile="${BUILD_DIR}/Dockerfile.${name}-launcher"

    echo "--- Building & pushing picoclaw-${name} (arch-specific tags) ---"

    # Collect tags for all platforms
    local tags=""
    for platform in ${PLATFORM_LIST}; do
        local suffix
        suffix="$(arch_suffix "${platform}")"
        tags="${tags} -t ${REGISTRY}/picoclaw-${name}:${VERSION}-${suffix}"
        tags="${tags} -t ${REGISTRY}/picoclaw-${name}:latest-${suffix}"
    done

    # shellcheck disable=SC2086
    docker buildx build \
        --platform "${PLATFORMS}" \
        -f "${dockerfile}" \
        ${tags} \
        --push \
        "${PROJECT_DIR}"

    echo "✓ picoclaw-${name} pushed (arch-specific tags):"
    for platform in ${PLATFORM_LIST}; do
        local suffix
        suffix="$(arch_suffix "${platform}")"
        echo "  ${REGISTRY}/picoclaw-${name}:${VERSION}-${suffix}"
        echo "  ${REGISTRY}/picoclaw-${name}:latest-${suffix}"
    done
}

# \─\ Build: Local single-arch ──────────────────────────────────

build_local() {
    local name="$1"
    local dockerfile="${BUILD_DIR}/Dockerfile.${name}-launcher"

    echo "--- Building picoclaw-${name} (local, host arch only) ---"

    docker buildx build \
        --load \
        -f "${dockerfile}" \
        -t "picoclaw-${name}:${VERSION}" \
        -t "picoclaw-${name}:latest" \
        "${PROJECT_DIR}"

    echo "✓ picoclaw-${name} built locally"
}

# \─\ Validate args ──────────────────────────────────────────────

if [[ "$FLAVOR" != "base" && "$FLAVOR" != "full" && "$FLAVOR" != "all" ]]; then
    echo "Usage: $0 [base|full|all] [version] [--push|--push-split|--no-push]"
    exit 1
fi

if [[ "$MODE" != "--push" && "$MODE" != "--push-split" && "$MODE" != "--no-push" ]]; then
    echo "Usage: $0 [base|full|all] [version] [--push|--push-split|--no-push]"
    exit 1
fi

# \─\ Main ───────────────────────────────────────────────────────

echo "=== PicoClaw Multi-Arch Build ==="
echo "Flavor:   ${FLAVOR}"
echo "Version:  ${VERSION}"
echo "Mode:     ${MODE}"
if [[ "$MODE" != "--no-push" ]]; then
    echo "Registry: ${REGISTRY}"
    echo "Platforms: ${PLATFORMS}"
fi
echo ""

if [[ "$MODE" == "--no-push" ]]; then
    # \─\ Local build ──
    case "$FLAVOR" in
        base)  build_local "base" ;;
        full)  build_local "full" ;;
        all)   build_local "base"; build_local "full" ;;
    esac

elif [[ "$MODE" == "--push" ]]; then
    # \─\ Manifest list push (ACR Enterprise / GHCR / Docker Hub) ──
    check_login
    echo ""
    setup_builder
    echo ""

    case "$FLAVOR" in
        base)  build_and_push_manifest "base" ;;
        full)  build_and_push_manifest "full" ;;
        all)   build_and_push_manifest "base"; build_and_push_manifest "full" ;;
    esac

elif [[ "$MODE" == "--push-split" ]]; then
    # \─\ Arch-specific tag push (ACR Personal Edition) ──
    check_login
    echo ""
    setup_builder
    echo ""

    case "$FLAVOR" in
        base)  build_and_push_split "base" ;;
        full)  build_and_push_split "full" ;;
        all)   build_and_push_split "base"; build_and_push_split "full" ;;
    esac
fi

echo ""
echo "=== Done ==="
