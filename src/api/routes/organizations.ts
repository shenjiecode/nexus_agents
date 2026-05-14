import { Hono } from 'hono';
  import {
  createOrganization,
  getAllOrganizations,
  getOrganizationById,
  getOrganizationBySlug,
  updateOrganization,
  deleteOrganization,
  slugify,
  getOrganizationAuth,
  setOrganizationAuth,
  deleteOrganizationAuth,
  type AuthConfig,
} from '../../services/org-service.js';

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, error: message, status };
}

// Create organizations router
const organizations = new Hono();

// POST /api/organizations - Create organization
organizations.post('/api/organizations', async (c) => {
  try {
    const body = await c.req.json();

    // Validate input
    if (!body || typeof body !== 'object') {
      return c.json(apiError('Request body must be an object', 400), 400);
    }

    if (!body.name || typeof body.name !== 'string') {
      return c.json(apiError('name is required and must be a string', 400), 400);
    }

    // Auto-generate slug if not provided
    const slug = body.slug || slugify(body.name);

    const result = await createOrganization({
      name: body.name.trim(),
      slug: slug,
      description: body.description?.trim(),
    });

    return c.json(apiSuccess(result), 201);
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to create organization', 500), 500);
  }
});

// GET /api/organizations - List all organizations
organizations.get('/api/organizations', async (c) => {
  try {
    const result = await getAllOrganizations();
    return c.json(apiSuccess(result));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to list organizations', 500), 500);
  }
});

// GET /api/organizations/:id - Get organization by ID
organizations.get('/api/organizations/:id', async (c) => {
  try {
    const orgId = c.req.param('id');
    const result = await getOrganizationById(orgId);

    if (!result) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    return c.json(apiSuccess(result));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to get organization', 500), 500);
  }
});

// GET /api/orgs/:slug - Get organization by slug
organizations.get('/api/orgs/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const result = await getOrganizationBySlug(slug);

    if (!result) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    return c.json(apiSuccess(result));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to get organization', 500), 500);
  }
});

// PUT /api/organizations/:id - Update organization
organizations.put('/api/organizations/:id', async (c) => {
  try {
    const orgId = c.req.param('id');
    const body = await c.req.json();

    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
      return c.json(apiError('name must be a non-empty string', 400), 400);
    }

    if (body.slug !== undefined) {
      if (typeof body.slug !== 'string' || !/^[a-z0-9-]+$/.test(body.slug)) {
        return c.json(apiError('slug must be lowercase alphanumeric with dashes', 400), 400);
      }
    }

    const result = await updateOrganization(orgId, body);

    if (!result) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    return c.json(apiSuccess(result));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to update organization', 500), 500);
  }
});

// DELETE /api/organizations/:id - Delete organization
organizations.delete('/api/organizations/:id', async (c) => {
  try {
    const orgId = c.req.param('id');

    const result = await deleteOrganization(orgId);

    if (!result) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    return c.json(apiSuccess({ success: true }));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to delete organization', 500), 500);
  }
});

// ============ Auth Configuration Management ============

// GET /api/orgs/:slug/auth - Get organization's auth configuration
organizations.get('/api/orgs/:slug/auth', async (c) => {
  try {
    const slug = c.req.param('slug');
    
    // Verify organization exists
    const org = await getOrganizationBySlug(slug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }
    
    const auth = getOrganizationAuth(slug);
    return c.json(apiSuccess({
      hasAuth: auth !== null,
      providers: auth ? Object.keys(auth) : [],
      auth: auth, // Include full auth for admin use
    }));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to get auth configuration', 500), 500);
  }
});

// PUT /api/orgs/:slug/auth - Set organization's auth configuration
organizations.put('/api/orgs/:slug/auth', async (c) => {
  try {
    const slug = c.req.param('slug');
    const body = await c.req.json();
    
    // Verify organization exists
    const org = await getOrganizationBySlug(slug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }
    
    // Validate auth config format
    if (!body || typeof body !== 'object') {
      return c.json(apiError('Request body must be an object', 400), 400);
    }
    
    // Each provider must have type and key
    for (const [provider, config] of Object.entries(body)) {
      if (typeof config !== 'object' || config === null) {
        return c.json(apiError(`Invalid config for provider '${provider}': must be an object`, 400), 400);
      }
      const cfg = config as Record<string, unknown>;
      if (!cfg.type || !cfg.key || typeof cfg.type !== 'string' || typeof cfg.key !== 'string') {
        return c.json(apiError(`Invalid config for provider '${provider}': must have 'type' and 'key' strings`, 400), 400);
      }
      if (cfg.type !== 'api') {
        return c.json(apiError(`Unsupported auth type '${cfg.type}' for provider '${provider}'`, 400), 400);
      }
    }
    
    setOrganizationAuth(slug, body as AuthConfig);
    
    return c.json(apiSuccess({
      success: true,
      providers: Object.keys(body),
    }));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to set auth configuration', 500), 500);
  }
});

// DELETE /api/orgs/:slug/auth - Delete organization's auth configuration
organizations.delete('/api/orgs/:slug/auth', async (c) => {
  try {
    const slug = c.req.param('slug');
    
    // Verify organization exists
    const org = await getOrganizationBySlug(slug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }
    
    const result = deleteOrganizationAuth(slug);
    
    return c.json(apiSuccess({ success: result }));
  } catch (error: any) {
    return c.json(apiError(error.message || 'Failed to delete auth configuration', 500), 500);
  }
});

export default organizations;
