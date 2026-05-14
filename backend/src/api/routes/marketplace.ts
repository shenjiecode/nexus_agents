import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import {
  initializeMarketplace,
  getAllSkills,
  getSkillBySlug,
  createSkill,
  deleteSkill,
  getAllMcps,
  getMcpBySlug,
  createMcp,
  deleteMcp,
  getSkillsForRole,
  getMcpsForRole,
  addSkillToRole,
  addMcpToRole,
  removeSkillFromRole,
  removeMcpFromRole,
} from '../../services/marketplace-service.js';

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, error: message, status };
}

const marketplace = new Hono();

/**
 * Initialize marketplace on first request
 */
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initializeMarketplace();
    initialized = true;
  }
}

// ============== Skills Routes ==============

/**
 * GET /api/skills - List all skills
 */
marketplace.get('/api/skills', async (c) => {
  try {
    await ensureInitialized();
    const skills = await getAllSkills();
    return c.json(apiSuccess(skills));
  } catch (error: any) {
    logger.error(error, 'Failed to get skills');
    return c.json(apiError(error.message), 500);
  }
});

/**
 * GET /api/skills/:slug - Get skill by slug
 */
marketplace.get('/api/skills/:slug', async (c) => {
  try {
    await ensureInitialized();
    const slug = c.req.param('slug');
    const skill = await getSkillBySlug(slug);
    if (!skill) {
      return c.json(apiError('Skill not found'), 404);
    }
    return c.json(apiSuccess(skill));
  } catch (error: any) {
    logger.error(error, 'Failed to get skill');
    return c.json(apiError(error.message), 500);
  }
});

/**
 * POST /api/skills - Create new skill
 */
marketplace.post('/api/skills', async (c) => {
  try {
    await ensureInitialized();
    const body = await c.req.json();
    const skill = await createSkill(body);
    return c.json(apiSuccess(skill), 201);
  } catch (error: any) {
    logger.error(error, 'Failed to create skill');
    return c.json(apiError(error.message), 400);
  }
});

/**
 * DELETE /api/skills/:slug - Delete skill
 */
marketplace.delete('/api/skills/:slug', async (c) => {
  try {
    await ensureInitialized();
    const slug = c.req.param('slug');
    await deleteSkill(slug);
    return c.json(apiSuccess({ deleted: true }));
  } catch (error: any) {
    logger.error(error, 'Failed to delete skill');
    return c.json(apiError(error.message), 400);
  }
});

// ============== MCPs Routes ==============

/**
 * GET /api/mcps - List all MCPs
 */
marketplace.get('/api/mcps', async (c) => {
  try {
    await ensureInitialized();
    const mcps = await getAllMcps();
    return c.json(apiSuccess(mcps));
  } catch (error: any) {
    logger.error(error, 'Failed to get MCPs');
    return c.json(apiError(error.message), 500);
  }
});

/**
 * GET /api/mcps/:slug - Get MCP by slug
 */
marketplace.get('/api/mcps/:slug', async (c) => {
  try {
    await ensureInitialized();
    const slug = c.req.param('slug');
    const mcp = await getMcpBySlug(slug);
    if (!mcp) {
      return c.json(apiError('MCP not found'), 404);
    }
    return c.json(apiSuccess(mcp));
  } catch (error: any) {
    logger.error(error, 'Failed to get MCP');
    return c.json(apiError(error.message), 500);
  }
});

/**
 * POST /api/mcps - Create new MCP
 */
marketplace.post('/api/mcps', async (c) => {
  try {
    await ensureInitialized();
    const body = await c.req.json();
    const mcp = await createMcp(body);
    return c.json(apiSuccess(mcp), 201);
  } catch (error: any) {
    logger.error(error, 'Failed to create MCP');
    return c.json(apiError(error.message), 400);
  }
});

/**
 * DELETE /api/mcps/:slug - Delete MCP
 */
marketplace.delete('/api/mcps/:slug', async (c) => {
  try {
    await ensureInitialized();
    const slug = c.req.param('slug');
    await deleteMcp(slug);
    return c.json(apiSuccess({ deleted: true }));
  } catch (error: any) {
    logger.error(error, 'Failed to delete MCP');
    return c.json(apiError(error.message), 400);
  }
});

// ============== Role Association Routes ==============

/**
 * GET /api/roles/:slug/skills - Get skills for a role
 */
marketplace.get('/api/roles/:slug/skills', async (c) => {
  try {
    await ensureInitialized();
    const roleSlug = c.req.param('slug');
    const skills = await getSkillsForRole(roleSlug);
    return c.json(apiSuccess(skills));
  } catch (error: any) {
    logger.error(error, 'Failed to get role skills');
    return c.json(apiError(error.message), 500);
  }
});

/**
 * GET /api/roles/:slug/mcps - Get MCPs for a role
 */
marketplace.get('/api/roles/:slug/mcps', async (c) => {
  try {
    await ensureInitialized();
    const roleSlug = c.req.param('slug');
    const mcps = await getMcpsForRole(roleSlug);
    return c.json(apiSuccess(mcps));
  } catch (error: any) {
    logger.error(error, 'Failed to get role MCPs');
    return c.json(apiError(error.message), 500);
  }
});

/**
 * POST /api/roles/:slug/skills/:skillSlug - Add skill to role
 */
marketplace.post('/api/roles/:slug/skills/:skillSlug', async (c) => {
  try {
    await ensureInitialized();
    const roleSlug = c.req.param('slug');
    const skillSlug = c.req.param('skillSlug');
    await addSkillToRole(roleSlug, skillSlug);
    return c.json(apiSuccess({ added: true }));
  } catch (error: any) {
    logger.error(error, 'Failed to add skill to role');
    return c.json(apiError(error.message), 400);
  }
});

/**
 * DELETE /api/roles/:slug/skills/:skillSlug - Remove skill from role
 */
marketplace.delete('/api/roles/:slug/skills/:skillSlug', async (c) => {
  try {
    await ensureInitialized();
    const roleSlug = c.req.param('slug');
    const skillSlug = c.req.param('skillSlug');
    await removeSkillFromRole(roleSlug, skillSlug);
    return c.json(apiSuccess({ removed: true }));
  } catch (error: any) {
    logger.error(error, 'Failed to remove skill from role');
    return c.json(apiError(error.message), 400);
  }
});

/**
 * POST /api/roles/:slug/mcps/:mcpSlug - Add MCP to role
 */
marketplace.post('/api/roles/:slug/mcps/:mcpSlug', async (c) => {
  try {
    await ensureInitialized();
    const roleSlug = c.req.param('slug');
    const mcpSlug = c.req.param('mcpSlug');
    await addMcpToRole(roleSlug, mcpSlug);
    return c.json(apiSuccess({ added: true }));
  } catch (error: any) {
    logger.error(error, 'Failed to add MCP to role');
    return c.json(apiError(error.message), 400);
  }
});

/**
 * DELETE /api/roles/:slug/mcps/:mcpSlug - Remove MCP from role
 */
marketplace.delete('/api/roles/:slug/mcps/:mcpSlug', async (c) => {
  try {
    await ensureInitialized();
    const roleSlug = c.req.param('slug');
    const mcpSlug = c.req.param('mcpSlug');
    await removeMcpFromRole(roleSlug, mcpSlug);
    return c.json(apiSuccess({ removed: true }));
  } catch (error: any) {
    logger.error(error, 'Failed to remove MCP from role');
    return c.json(apiError(error.message), 400);
  }
});

export default marketplace;
