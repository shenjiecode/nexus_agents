import { Hono } from 'hono';
import { logger } from '../../lib/logger.js';
import { handleError, apiSuccess, apiError } from '../../lib/format-error.js';
import {
  getAllSkills,
  getSkillBySlug,
  createSkill,
  deleteSkill,
  getAllMcps,
  getMcpBySlug,
  createMcp,
  deleteMcp,
  getAllRoles,
  getRoleBySlug,
  createRole,
  updateRole,
  deleteRole,
} from '../../services/marketplace-service.js';
import { getUser, isOwner } from '../middleware/auth.js';

const marketplace = new Hono();

marketplace.get('/api/skills', async (c) => {
  try {
    const user = getUser(c);
    const orgQuery = c.req.query('org');
    let orgId = orgQuery;
    if (!orgId && user?.role === 'org' && user.orgId) orgId = user.orgId;
    return c.json(apiSuccess(await getAllSkills(orgId || undefined)));
  } catch (error: any) {
    logger.error(error, 'Failed to get skills');
    return handleError(c, error);
  }
});

marketplace.get('/api/skills/:slug', async (c) => {
  try {
    const skill = await getSkillBySlug(c.req.param('slug'));
    if (!skill) return c.json(apiError('Skill not found', 404), 404);
    return c.json(apiSuccess(skill));
  } catch (error: any) {
    logger.error(error, 'Failed to get skill');
    return handleError(c, error);
  }
});

marketplace.post('/api/skills', async (c) => {
  try {
    const user = getUser(c);
    if (!user) return c.json(apiError('Unauthorized', 401), 401);

    const body = await c.req.parseBody();
    const name = body.name as string;
    const slug = body.slug as string;
    const description = body.description as string;
    const category = body.category as string | undefined;
    const file = body.file as File | undefined;

    if (!file) return c.json(apiError('File is required', 400), 400);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const orgId = user.role === 'admin' ? null : (user.orgId || null);

    return c.json(apiSuccess(await createSkill(
      { name, slug, description, category },
      fileBuffer,
      orgId
    )), 201);
  } catch (error: any) {
    logger.error(error, 'Failed to create skill');
    return handleError(c, error);
  }
});

marketplace.delete('/api/skills/:slug', async (c) => {
  try {
    const user = getUser(c);
    if (!user) return c.json(apiError('Unauthorized', 401), 401);
    const skill = await getSkillBySlug(c.req.param('slug'));
    if (!skill) return c.json(apiError('Skill not found', 404), 404);
    if (!isOwner(c, skill.organizationId)) return c.json(apiError('Forbidden', 403), 403);
    await deleteSkill(c.req.param('slug'));
    return c.json(apiSuccess({ deleted: true }));
  } catch (error: any) {
    logger.error(error, 'Failed to delete skill');
    return handleError(c, error);
  }
});

marketplace.get('/api/mcps', async (c) => {
  try {
    const user = getUser(c);
    const orgQuery = c.req.query('org');
    let orgId = orgQuery;
    if (!orgId && user?.role === 'org' && user.orgId) orgId = user.orgId;
    return c.json(apiSuccess(await getAllMcps(orgId || undefined)));
  } catch (error: any) {
    logger.error(error, 'Failed to get MCPs');
    return handleError(c, error);
  }
});

marketplace.get('/api/mcps/:slug', async (c) => {
  try {
    const mcp = await getMcpBySlug(c.req.param('slug'));
    if (!mcp) return c.json(apiError('MCP not found', 404), 404);
    return c.json(apiSuccess(mcp));
  } catch (error: any) {
    logger.error(error, 'Failed to get MCP');
    return handleError(c, error);
  }
});

marketplace.post('/api/mcps', async (c) => {
  try {
    const user = getUser(c);
    if (!user) return c.json(apiError('Unauthorized', 401), 401);

    const body = await c.req.parseBody();
    const name = body.name as string;
    const slug = body.slug as string;
    const description = body.description as string;
    const category = body.category as string | undefined;
    const file = body.file as File | undefined;

    if (!file) return c.json(apiError('File is required', 400), 400);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const orgId = user.role === 'admin' ? null : (user.orgId || null);

    return c.json(apiSuccess(await createMcp(
      { name, slug, description, category },
      fileBuffer,
      orgId
    )), 201);
  } catch (error: any) {
    logger.error(error, 'Failed to create MCP');
    return handleError(c, error);
  }
});

