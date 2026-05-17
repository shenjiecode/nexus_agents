import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import logger from '../../lib/logger.js';
import { handleError } from '../../lib/format-error.js';
import { getOrganizationBySlug, getOrganizationBySlugWithMatrix } from '../../services/org-service.js';
import { getRoleById } from '../../services/marketplace-service.js';
import {
  createEmployee,
  startEmployee,
  stopEmployee,
  removeEmployee,
  getEmployee,
  getEmployeesByOrganization,
} from '../../services/employee-manager.js';

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, message, status };
}

// Create org employees router
const orgEmployees = new Hono();

// GET /api/orgs/:orgSlug/employees - List organization's employees
orgEmployees.get('/api/orgs/:orgSlug/employees', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const employees = getEmployeesByOrganization(org.id);
    
    return c.json(apiSuccess(employees.map(e => ({
      id: e.id,
      roleSlug: e.roleSlug,
      roleVersion: e.roleVersion,
      status: e.status,
      port: e.port,
      url: e.url,
      healthStatus: e.healthStatus,
      createdAt: e.createdAt.toISOString(),
    }))));
  } catch (error: any) {
    logger.error(error, "API error");
    return handleError(c, error, 'Failed to list employees');
  }
});

// POST /api/orgs/:orgSlug/employees - Hire a role (create employee)
orgEmployees.post('/api/orgs/:orgSlug/employees', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const body = await c.req.json();

    // Validate input
    if (!body || typeof body !== 'object') {
      return c.json(apiError('Request body must be an object', 400), 400);
    }

    const marketplaceRoleId = body.marketplaceRoleId || null;

    // Verify organization exists
    const org = await getOrganizationBySlugWithMatrix(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    // Verify marketplace role if provided
    let marketplaceRole: any = null;
    if (marketplaceRoleId) {
      marketplaceRole = await getRoleById(marketplaceRoleId);
      if (!marketplaceRole) {
        return c.json(apiError('Marketplace role not found', 404), 404);
      }
    }

    // Create employee
    const employee = await createEmployee(
      org.id,
      orgSlug,
      body.name || '',
      undefined,
      undefined,
      'latest',
      undefined,
      undefined,
      marketplaceRoleId || undefined,
      org.internalRoomId,
      org.matrixAdminAccessToken
    );

    // Start employee
    await startEmployee(employee.id);

    return c.json(apiSuccess({
      id: employee.id,
      name: body.name,
      roleSlug: employee.roleSlug,
      roleVersion: employee.roleVersion,
      marketplaceRoleId: marketplaceRoleId,
      mcpIds: [],
      skillIds: [],
      status: employee.status,
      port: employee.port,
      url: employee.url,
      password: employee.password,
      employeeDataPath: employee.employeeDataPath,
      createdAt: employee.createdAt.toISOString(),
    }), 201);
  } catch (error: any) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to create employee');
  }
});

// GET /api/orgs/:orgSlug/employees/:employeeId - Get employee details
orgEmployees.get('/api/orgs/:orgSlug/employees/:employeeId', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const employeeId = c.req.param('employeeId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const employee = getEmployee(employeeId);
    if (!employee || employee.organizationId !== org.id) {
      return c.json(apiError('Employee not found', 404), 404);
    }

    return c.json(apiSuccess({
      id: employee.id,
      roleSlug: employee.roleSlug,
      roleVersion: employee.roleVersion,
      status: employee.status,
      port: employee.port,
      url: employee.url,
      healthStatus: employee.healthStatus,
      employeeDataPath: employee.employeeDataPath,
      createdAt: employee.createdAt.toISOString(),
    }));
  } catch (error: any) {
    logger.error(error, "API error");
    return handleError(c, error, 'Failed to get employee');
  }
});

// POST /api/orgs/:orgSlug/employees/:employeeId/start - Start employee
orgEmployees.post('/api/orgs/:orgSlug/employees/:employeeId/start', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const employeeId = c.req.param('employeeId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const employee = getEmployee(employeeId);
    if (!employee || employee.organizationId !== org.id) {
      return c.json(apiError('Employee not found', 404), 404);
    }

    const result = await startEmployee(employeeId);

    return c.json(apiSuccess({
      id: result.id,
      status: result.status,
    }));
  } catch (error: any) {
    logger.error(error, "API error");
    return handleError(c, error, 'Failed to start employee');
  }
});

// POST /api/orgs/:orgSlug/employees/:employeeId/stop - Stop employee
orgEmployees.post('/api/orgs/:orgSlug/employees/:employeeId/stop', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const employeeId = c.req.param('employeeId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const employee = getEmployee(employeeId);
    if (!employee || employee.organizationId !== org.id) {
      return c.json(apiError('Employee not found', 404), 404);
    }

    const result = await stopEmployee(employeeId);

    return c.json(apiSuccess({
      id: result.id,
      status: result.status,
    }));
  } catch (error: any) {
    logger.error(error, "API error");
    return handleError(c, error, 'Failed to stop employee');
  }
});

// DELETE /api/orgs/:orgSlug/employees/:employeeId - Remove employee
orgEmployees.delete('/api/orgs/:orgSlug/employees/:employeeId', async (c) => {
  try {
    const orgSlug = c.req.param('orgSlug');
    const employeeId = c.req.param('employeeId');

    // Verify organization exists
    const org = await getOrganizationBySlug(orgSlug);
    if (!org) {
      return c.json(apiError('Organization not found', 404), 404);
    }

    const employee = getEmployee(employeeId);
    if (!employee || employee.organizationId !== org.id) {
      return c.json(apiError('Employee not found', 404), 404);
    }

    await removeEmployee(employeeId);

    return c.json(apiSuccess({ success: true }));
  } catch (error: any) {
    logger.error(error, "API error");
    return handleError(c, error, 'Failed to remove employee');
  }
});

// GET /api/employees/:id/agents-md - Get employee's AGENTS.md content
orgEmployees.get('/api/employees/:id/agents-md', async (c) => {
  try {
    const employeeId = c.req.param('id');

    const employee = getEmployee(employeeId);
    if (!employee) {
      return c.json(apiError('Employee not found', 404), 404);
    }

    const dataPath = (employee as any).employeeDataPath;
    if (!dataPath) {
      return c.json(apiError('Employee data path not found', 404), 404);
    }

    const agentsMdPath = path.join(dataPath, 'AGENTS.md');
    if (!fs.existsSync(agentsMdPath)) {
      return c.json({ success: true, content: '' });
    }

    const content = fs.readFileSync(agentsMdPath, 'utf-8');
    return c.json({ success: true, content });
  } catch (error: any) {
    logger.error(error, 'Failed to read AGENTS.md');
    return c.json(apiError('Failed to read AGENTS.md', 500), 500);
  }
});

export default orgEmployees;
