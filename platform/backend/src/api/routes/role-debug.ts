import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import logger from '../../lib/logger.js';
import { handleError, apiSuccess, apiError } from '../../lib/format-error.js';
import { roles } from '../../db/schema.js';
import { client } from '../../db/index.js';
import { getUser } from '../middleware/auth.js';
import { allocate } from '../../services/picoclaw-pool.js';


// Initialize DB
const db = drizzle(client);

// Debug state for single-user-single-debug lock
const debugSessions = new Map<string, { roleId: string; userId: string; workspaceId: string }>();

// Data paths
const DATA_BASE_PATH = join(process.cwd(), 'data', 'picoclaw');
const ROLE_DATA_BASE = join(process.cwd(), 'data', 'picoclaw');

/**
 * Get role directory path
 */
function getRoleDir(userId: string, roleId: string): string {
  return join(ROLE_DATA_BASE, userId, roleId);
}

/**
 * Get workspace data path for debug container
 */
function getWorkspacePath(userId: string, workspaceId: string): string {
  return join(DATA_BASE_PATH, userId, workspaceId);
}

/**
 * Ensure workspace directory exists
 */
function ensureWorkspaceDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Copy role files to container workspace .picoclaw directory
 */
async function mountRoleFiles(userId: string, roleId: string, workspacePath: string): Promise<void> {
  const roleDir = getRoleDir(userId, roleId);
  const picoclawDir = join(workspacePath, '.picoclaw');

  // Create .picoclaw directory
  ensureWorkspaceDir(picoclawDir);

  // Copy all files from role directory to .picoclaw
  if (existsSync(roleDir)) {
    copyRecursive(roleDir, picoclawDir);
  }

  // Also ensure workspace subdirectory exists
  const workspaceDir = join(picoclawDir, 'workspace');
  ensureWorkspaceDir(workspaceDir);
}

/**
 * Recursive copy directory
 */
function copyRecursive(src: string, dest: string): void {
  if (!existsSync(src)) {
    return;
  }

  const stat = statSync(src);
  if (stat.isDirectory()) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    const entries = readdirSync(src);
    for (const entry of entries) {
      const srcPath = join(src, entry);
      const destPath = join(dest, entry);
      copyRecursive(srcPath, destPath);
    }
  } else {
    copyFileSync(src, dest);
  }
}



// Create role-debug router
const roleDebug = new Hono();

/**
 * Validate role ownership
 */
async function validateRoleOwnership(roleId: string, userId: string): Promise<{
  valid: boolean;
  role?: any;
  error?: string;
}> {
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId));

  if (!role) {
    return { valid: false, error: 'Role not found' };
  }

  if (role.userId !== userId) {
    return { valid: false, error: 'Only the role owner can debug' };
  }

  return { valid: true, role };
}

/**
 * Check if user has active debug session
 */
function getActiveDebug(userId: string): string | null {
  for (const [wsId, session] of debugSessions.entries()) {
    if (session.userId === userId) {
      return wsId;
    }
  }
  return null;
}

/**
 * Clear debug session
 */
function clearDebugSession(workspaceId: string): void {
  const session = debugSessions.get(workspaceId);
  if (session) {
    debugSessions.delete(workspaceId);
    logger.info({ workspaceId, roleId: session.roleId }, 'Debug session cleared');
  }
}

// POST /api/roles/:id/debug/start - Start debug session
roleDebug.post('/api/roles/:id/debug/start', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const roleId = c.req.param('id');
    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    // Validate ownership
    const validation = await validateRoleOwnership(roleId, user.id);
    if (!validation.valid) {
      return c.json(apiError(validation.error || 'Access denied', 403), 403);
    }

    // Check for existing debug session (single-user-single-debug lock)
    const existingDebug = getActiveDebug(user.id);
    if (existingDebug) {
      return c.json(apiError('You already have an active debug session', 409), 409);
    }

    const now = Date.now();
    const workspaceId = `role_debug_${randomBytes(8).toString('hex')}`;

    logger.info({ roleId, userId: user.id, workspaceId }, 'Starting debug session');

    // Allocate container
    const variant = (validation.role?.variant || 'full') as any;
    const instance = await allocate(user.id, variant);

    // Update instance with our workspace ID (we'll reuse the picoclaw pool)
    const workspacePath = getWorkspacePath(user.id, instance.workspaceId);

    // Update container name to be more descriptive
    instance.workspaceId = workspaceId;

    // Mount role files to .picoclaw directory
    await mountRoleFiles(user.id, roleId, workspacePath);

    // Wait for container to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Store debug session
    debugSessions.set(workspaceId, {
      roleId,
      userId: user.id,
      workspaceId: instance.workspaceId,
    });

    // Update role with container info
    await db
      .update(roles)
      .set({
        containerId: instance.containerId,
        containerPort: instance.port,
        status: 'debugging',
        updatedAt: now,
      })
      .where(eq(roles.id, roleId));

    return c.json(apiSuccess({
      workspaceId: instance.workspaceId,
      roleId,
      containerId: instance.containerId,
      port: instance.port,
      url: instance.url,
      status: 'debugging',
    }), 201);
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to start debug session');
  }
});

