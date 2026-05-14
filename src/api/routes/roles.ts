import { Hono } from 'hono';
import {
  createRole,
  getAllRoles,
  getRoleBySlug,
  updateRole,
  deleteRole,
  getRoleVersions,
} from '../../services/role-service.js';

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, error: message, status };
}

// Create roles router
const roles = new Hono();

// POST /api/roles - Create role
roles.post('/api/roles', async (c) => {
  try {
    const body = await c.req.json();

    // Validate input
    if (!body || typeof body !== 'object') {
      return c.json(apiError('Request body must be an object', 400), 400);
    }

    if (!body.name || typeof body.name !== 'string') {
      return c.json(apiError('name is required', 400), 400);
    }

    if (!body.slug || typeof body.slug !== 'string') {
      return c.json(apiError('slug is required', 400), 400);
    }

    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      return c.json(apiError('slug must be lowercase alphanumeric with dashes', 400), 400);
    }

    const result = await createRole({
      name: body.name.trim(),
      slug: body.slug.trim(),
      description: body.description?.trim(),
      prompts: body.prompts,
      skills: body.skills,
    });

    return c.json(apiSuccess(result), 201);
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to create role', 500), 500);
  }
});

// GET /api/roles - List all roles
roles.get('/api/roles', async (c) => {
  try {
    const result = await getAllRoles();
    return c.json(apiSuccess(result));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to list roles', 500), 500);
  }
});

// GET /api/roles/:slug - Get role by slug
roles.get('/api/roles/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const result = await getRoleBySlug(slug);

    if (!result) {
      return c.json(apiError('Role not found', 404), 404);
    }

    return c.json(apiSuccess(result));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to get role', 500), 500);
  }
});

// GET /api/roles/:slug/versions - Get role versions
roles.get('/api/roles/:slug/versions', async (c) => {
  try {
    const slug = c.req.param('slug');
    
    // Get role ID first
    const role = await getRoleBySlug(slug);
    if (!role) {
      return c.json(apiError('Role not found', 404), 404);
    }

    const result = await getRoleVersions(role.id);
    return c.json(apiSuccess(result));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to get role versions', 500), 500);
  }
});

// PUT /api/roles/:slug - Update role (creates new version)
roles.put('/api/roles/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const body = await c.req.json();

    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
      return c.json(apiError('name must be a non-empty string', 400), 400);
    }

    const result = await updateRole(slug, body);

    if (!result) {
      return c.json(apiError('Role not found', 404), 404);
    }

    return c.json(apiSuccess(result));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to update role', 500), 500);
  }
});

// DELETE /api/roles/:slug - Delete role
roles.delete('/api/roles/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const result = await deleteRole(slug);

    if (!result) {
      return c.json(apiError('Role not found', 404), 404);
    }

    return c.json(apiSuccess({ success: true }));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to delete role', 500), 500);
  }
});

export default roles;
