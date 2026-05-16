import { Hono } from 'hono';
import logger from '../../lib/logger.js';
import {
  getAllEmployees,
  getEmployee,
  removeEmployee,
  getEmployeeConfig,
  updateEmployeeModel,
  updateHealthStatus,
} from '../../services/employee-manager.js';

// Standard API response helper
function apiSuccess<T>(data: T) {
  return { success: true, data };
}

function apiError(message: string, status = 400) {
  return { success: false, error: message, status };
}

// Create global employees router
const employees = new Hono();

// GET /api/employees - List all employees across all organizations
employees.get('/api/employees', async (c) => {
  try {
    const allEmployees = getAllEmployees();

    return c.json(apiSuccess(allEmployees.map((employee) => ({
      id: employee.id,
      organizationId: employee.organizationId,
      roleSlug: employee.roleSlug,
      roleVersion: employee.roleVersion,
      status: employee.status,
      port: employee.port,
      url: employee.url,
      healthStatus: employee.healthStatus,
      employeeDataPath: employee.employeeDataPath,
      createdAt: employee.createdAt.toISOString(),
    }))));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to list employees', 500), 500);
  }
});

// GET /api/employees/:id - Get single employee by ID
employees.get('/api/employees/:id', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const employee = getEmployee(employeeId);

    if (!employee) {
      return c.json(apiError('Employee not found', 404), 404);
    }

    return c.json(apiSuccess({
      id: employee.id,
      organizationId: employee.organizationId,
      roleId: employee.roleId,
      roleSlug: employee.roleSlug,
      roleVersion: employee.roleVersion,
      status: employee.status,
      port: employee.port,
      url: employee.url,
      healthStatus: employee.healthStatus,
      employeeDataPath: employee.employeeDataPath,
      createdAt: employee.createdAt.toISOString(),
      startedAt: employee.startedAt?.toISOString(),
      stoppedAt: employee.stoppedAt?.toISOString(),
      errorMessage: employee.errorMessage,
    }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to get employee', 500), 500);
  }
});

// POST /api/employees/:id/health-check - Trigger health check
employees.post('/api/employees/:id/health-check', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const employee = getEmployee(employeeId);

    if (!employee) {
      return c.json(apiError('Employee not found', 404), 404);
    }

    await updateHealthStatus(employeeId);
    const updatedEmployee = getEmployee(employeeId);

    return c.json(apiSuccess({
      healthStatus: updatedEmployee?.healthStatus,
    }));
  } catch (error: any) {
    logger.error(error, 'API error');
    return c.json(apiError(error.message || 'Failed to check health', 500), 500);
  }
});

// DELETE /api/employees/:id - Delete employee by ID
employees.delete('/api/employees/:id', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const employee = getEmployee(employeeId);

    if (!employee) {
      return c.json(apiError('Employee not found', 404), 404);
    }

    await removeEmployee(employeeId, true);

    return c.json(apiSuccess({ success: true }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to delete employee', 500), 500);
  }
});

// GET /api/employees/:id/config - Get employee config
employees.get('/api/employees/:id/config', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const config = getEmployeeConfig(employeeId);
    if (!config) {
      return c.json(apiError('Employee config not found', 404), 404);
    }
    return c.json(apiSuccess(config));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to get employee config', 500), 500);
  }
});

// PUT /api/employees/:id/model - Update employee model
employees.put('/api/employees/:id/model', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const body = await c.req.json();
    const model = body.model;
    
    if (!model || typeof model !== 'string') {
      return c.json(apiError('Missing or invalid model field', 400), 400);
    }
    
    updateEmployeeModel(employeeId, model);
    return c.json(apiSuccess({ model }));
  } catch (error: any) {
    logger.error(error, "API error");
    return c.json(apiError(error.message || 'Failed to update model', 500), 500);
  }
});

export default employees;