// POST /api/roles/:id/debug/stop - Stop debug session
roleDebug.post('/api/roles/:id/debug/stop', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const roleId = c.req.param('id');
    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    // Validate ownership
    const validation = await validateRoleOwnership(roleId, user.id);
    if (!validation.valid) {
      return c.json(apiError(validation.error || 'Access denied', 403), 403);
    }

    // Find the debug session
    let workspaceId: string | null = null;
    for (const [wsId, session] of debugSessions.entries()) {
      if (session.roleId === roleId) {
        workspaceId = wsId;
        break;
      }
    }

    if (!workspaceId) {
      return c.json(apiError('No active debug session for this role', 404), 404);
    }

    logger.info({ roleId, userId: user.id, workspaceId }, 'Stopping debug session');

    // Release container (from picoclaw pool, we need to use containerId)
    const role = validation.role;
    if (role?.containerId) {
      try {
        const Docker = (await import('dockerode')).default;
        const docker = new Docker({ socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock' });
        const container = docker.getContainer(role.containerId);
        await container.stop({ t: 10 });
        await container.remove({ force: true });
      } catch (err) {
        logger.warn({ err, containerId: role.containerId }, 'Error stopping container');
      }
    }

    // Clear debug session
    clearDebugSession(workspaceId);

    // Update role status
    const now = Date.now();
    await db
      .update(roles)
      .set({
        status: 'stopped',
        containerId: null,
        containerPort: null,
        updatedAt: now,
      })
      .where(eq(roles.id, roleId));

    return c.json(apiSuccess({
      roleId,
      status: 'stopped',
      message: 'Debug session stopped successfully',
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to stop debug session');
  }
});

// GET /api/roles/:id/debug/status - Get debug status
roleDebug.get('/api/roles/:id/debug/status', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const roleId = c.req.param('id');
    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    // Validate ownership
    const validation = await validateRoleOwnership(roleId, user.id);
    if (!validation.valid) {
      return c.json(apiError(validation.error || 'Access denied', 403), 403);
    }

    const role = validation.role;

    // Find debug session info
    let workspaceId: string | null = null;
    let debugActive = false;

    for (const [wsId, session] of debugSessions.entries()) {
      if (session.roleId === roleId) {
        workspaceId = wsId;
        debugActive = true;
        break;
      }
    }

    // Get current container status if running
    let containerStatus = 'stopped';
    if (role?.containerId) {
      try {
        const Docker = (await import('dockerode')).default;
        const docker = new Docker({ socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock' });
        const container = docker.getContainer(role.containerId);
        const info = await container.inspect();
        containerStatus = info.State.Running ? 'running' : 'stopped';
      } catch {
        containerStatus = 'stopped';
      }
    }

    return c.json(apiSuccess({
      roleId,
      debugActive,
      workspaceId,
      containerId: role?.containerId,
      containerPort: role?.containerPort,
      status: role?.status || 'stopped',
      containerStatus,
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to get debug status');
  }
});

// WebSocket handler for pico channel proxy
const wss = new WebSocketServer({ noServer: true });

export function handleRoleDebugWsUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer
): void {
  const url = req.url || '';
  // /api/roles/:id/debug/ws
  const match = url.match(/^\/api\/roles\/([^/]+)\/debug\/ws$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const roleId = match[1];

  wss.handleUpgrade(req, socket, head, (ws) => {
    (async () => {
      try {
        // Get user from auth header or query
        const userId = (req.headers['x-user-id'] as string) || '';

        if (!userId) {
          ws.close(4001, 'Unauthorized');
          return;
        }

        // Validate ownership
        const validation = await validateRoleOwnership(roleId, userId);
        if (!validation.valid) {
          ws.close(4003, 'Access denied');
          return;
        }

        // Find the debug session
        let workspaceId: string | null = null;
        for (const [wsId, session] of debugSessions.entries()) {
          if (session.roleId === roleId) {
            workspaceId = wsId;
            break;
          }
        }

        if (!workspaceId) {
          ws.close(4004, 'No active debug session');
          return;
        }

        const role = validation.role;
        const containerPort = role?.containerPort;

        if (!containerPort) {
          ws.close(4005, 'Container not running');
          return;
        }

        // Connect to container's pico channel
        const containerUrl = `ws://localhost:${containerPort}/pico/ws`;
        const containerWs = new WebSocket(containerUrl);

        containerWs.on('open', () => {
          logger.info({ roleId, workspaceId, containerUrl }, 'Role debug WS proxy: connected to container');
        });

        // Frontend -> Container
        ws.on('message', (data) => {
          if (containerWs.readyState === WebSocket.OPEN) {
            containerWs.send(data);
          }
        });

        // Container -> Frontend
        containerWs.on('message', (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        // Cleanup on disconnect
        ws.on('close', (code) => {
          logger.info({ roleId, workspaceId, code }, 'Role debug WS proxy: frontend disconnected');
          containerWs.close();
        });

        containerWs.on('close', () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });

        containerWs.on('error', (err) => {
          logger.error({ err, roleId, workspaceId }, 'Role debug WS proxy: container connection error');
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1011, 'Container connection error');
          }
        });
      } catch (error) {
        logger.error({ error, roleId }, 'Role debug WS proxy: setup failed');
        ws.close(1011, 'Internal error');
      }
    })();
  });
}

export default roleDebug;