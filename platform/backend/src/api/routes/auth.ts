import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import { handleError, apiSuccess, apiError } from '../../lib/format-error.js';
import { getOrganizationBySlug, verifyPassword } from '../../services/org-service.js';

const auth = new Hono();

// POST /api/auth/login - Organization login
auth.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json();

    if (!body || typeof body !== 'object') {
      return c.json(apiError('Request body must be an object', 400), 400);
    }

    const identifier = body.slug || body.name;
    const password = body.password;

    if (!identifier || typeof identifier !== 'string') {
      return c.json(apiError('slug is required', 400), 400);
    }

    if (!password || typeof password !== 'string') {
      return c.json(apiError('password is required', 400), 400);
    }

    // Find organization by slug
    const org = await getOrganizationBySlug(identifier);
    if (!org) {
      return c.json(apiError('Invalid credentials', 401), 401);
    }

    // Verify password — need to fetch raw record with password hash
    const { initDatabase } = await import('../../db/index.js');
    const { organizations } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const db = await initDatabase();
    const records = await db
      .select({ password: organizations.password })
      .from(organizations)
      .where(eq(organizations.id, org.id));

    if (records.length === 0) {
      return c.json(apiError('Invalid credentials', 401), 401);
    }

    const valid = await verifyPassword(password, records[0].password);
    if (!valid) {
      return c.json(apiError('Invalid credentials', 401), 401);
    }

    return c.json(apiSuccess({
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      role: 'org',
      orgId: org.id,
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Login failed');
  }
});

// POST /api/auth/admin-login - Admin login (environment variable password)
auth.post('/api/auth/admin-login', async (c) => {
  try {
    const body = await c.req.json();

    if (!body || typeof body !== 'object') {
      return c.json(apiError('Request body must be an object', 400), 400);
    }

    const password = body.password;
    if (!password || typeof password !== 'string') {
      return c.json(apiError('password is required', 400), 400);
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return c.json(apiError('Admin login not configured', 503), 503);
    }

    if (password !== adminPassword) {
      return c.json(apiError('Invalid credentials', 401), 401);
    }

    return c.json(apiSuccess({
      id: 'admin',
      name: 'Admin',
      slug: 'admin',
      role: 'admin',
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Login failed');
  }
});

export default auth;