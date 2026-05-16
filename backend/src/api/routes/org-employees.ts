import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import { getOrganizationBySlug } from '../../services/org-service.js';
import { getRoleBySlug } from '../../services/role-service.js';
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
  return { success: false, error: message, status };
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
    return c.json(apiError(error.message || 'Failed to list employees', 500), 500);
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

    // Create employee
    const employee = await createEmployee(
      org.id,
      orgSlug,
      role.id,
      role.slug,
      undefined,
      undefined,
      body.roleVersion || 'latest',
      role.imageName
    );

    // Start employee
    await startEmployee(employee.id);

    return c.json(apiSuccess({
      id: employee.id,
      roleSlug: employee.roleSlug,
      roleVersion: employee.roleVersion,
      status: employee.status,
      port: employee.port,
      url: employee.url,
      password: employee.password,
      employeeDataPath: employee.employeeDataPath,
      createdAt: employee.createdAt.toISOString(),
    }), 201);
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to create employee', 500), 500);
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
    return c.json(apiError(error.message || 'Failed to get employee', 500), 500);
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
    return c.json(apiError(error.message || 'Failed to start employee', 500), 500);
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
    return c.json(apiError(error.message || 'Failed to stop employee', 500), 500);
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
    return c.json(apiError(error.message || 'Failed to remove employee', 500), 500);
  }
});

export default orgEmployees;
