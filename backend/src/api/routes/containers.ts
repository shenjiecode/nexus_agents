import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import {
  getAllContainers,
  getContainer,
  removeContainer,
  getContainerSessions,
  getContainerConfig,
  updateContainerModel,
  updateHealthStatus,
} from '../../services/container-manager.js';

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, error: message, status };
}

// Create global containers router
const containers = new Hono();

// GET /api/containers - List all containers across all organizations
containers.get('/api/containers', async (c) => {
  try {
    const allContainers = getAllContainers();

    return c.json(apiSuccess(allContainers.map((container) => ({
      id: container.id,
      organizationId: container.organizationId,
      roleSlug: container.roleSlug,
      roleVersion: container.roleVersion,
      status: container.status,
      port: container.port,
      url: container.url,
      healthStatus: container.healthStatus,
      employeeDataPath: container.employeeDataPath,
      createdAt: container.createdAt.toISOString(),
    }))));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to list containers', 500), 500);
  }
});

// GET /api/containers/:id - Get single container by ID
containers.get('/api/containers/:id', async (c) => {
  try {
    const containerId = c.req.param('id');
    const container = getContainer(containerId);

    if (!container) {
      return c.json(apiError('Container not found', 404), 404);
    }

    return c.json(apiSuccess({
      id: container.id,
      organizationId: container.organizationId,
      roleId: container.roleId,
      roleSlug: container.roleSlug,
      roleVersion: container.roleVersion,
      status: container.status,
      port: container.port,
      url: container.url,
      healthStatus: container.healthStatus,
      employeeDataPath: container.employeeDataPath,
      createdAt: container.createdAt.toISOString(),
      startedAt: container.startedAt?.toISOString(),
      stoppedAt: container.stoppedAt?.toISOString(),
      errorMessage: container.errorMessage,
    }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to get container', 500), 500);
  }
});

// POST /api/containers/:id/health-check - Trigger health check
containers.post('/api/containers/:id/health-check', async (c) => {
  try {
    const containerId = c.req.param('id');
    const container = getContainer(containerId);

    if (!container) {
      return c.json(apiError('Container not found', 404), 404);
    }

    await updateHealthStatus(containerId);
    const updatedContainer = getContainer(containerId);

    return c.json(apiSuccess({
      healthStatus: updatedContainer?.healthStatus,
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    return c.json(apiError(error.message || 'Failed to check health', 500), 500);
  }
});

// DELETE /api/containers/:id - Delete container by ID
containers.delete('/api/containers/:id', async (c) => {
  try {
    const containerId = c.req.param('id');
    const container = getContainer(containerId);

    if (!container) {
      return c.json(apiError('Container not found', 404), 404);
    }

    await removeContainer(containerId, true);

    return c.json(apiSuccess({ success: true }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to delete container', 500), 500);
  }
});

// GET /api/containers/:id/config - Get container config
containers.get('/api/containers/:id/config', async (c) => {
  try {
    const containerId = c.req.param('id');
    const config = getContainerConfig(containerId);
    if (!config) {
      return c.json(apiError('Container config not found', 404), 404);
    }
    return c.json(apiSuccess(config));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to get container config', 500), 500);
  }
});

// GET /api/containers/:id/sessions - Get container sessions
containers.get('/api/containers/:id/sessions', async (c) => {
  try {
    const containerId = c.req.param('id');
    const sessions = await getContainerSessions(containerId);
    return c.json(apiSuccess(sessions));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to get sessions', 500), 500);
  }
});

// PUT /api/containers/:id/model - Update container model
containers.put('/api/containers/:id/model', async (c) => {
  try {
    const containerId = c.req.param('id');
    const body = await c.req.json();
    const model = body.model;
    
    if (!model || typeof model !== 'string') {
      return c.json(apiError('Missing or invalid model field', 400), 400);
    }
    
    updateContainerModel(containerId, model);
    return c.json(apiSuccess({ model }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to update model', 500), 500);
  }
});

export default containers;
