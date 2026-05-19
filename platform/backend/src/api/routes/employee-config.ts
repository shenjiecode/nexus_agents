import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import {
  getEmployeeConfig,
  installMcp,
  uninstallMcp,
  installSkill,
  uninstallSkill,
  updateAgentsMd,
  getAgentsMd,
} from '../../services/employee-config-service.js';

const router = new Hono();

// ============== Employee Config ==============

/**
 * GET /api/employees/:id/config
 * Get employee's current config (installed MCPs, Skills, AGENTS.md)
 */
router.get('/api/employees/:id/config', async (c) => {
  try {
    const empId = c.req.param('id');
    const result = await getEmployeeConfig(empId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(error, 'Failed to get employee config');
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============== MCP Operations ==============

/**
 * POST /api/employees/:id/mcps/:mcpId/install
 * Install MCP to employee (download + merge into opencode.json)
 */
router.post('/api/employees/:id/mcps/:mcpId/install', async (c) => {
  try {
    const empId = c.req.param('id');
    const mcpId = c.req.param('mcpId');
    await installMcp(empId, mcpId);
    return c.json({ success: true, data: { empId, mcpId, action: 'installed' } });
  } catch (error: any) {
    logger.error(error, 'Failed to install MCP');
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * DELETE /api/employees/:id/mcps/:mcpId
 * Uninstall MCP from employee (remove from opencode.json + update DB)
 */
router.delete('/api/employees/:id/mcps/:mcpId', async (c) => {
  try {
    const empId = c.req.param('id');
    const mcpId = c.req.param('mcpId');
    await uninstallMcp(empId, mcpId);
    return c.json({ success: true, data: { empId, mcpId, action: 'uninstalled' } });
  } catch (error: any) {
    logger.error(error, 'Failed to uninstall MCP');
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============== Skill Operations ==============

/**
 * POST /api/employees/:id/skills/:skillId/install
 * Install Skill to employee (download + extract to .opencode/skills/{slug}/)
 */
router.post('/api/employees/:id/skills/:skillId/install', async (c) => {
  try {
    const empId = c.req.param('id');
    const skillId = c.req.param('skillId');
    await installSkill(empId, skillId);
    return c.json({ success: true, data: { empId, skillId, action: 'installed' } });
  } catch (error: any) {
    logger.error(error, 'Failed to install skill');
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * DELETE /api/employees/:id/skills/:skillId
 * Uninstall Skill from employee (remove directory + update DB)
 */
router.delete('/api/employees/:id/skills/:skillId', async (c) => {
  try {
    const empId = c.req.param('id');
    const skillId = c.req.param('skillId');
    await uninstallSkill(empId, skillId);
    return c.json({ success: true, data: { empId, skillId, action: 'uninstalled' } });
  } catch (error: any) {
    logger.error(error, 'Failed to uninstall skill');
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============== AGENTS.md Operations ==============

/**
 * GET /api/employees/:id/agents-md
 * Get AGENTS.md content
 */
router.get('/api/employees/:id/agents-md', async (c) => {
  try {
    const empId = c.req.param('id');
    const content = await getAgentsMd(empId);
    return c.json({ success: true, data: { content } });
  } catch (error: any) {
    logger.error(error, 'Failed to get AGENTS.md');
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * PUT /api/employees/:id/agents-md
 * Update AGENTS.md content
 */
router.put('/api/employees/:id/agents-md', async (c) => {
  try {
    const empId = c.req.param('id');
    const { content } = await c.req.json();
    if (typeof content !== 'string') {
      return c.json({ success: false, error: 'content must be a string' }, 400);
    }
    await updateAgentsMd(empId, content);
    return c.json({ success: true, data: { empId, action: 'updated' } });
  } catch (error: any) {
    logger.error(error, 'Failed to update AGENTS.md');
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default router;