marketplace.delete('/api/mcps/:slug', async (c) => {
  try {
    const user = getUser(c);
    if (!user) return c.json(apiError('Unauthorized', 401), 401);
    const mcp = await getMcpBySlug(c.req.param('slug'));
    if (!mcp) return c.json(apiError('MCP not found', 404), 404);
    if (!isOwner(c, mcp.organizationId)) return c.json(apiError('Forbidden', 403), 403);
    await deleteMcp(c.req.param('slug'));
    return c.json(apiSuccess({ deleted: true }));
  } catch (error: any) {
    logger.error(error, 'Failed to delete MCP');
    return handleError(c, error);
  }
});


// ============== Marketplace Roles Routes ==============

marketplace.get('/api/marketplace-roles', async (c) => {
  try {
    const user = getUser(c);
    const orgQuery = c.req.query('org');
    let orgId = orgQuery;
    if (!orgId && user?.role === 'org' && user.orgId) orgId = user.orgId;
    return c.json(apiSuccess(await getAllRoles(orgId || undefined)));
  } catch (error: any) {
    logger.error(error, 'Failed to get marketplace roles');
    return handleError(c, error);
  }
});

marketplace.get('/api/marketplace-roles/:slug', async (c) => {
  try {
    const role = await getRoleBySlug(c.req.param('slug'));
    if (!role) return c.json(apiError('Role not found', 404), 404);
    return c.json(apiSuccess(role));
  } catch (error: any) {
    logger.error(error, 'Failed to get marketplace role');
    return handleError(c, error);
  }
});

marketplace.post('/api/marketplace-roles', async (c) => {
  try {
    const user = getUser(c);
    if (!user) return c.json(apiError('Unauthorized', 401), 401);

    const body = await c.req.json();
    const { name, slug, description, mcpIds, skillIds, agentsMd } = body as any;

    if (!name || !slug || !description) {
      return c.json(apiError('name, slug, and description are required', 400), 400);
    }

    const orgId = user.role === 'admin' ? null : (user.orgId || null);

    return c.json(apiSuccess(await createRole(
      { name, slug, description, mcpIds, skillIds, agentsMd },
      orgId
    )), 201);
  } catch (error: any) {
    logger.error(error, 'Failed to create marketplace role');
    return handleError(c, error);
  }
});

marketplace.put('/api/marketplace-roles/:slug', async (c) => {
  try {
    const user = getUser(c);
    if (!user) return c.json(apiError('Unauthorized', 401), 401);
    const role = await getRoleBySlug(c.req.param('slug'));
    if (!role) return c.json(apiError('Role not found', 404), 404);
    if (!isOwner(c, role.organizationId)) return c.json(apiError('Forbidden', 403), 403);

    const body = await c.req.json();
    const { name, description, mcpIds, skillIds, agentsMd } = body as any;

    return c.json(apiSuccess(await updateRole(c.req.param('slug'), { name, description, mcpIds, skillIds, agentsMd })));
  } catch (error: any) {
    logger.error(error, 'Failed to update marketplace role');
    return handleError(c, error);
  }
});

marketplace.delete('/api/marketplace-roles/:slug', async (c) => {
  try {
    const user = getUser(c);
    if (!user) return c.json(apiError('Unauthorized', 401), 401);
    const role = await getRoleBySlug(c.req.param('slug'));
    if (!role) return c.json(apiError('Role not found', 404), 404);
    if (!isOwner(c, role.organizationId)) return c.json(apiError('Forbidden', 403), 403);
    await deleteRole(c.req.param('slug'));
    return c.json(apiSuccess({ deleted: true }));
  } catch (error: any) {
    logger.error(error, 'Failed to delete marketplace role');
    return handleError(c, error);
  }
});

export default marketplace;
