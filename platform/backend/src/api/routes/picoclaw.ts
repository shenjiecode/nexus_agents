import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, desc } from 'drizzle-orm';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import logger from '../../lib/logger.js';
import { handleError } from '../../lib/format-error.js';
import { picoclawWorkspaces } from '../../db/schema.js';
import { client } from '../../db/index.js';
import {
  allocate,
  getStatus,
  getLogs,
  type PicoClawVariant,
} from '../../services/picoclaw-pool.js';

// Initialize DB
const db = drizzle(client);

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, message, status };
}

// Create picoclaw router
const picoclaw = new Hono();

// POST /api/picoclaw/workspaces - Create workspace + start container
picoclaw.post('/api/picoclaw/workspaces', async (c) => {
  try {
    const body = await c.req.json();

    // Validate input
    if (!body || typeof body !== 'object') {
      return c.json(apiError('Request body must be an object', 400), 400);
    }

    if (!body.userId || typeof body.userId !== 'string') {
      return c.json(apiError('userId is required and must be a string', 400), 400);
    }

    if (!body.name || typeof body.name !== 'string') {
      return c.json(apiError('name is required and must be a string', 400), 400);
    }

    const variant = (body.variant || 'base') as PicoClawVariant;
    if (!['base', 'full', 'heavy'].includes(variant)) {
      return c.json(apiError('variant must be base, full, or heavy', 400), 400);
    }

    const userId = body.userId;
    const name = body.name.trim();
    const now = Date.now();

    // Insert workspace record first
    const workspaceId = `picoclaw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    
    await db.insert(picoclawWorkspaces).values({
      id: workspaceId,
      userId,
      name,
      variant,
      status: 'starting',
      createdAt: now,
      updatedAt: now,
    });

    // Allocate container (this starts the container too)
    const instance = await allocate(userId, variant);

    // Update workspace with container info
    await db
      .update(picoclawWorkspaces)
      .set({
        containerId: instance.containerId,
        containerPort: instance.port,
        status: instance.status,
        updatedAt: Date.now(),
      })
      .where(eq(picoclawWorkspaces.id, workspaceId));

    return c.json(apiSuccess({
      workspaceId,
      name,
      variant,
      containerId: instance.containerId,
      port: instance.port,
      url: instance.url,
      status: instance.status,
      createdAt: new Date(now).toISOString(),
    }), 201);
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to create workspace');
  }
});

// GET /api/picoclaw/workspaces - List user workspaces
picoclaw.get('/api/picoclaw/workspaces', async (c) => {
  try {
    const userId = c.req.query('userId');

    if (!userId) {
      return c.json(apiError('userId query parameter is required', 400), 400);
    }

    const workspaces = await db
      .select()
      .from(picoclawWorkspaces)
      .where(eq(picoclawWorkspaces.userId, userId))
      .orderBy(desc(picoclawWorkspaces.createdAt));

    // Enrich with current container status
    const enriched = await Promise.all(
      workspaces.map(async (ws) => {
        let currentStatus = ws.status;
        
        try {
          const instance = await getStatus(ws.id);
          if (instance) {
            currentStatus = instance.status;
          }
        } catch {
          // Ignore status errors
        }

        return {
          id: ws.id,
          name: ws.name,
          variant: ws.variant,
          containerId: ws.containerId,
          containerPort: ws.containerPort,
          status: currentStatus,
          workspacePath: ws.workspacePath,
          createdAt: ws.createdAt,
          updatedAt: ws.updatedAt,
        };
      })
    );

    return c.json(apiSuccess(enriched));
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to list workspaces');
  }
});

// GET /api/picoclaw/:workspaceId/status - Get workspace status
picoclaw.get('/api/picoclaw/:workspaceId/status', async (c) => {
  try {
    const workspaceId = c.req.param('workspaceId');

    if (!workspaceId) {
      return c.json(apiError('workspaceId is required', 400), 400);
    }

    // Get from DB first
    const [workspace] = await db
      .select()
      .from(picoclawWorkspaces)
      .where(eq(picoclawWorkspaces.id, workspaceId));

    if (!workspace) {
      return c.json(apiError('Workspace not found', 404), 404);
    }

    // Get current container status
    const instance = await getStatus(workspaceId);
    const currentStatus = instance?.status || workspace.status;

    return c.json(apiSuccess({
      workspaceId: workspace.id,
      name: workspace.name,
      variant: workspace.variant,
      containerId: workspace.containerId,
      containerPort: workspace.containerPort,
      status: currentStatus,
      url: instance?.url || `http://localhost:${workspace.containerPort}`,
      createdAt: workspace.createdAt,
      startedAt: instance?.startedAt?.toISOString(),
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to get workspace status');
  }
});

