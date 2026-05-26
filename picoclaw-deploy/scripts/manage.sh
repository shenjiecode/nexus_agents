#!/usr/bin/env bash
set -euo pipefail

# PicoClaw Management Script
# Usage: ./manage.sh [command] [server]
# Commands: logs, restart, stop, start, status, update, shell, test
# Example: ./manage.sh logs myserver

CMD="${1:-status}"
SERVER="${2:-}"
REMOTE_DIR="\$HOME/picoclaw"

run() {
    if [[ -z "$SERVER" ]]; then
        # Find the compose file locally
        for dir in base full; do
            if [[ -f "$dir/docker-compose.yml" ]]; then
                cd "$dir"
                docker compose "$@"
                return
            fi
        done
        echo "ERROR: No docker-compose.yml found in base/ or full/"
        exit 1
    else
        ssh "$SERVER" "cd ${REMOTE_DIR} && docker compose $*"
    fi
}

case "$CMD" in
    logs)
        run "logs" "-f" "--tail" "100"
        ;;
    restart)
        run "restart"
        ;;
    stop)
        run "down"
        ;;
    start)
        run "up" "-d"
        ;;
    status)
        if [[ -z "$SERVER" ]]; then
            docker ps --filter name=picoclaw --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
        else
            ssh "$SERVER" "docker ps --filter name=picoclaw --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
        fi
        ;;
    update)
        if [[ -z "$SERVER" ]]; then
            echo "For local update, run: ./build-and-push.sh all <version> --no-push"
            exit 0
        fi
        echo "Pulling latest image on ${SERVER}..."
        ssh "$SERVER" "cd ${REMOTE_DIR} && docker compose pull && docker compose up -d"
        echo "✓ Updated"
        ;;
    shell)
        if [[ -z "$SERVER" ]]; then
            docker exec -it picoclaw sh
        else
            ssh "$SERVER" "docker exec -it picoclaw sh"
        fi
        ;;
    test)
        echo "Testing LLM connection..."
        if [[ -z "$SERVER" ]]; then
            docker exec picoclaw picoclaw agent -m 'Say hello in one word'
        else
            ssh "$SERVER" "docker exec picoclaw picoclaw agent -m 'Say hello in one word'"
        fi
        ;;
    *)
        echo "Usage: $0 [logs|restart|stop|start|status|update|shell|test] [server]"
        echo ""
        echo "Commands:"
        echo "  logs     - Follow container logs"
        echo "  restart  - Restart container"
        echo "  stop     - Stop and remove container"
        echo "  start    - Start container"
        echo "  status   - Show container status"
        echo "  update   - Pull latest image and restart (remote only)"
        echo "  shell    - Open shell inside container"
        echo "  test     - Test LLM connection"
        echo ""
        echo "Examples:"
        echo "  $0 status              # Local status"
        echo "  $0 logs myserver       # Remote logs"
        echo "  $0 update myserver     # Update remote"
        ;;
esac
