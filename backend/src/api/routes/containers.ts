import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import {
  getAllContainers,
  getContainer,
  removeContainer,
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
      memoryPath: container.memoryPath,
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
      memoryPath: container.memoryPath,
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

export default containers;
