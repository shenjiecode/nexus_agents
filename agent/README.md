# Agent Daemon

Container entry process for Nexus Agents - "容器即人" architecture.

## Architecture

- **agent-daemon**: PID 1, main entry
- **matrix-client**: Matrix sync loop, message listener
- **process-manager**: opencode serve lifecycle
- **proxy-loader**: dynamic proxy module

## Message Flow

1. Matrix receives message
2. Proxy.preprocess() 
3. If needed: ProcessManager.ensureReady()
4. Proxy.handle() → OpenCode
5. Proxy.postprocess()
6. Matrix reply
7. Idle timeout → stop opencode

## Environment Variables

- MATRIX_HOMESERVER_URL
- MATRIX_ACCESS_TOKEN
- OPENCODE_PASSWORD
- IDLE_TIMEOUT_MS (default: 600000)
- PROXY_MODULE_PATH (default: /app/proxy/index.js)
- WORKSPACE_PATH (default: /workspace)
- AGENTS_FILE (default: /workspace/AGENTS.md)

## Files

- src/agent-daemon.ts - Main entry
- src/matrix-client.ts - Matrix client
- src/process-manager.ts - Process management
- src/serve-client.ts - OpenCode API
- src/proxy-loader.ts - Proxy loader
- src/types.ts - Type definitions
- src/config.ts - Configuration
- src/logger.ts - Logging
