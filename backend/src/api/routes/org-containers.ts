import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import { getOrganizationBySlug } from '../../services/org-service.js';
import { getRoleBySlug } from '../../services/role-service.js';
import {
  createContainer,
  startContainer,
  stopContainer,
  removeContainer,
  getContainer,
  getContainersByOrganization,
} from '../../services/container-manager.js';

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, error: message, status };
}

// Create org containers router
const orgContainers = new Hono();

// GET /api/orgs/:orgSlug/containers - List organization's containers
orgContainers.get('/api/orgs/:orgSlug/containers', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const containers = getContainersByOrganization(org.id);
    
    return c.json(apiSuccess(containers.map(c => ({
      id: c.id,
      roleSlug: c.roleSlug,
      roleVersion: c.roleVersion,
      status: c.status,
      port: c.port,
      url: c.url,
      healthStatus: c.healthStatus,
      createdAt: c.createdAt.toISOString(),
    }))));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to list containers', 500), 500);
  }
});

// POST /api/orgs/:orgSlug/containers - Hire a role (create container)
orgContainers.post('/api/orgs/:orgSlug/containers', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const body = await c.req.json();

    // Validate input
    if (!body || typeof body !== 'object') {
      return c.json(apiError('Request body must be an object', 400), 400);
    }

    if (!body.roleSlug || typeof body.roleSlug !== 'string') {
      return c.json(apiError('roleSlug is required', 400), 400);
    }

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    // Verify role exists
    const role = await getRoleBySlug(body.roleSlug);
    if (!role) {
      return c.json(apiError('Role not found', 404), 404);
    }

    // Create container
    const container = await createContainer(
      org.id,
      orgSlug,
      role.id,
      role.slug,
      body.roleVersion || 'latest',
      role.imageName
    );

    // Start container
    await startContainer(container.id);

    return c.json(apiSuccess({
      id: container.id,
      roleSlug: container.roleSlug,
      roleVersion: container.roleVersion,
      status: container.status,
      port: container.port,
      url: container.url,
      password: container.password,
      employeeDataPath: container.employeeDataPath,
      createdAt: container.createdAt.toISOString(),
    }), 201);
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to create container', 500), 500);
  }
});

// GET /api/orgs/:orgSlug/containers/:containerId - Get container details
orgContainers.get('/api/orgs/:orgSlug/containers/:containerId', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const containerId = c.req.param('containerId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const container = getContainer(containerId);
    if (!container || container.organizationId !== org.id) {
      return c.json(apiError('Container not found', 404), 404);
    }

    return c.json(apiSuccess({
      id: container.id,
      roleSlug: container.roleSlug,
      roleVersion: container.roleVersion,
      status: container.status,
      port: container.port,
      url: container.url,
      healthStatus: container.healthStatus,
      employeeDataPath: container.employeeDataPath,
      createdAt: container.createdAt.toISOString(),
    }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to get container', 500), 500);
  }
});

// POST /api/orgs/:orgSlug/containers/:containerId/start - Start container
orgContainers.post('/api/orgs/:orgSlug/containers/:containerId/start', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const containerId = c.req.param('containerId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const container = getContainer(containerId);
    if (!container || container.organizationId !== org.id) {
      return c.json(apiError('Container not found', 404), 404);
    }

    const result = await startContainer(containerId);

    return c.json(apiSuccess({
      id: result.id,
      status: result.status,
    }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to start container', 500), 500);
  }
});

// POST /api/orgs/:orgSlug/containers/:containerId/stop - Stop container
orgContainers.post('/api/orgs/:orgSlug/containers/:containerId/stop', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const containerId = c.req.param('containerId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const container = getContainer(containerId);
    if (!container || container.organizationId !== org.id) {
      return c.json(apiError('Container not found', 404), 404);
    }

    const result = await stopContainer(containerId);

    return c.json(apiSuccess({
      id: result.id,
      status: result.status,
    }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to stop container', 500), 500);
  }
});

// DELETE /api/orgs/:orgSlug/containers/:containerId - Remove container
orgContainers.delete('/api/orgs/:orgSlug/containers/:containerId', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const containerId = c.req.param('containerId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const container = getContainer(containerId);
    if (!container || container.organizationId !== org.id) {
      return c.json(apiError('Container not found', 404), 404);
    }

    await removeContainer(containerId);

    return c.json(apiSuccess({ success: true }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to remove container', 500), 500);
  }
});

export default orgContainers;