// POST /api/picoclaw/:workspaceId/start - Start container
picoclaw.post('/api/picoclaw/:workspaceId/start', async (c) => {
  try {
    const workspaceId = c.req.param('workspaceId');

    if (!workspaceId) {
      return c.json(apiError('workspaceId is required', 400), 400);
    }

    // Get from DB
    const [workspace] = await db
      .select()
      .from(picoclawWorkspaces)
      .where(eq(picoclawWorkspaces.id, workspaceId));

    if (!workspace) {
      return c.json(apiError('Workspace not found', 404), 404);
    }

    // Get current instance status
    const instance = await getStatus(workspaceId);

    if (!instance) {
      return c.json(apiError('Container not found', 404), 404);
    }

    if (instance.status === 'running') {
      return c.json(apiSuccess({
        workspaceId,
        status: 'already running',
        message: 'Container is already running',
      }));
    }

    // Try to start the container using Dockerode
    const Docker = (await import('dockerode')).default;
    const docker = new Docker({ socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock' });
    const container = docker.getContainer(instance.containerId);
    
    await container.start();

    // Update DB status
    await db
      .update(picoclawWorkspaces)
      .set({
        status: 'running',
        updatedAt: Date.now(),
      })
      .where(eq(picoclawWorkspaces.id, workspaceId));

    return c.json(apiSuccess({
      workspaceId,
      status: 'running',
      message: 'Container started successfully',
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    
    // Check if already running
    if (error instanceof Error && error.message.includes('already started')) {
      return c.json(apiSuccess({
        message: 'Container already running',
      }));
    }
    
    return handleError(c, error, 'Failed to start container');
  }
});

// POST /api/picoclaw/:workspaceId/stop - Stop container
picoclaw.post('/api/picoclaw/:workspaceId/stop', async (c) => {
  try {
    const workspaceId = c.req.param('workspaceId');

    if (!workspaceId) {
      return c.json(apiError('workspaceId is required', 400), 400);
    }

    // Get from DB
    const [workspace] = await db
      .select()
      .from(picoclawWorkspaces)
      .where(eq(picoclawWorkspaces.id, workspaceId));

    if (!workspace) {
      return c.json(apiError('Workspace not found', 404), 404);
    }

    // Get current instance status
    const instance = await getStatus(workspaceId);

    if (!instance) {
      return c.json(apiError('Container not found', 404), 404);
    }

    if (instance.status === 'stopped') {
      return c.json(apiSuccess({
        workspaceId,
        status: 'already stopped',
        message: 'Container is already stopped',
      }));
    }

    // Stop the container using Dockerode
    const Docker = (await import('dockerode')).default;
    const docker = new Docker({ socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock' });
    const container = docker.getContainer(instance.containerId);
    
    await container.stop({ t: 10 });

    // Update DB status
    await db
      .update(picoclawWorkspaces)
      .set({
        status: 'stopped',
        updatedAt: Date.now(),
      })
      .where(eq(picoclawWorkspaces.id, workspaceId));

    return c.json(apiSuccess({
      workspaceId,
      status: 'stopped',
      message: 'Container stopped successfully',
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    
    // Check if already stopped
    if (error instanceof Error && error.message.includes('already stopped')) {
      return c.json(apiSuccess({
        message: 'Container already stopped',
      }));
    }
    
    return handleError(c, error, 'Failed to stop container');
  }
});

// GET /api/picoclaw/:workspaceId/logs - Get container logs
picoclaw.get('/api/picoclaw/:workspaceId/logs', async (c) => {
  try {
    const workspaceId = c.req.param('workspaceId');
    const tail = parseInt(c.req.query('tail') || '100', 10);

    if (!workspaceId) {
      return c.json(apiError('workspaceId is required', 400), 400);
    }

    // Check workspace exists
    const [workspace] = await db
      .select()
      .from(picoclawWorkspaces)
      .where(eq(picoclawWorkspaces.id, workspaceId));

    if (!workspace) {
      return c.json(apiError('Workspace not found', 404), 404);
    }

    // Get logs from container
    const logs = await getLogs(workspaceId, tail);

    return c.json(apiSuccess({
      workspaceId,
      logs,
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to get container logs');
  }
});

// GET /api/picoclaw/:workspaceId/export - Export workspace as zip
picoclaw.get('/api/picoclaw/:workspaceId/export', async (c) => {
  try {
    const workspaceId = c.req.param('workspaceId');

    if (!workspaceId) {
      return c.json(apiError('workspaceId is required', 400), 400);
    }

    // Get workspace from DB
    const [workspace] = await db
      .select()
      .from(picoclawWorkspaces)
      .where(eq(picoclawWorkspaces.id, workspaceId));

    if (!workspace) {
      return c.json(apiError('Workspace not found', 404), 404);
    }

    // Construct path to workspace directory
    const workspaceDir = path.join(process.cwd(), 'data', 'picoclaw', workspace.userId, workspaceId);
    const picoclawDir = path.join(workspaceDir, '.picoclaw');

    // Check if .picoclaw directory exists
    if (!fs.existsSync(picoclawDir)) {
      return c.json(apiError('Workspace data not found', 404), 404);
    }

    // Create zip file using adm-zip
    const zip = new AdmZip();

    // Add all files from .picoclaw directory
    zip.addLocalFolder(picoclawDir, '.picoclaw');

    // Generate zip buffer
    const zipBuffer = zip.toBuffer();

    // Set filename
    const filename = `picoclaw-${workspace.name}.zip`;

    // Return with proper headers
    c.header('Content-Type', 'application/zip');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    c.header('Content-Length', String(zipBuffer.length));

    return c.body(zipBuffer);
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to export workspace');
  }
});

// WebSocket proxy for pico channel
const wss = new WebSocketServer({ noServer: true });

export function handlePicoWsUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer
): void {
  const url = req.url || '';
  // /api/picoclaw/:workspaceId/ws
  const match = url.match(/^\/api\/picoclaw\/([^/]+)\/ws$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const workspaceId = match[1];

  wss.handleUpgrade(req, socket, head, (ws) => {
    (async () => {
      try {
        const [workspace] = await db
          .select()
          .from(picoclawWorkspaces)
          .where(eq(picoclawWorkspaces.id, workspaceId));

        if (!workspace || !workspace.containerPort) {
          ws.close(4004, 'Workspace not found or no container port');
          return;
        }

        const containerUrl = `ws://localhost:${workspace.containerPort}/pico/ws`;
        const containerWs = new WebSocket(containerUrl);

        containerWs.on('open', () => {
          logger.info({ workspaceId, containerUrl }, 'PicoClaw WS proxy: connected to container');
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
          logger.info({ workspaceId, code }, 'PicoClaw WS proxy: frontend disconnected');
          containerWs.close();
        });

        containerWs.on('close', () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });

        containerWs.on('error', (err) => {
          logger.error({ err, workspaceId }, 'PicoClaw WS proxy: container connection error');
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1011, 'Container connection error');
          }
        });
      } catch (error) {
        logger.error({ error, workspaceId }, 'PicoClaw WS proxy: setup failed');
        ws.close(1011, 'Internal error');
      }
    })();
  });
}

export default picoclaw;