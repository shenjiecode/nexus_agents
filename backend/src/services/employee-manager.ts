import logger from '../lib/logger.js';
import Docker from 'dockerode';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { initDatabase, employees } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { initEmployeeData } from './config-manager.js';
import { getOrgAuthPath, getOrgPublicPath } from './org-service.js';
import { registerMatrixUserAdmin, generateMatrixUsername, generateMatrixPassword } from './matrix-service.js';

// Get Docker socket path
function getDockerSocket(): string {
  if (process.env.DOCKER_HOST) {
    return process.env.DOCKER_HOST.replace('unix://', '');
  }
  return '/var/run/docker.sock';
}

const docker = new Docker({ socketPath: getDockerSocket() });

// Configuration
const MAX_CONTAINERS = 10;
const DEFAULT_START_PORT = 4096;
const CONTAINER_PREFIX = 'nexus';

// Employee instance tracking
interface EmployeeInstance {
  id: string;
  organizationId: string;
  roleId: string;
  roleSlug: string;
  roleVersion: string;
  employeeId: string;
  containerId: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  port: number;
  url: string;
  password: string;
  employeeDataPath: string;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck?: Date;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  errorMessage?: string;
  matrixUserId?: string;
  matrixAccessToken?: string;
}

// In-memory employee registry
const employeesMap = new Map<string, EmployeeInstance>();

/**
 * Generate a unique employee ID
 */
function generateEmployeeId(): string {
  return `employee_${randomBytes(8).toString('hex')}`;
}

/**
 * Generate a random password for OpenCode server
 */
function generatePassword(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Check if a port is available
 */
async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const allContainers = await docker.listContainers({ all: true });
    for (const container of allContainers) {
      if (container.Ports) {
        for (const portMapping of container.Ports) {
          if (portMapping.PublicPort === port) {
            return false;
          }
        }
      }
    }
    return true;
  } catch (error) {
    logger.error(error, 'Error checking port availability');
    return false;
  }
}

/**
 * Find an available port starting from the given port
 */
export async function findAvailablePort(start: number = DEFAULT_START_PORT): Promise<number> {
  let port = start;
  const maxPort = start + 1000;

  while (port < maxPort) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }

  throw new Error(`No available ports found in range ${start}-${maxPort}`);
}

/**
 * Check if we've reached the maximum number of containers
 */
async function checkEmployeeLimit(): Promise<void> {
  const runningEmployees = Array.from(employeesMap.values()).filter(
    (c) => c.status === 'running' || c.status === 'starting'
  );

  if (runningEmployees.length >= MAX_CONTAINERS) {
    throw new Error(`Maximum number of containers (${MAX_CONTAINERS}) reached`);
  }
}

/**
 * Create a new employee (container) for an organization
 */
export async function createEmployee(
  organizationId: string,
  orgSlug: string,
  roleId: string,
  roleSlug: string,
  employeeId?: string,
  empSlug?: string,
  roleVersion: string = 'latest',
  imageName?: string,
  port?: number
): Promise<EmployeeInstance> {
  await checkEmployeeLimit();

  // Find available port if not provided
  const employeePort = port ?? (await findAvailablePort(DEFAULT_START_PORT));

  // Verify port is available
  if (!(await isPortAvailable(employeePort))) {
    throw new Error(`Port ${employeePort} is already in use`);
  }

  const containerId = generateEmployeeId();
  const password = generatePassword();
  const containerName = `${CONTAINER_PREFIX}-${orgSlug}-${roleSlug}-${containerId.slice(-8)}`;

  // Determine image name
  const image = imageName || `localhost/nexus-role-${roleSlug}:${roleVersion}`;

  // Generate employee info if not provided
  const finalEmployeeId = employeeId || `emp_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const finalEmpSlug = empSlug || `${roleSlug}-${orgSlug}-${randomBytes(2).toString('hex')}`;

  // Initialize employee data directory
  const employeeDataPath = initEmployeeData(finalEmployeeId, finalEmpSlug, orgSlug);

  // Register Matrix account for this employee
  let matrixAccount;
  let matrixPassword = '';
  try {
    const matrixUsername = generateMatrixUsername(orgSlug, finalEmpSlug);
    matrixPassword = generateMatrixPassword();
    matrixAccount = await registerMatrixUserAdmin(
      matrixUsername,
      matrixPassword,
      `${finalEmpSlug} agent for ${orgSlug}`,
      false
    );
    logger.info({ matrixUserId: matrixAccount.userId, employeeId: finalEmployeeId }, 'Matrix account registered');
  } catch (matrixError) {
    logger.error({ matrixError, employeeId: finalEmployeeId }, 'Failed to register Matrix account');
  }

  const instance: EmployeeInstance = {
    id: containerId,
    organizationId,
    roleId,
    roleSlug,
    roleVersion,
    employeeId: finalEmployeeId,
    containerId: '',
    status: 'starting',
    port: employeePort,
    url: `http://localhost:${employeePort}`,
    password,
    employeeDataPath,
    healthStatus: 'unknown',
    createdAt: new Date(),
  };

  try {
    // Prepare volume mounts
    const volumes = [
      `${employeeDataPath}:/workspace/emp:rw`,
    ];

    // Mount organization auth.json (required, read-only)
    const authPath = getOrgAuthPath(orgSlug);
    if (!existsSync(authPath)) {
      throw new Error(`Organization auth.json not found: ${orgSlug}. Please configure auth first.`);
    }
    volumes.push(`${authPath}:/workspace/auth/auth.json:ro`);

    // Mount organization public directory (read-only)
    const orgPublicPath = getOrgPublicPath(orgSlug);
    if (existsSync(orgPublicPath)) {
      volumes.push(`${orgPublicPath}:/workspace/org:ro`);
    }

    // Prepare environment variables
    const envVars = [
      `OPENCODE_SERVER_PORT=4096`,
      'OPENCODE_SERVER_HOSTNAME=0.0.0.0',
      `OPENCODE_SERVER_PASSWORD=${password}`,
      `OPENCODE_AUTH_PATH=/workspace/auth/auth.json`,
      `EMPLOYEE_ID=${finalEmployeeId}`,
      `EMPLOYEE_SLUG=${finalEmpSlug}`,
    ];

    // Add Matrix config if account was created
    if (matrixAccount) {
      envVars.push(`MATRIX_HOMESERVER_URL=${process.env.MATRIX_HOMESERVER_URL || 'http://localhost:8008'}`);
      envVars.push(`MATRIX_ACCESS_TOKEN=${matrixAccount.accessToken}`);
      envVars.push(`MATRIX_USER_ID=${matrixAccount.userId}`);
    }

    // Create container
    const container = await docker.createContainer({
      Image: image,
      name: containerName,
      Env: envVars,
      ExposedPorts: {
        '4096/tcp': {},
      },
      HostConfig: {
        PortBindings: {
          '4096/tcp': [{ HostPort: employeePort.toString() }],
        },
        Binds: volumes,
        RestartPolicy: {
          Name: 'unless-stopped',
        },
        AutoRemove: false,
      },
      Labels: {
        'nexus.org.id': organizationId,
        'nexus.role.id': roleId,
        'nexus.role.slug': roleSlug,
        'nexus.role.version': roleVersion,
        'nexus.container.id': containerId,
        'nexus.employee.id': finalEmployeeId,
        'nexus.employee.slug': finalEmpSlug,
        'nexus.managed': 'true',
        'nexus.org.auth': existsSync(authPath) ? 'true' : 'false',
      },
    });

    instance.containerId = container.id;
    employeesMap.set(containerId, instance);

    // Save employee to database
    try {
      const db = await initDatabase();
      await db.insert(employees).values({
        id: finalEmployeeId,
        slug: finalEmpSlug,
        name: finalEmpSlug,
        roleId: roleId,
        organizationId: organizationId,
        containerId: containerId,
        employeeDataPath: employeeDataPath,
        matrixUserId: matrixAccount?.userId,
        matrixAccessToken: matrixAccount?.accessToken,
        matrixDeviceId: matrixAccount?.deviceId,
        matrixPassword: matrixPassword,
        matrixHomeserverUrl: process.env.MATRIX_HOMESERVER_URL || 'http://localhost:8008',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (dbError) {
      logger.error(dbError, 'Failed to save employee to database');
    }

    // Add Matrix info to instance
    instance.matrixUserId = matrixAccount?.userId;
    instance.matrixAccessToken = matrixAccount?.accessToken;

    return instance;
  } catch (error) {
    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
}

/**
 * Start an employee (container)
 */
export async function startEmployee(employeeId: string): Promise<EmployeeInstance> {
  const instance = employeesMap.get(employeeId);
  if (!instance) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  if (instance.status === 'running') {
    return instance;
  }

  try {
    const container = docker.getContainer(instance.containerId);
    await container.start();

    instance.status = 'running';
    instance.startedAt = new Date();
    instance.errorMessage = undefined;

    // Update database status
    try {
      const db = await initDatabase();
      await db.update(employees).set({
        updatedAt: Date.now(),
      }).where(eq(employees.id, employeeId));
    } catch (dbError) {
      logger.error(dbError, 'Failed to update employee status in database');
    }

    return instance;
  } catch (error) {
    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Failed to start employee';
    throw error;
  }
}

/**
 * Stop an employee (container)
 */
export async function stopEmployee(
  employeeId: string,
  timeout: number = 30
): Promise<EmployeeInstance> {
  const instance = employeesMap.get(employeeId);
  if (!instance) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  if (instance.status === 'stopped') {
    return instance;
  }

  try {
    const container = docker.getContainer(instance.containerId);
    instance.status = 'stopping';

    await container.stop({ t: timeout });

    instance.status = 'stopped';
    instance.stoppedAt = new Date();
    instance.healthStatus = 'unknown';

    // Update database status
    try {
      const db = await initDatabase();
      await db.update(employees).set({
        updatedAt: Date.now(),
      }).where(eq(employees.id, employeeId));
    } catch (dbError) {
      logger.error(dbError, 'Failed to update employee status in database');
    }

    return instance;
  } catch (error) {
    if (error instanceof Error && error.message.includes('is already stopped')) {
      instance.status = 'stopped';
      instance.stoppedAt = new Date();
      return instance;
    }

    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Failed to stop employee';
    throw error;
  }
}

/**
 * Restart an employee (container)
 */
export async function restartEmployee(employeeId: string): Promise<EmployeeInstance> {
  const instance = employeesMap.get(employeeId);
  if (!instance) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  try {
    if (instance.status === 'running') {
      await stopEmployee(employeeId);
    }

    return await startEmployee(employeeId);
  } catch (error) {
    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Failed to restart employee';
    throw error;
  }
}

/**
 * Remove an employee (container)
 */
export async function removeEmployee(employeeId: string, force: boolean = false): Promise<void> {
  const instance = employeesMap.get(employeeId);
  if (!instance) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  try {
    const container = docker.getContainer(instance.containerId);

    if (instance.status === 'running' && !force) {
      await stopEmployee(employeeId);
    }

    await container.remove({ force });
    employeesMap.delete(employeeId);

    // Delete from database
    try {
      const db = await initDatabase();
      await db.delete(employees).where(eq(employees.id, instance.employeeId));
    } catch (dbError) {
      logger.error(dbError, 'Failed to delete employee from database');
    }
  } catch (error) {
    if (error instanceof Error && !error.message.includes('No such container')) {
      throw error;
    }
    employeesMap.delete(employeeId);
  }
}

/**
 * Check employee (container) health
 */
export async function healthCheck(containerUrl: string, password?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (password) {
      headers['Authorization'] = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
    }
    const response = await fetch(`${containerUrl}/global/health`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitForHealthy(
  containerUrl: string,
  password?: string,
  timeout: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  const interval = 1000;

  while (Date.now() - startTime < timeout) {
    if (await healthCheck(containerUrl, password)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

export async function updateHealthStatus(employeeId: string): Promise<void> {
  const instance = employeesMap.get(employeeId);
  if (!instance || instance.status !== 'running') {
    return;
  }

  // Layer 1: Check Docker container status
  try {
    const container = docker.getContainer(instance.containerId);
    const info = await container.inspect();
    if (!info.State.Running) {
      instance.healthStatus = 'unhealthy';
      instance.lastHealthCheck = new Date();
      return;
    }
  } catch {
    instance.healthStatus = 'unknown';
    instance.lastHealthCheck = new Date();
    return;
  }

  // Layer 2: Check OpenCode serve health endpoint (if password available)
  if (instance.password) {
    const isHealthy = await healthCheck(instance.url, instance.password);
    instance.healthStatus = isHealthy ? 'healthy' : 'unhealthy';
  } else {
    instance.healthStatus = 'healthy';
  }
  instance.lastHealthCheck = new Date();
}

/**
 * Get employee info
 */
export function getEmployee(employeeId: string): EmployeeInstance | undefined {
  return employeesMap.get(employeeId);
}

/**
 * Get all employees
 */
export function getAllEmployees(): EmployeeInstance[] {
  return Array.from(employeesMap.values());
}

/**
 * Get employees by organization ID
 */
export function getEmployeesByOrganization(organizationId: string): EmployeeInstance[] {
  return Array.from(employeesMap.values()).filter((c) => c.organizationId === organizationId);
}

/**
 * Get employee count
 */
export function getEmployeeCount(): number {
  return employeesMap.size;
}

/**
 * Get running employee count
 */
export function getRunningEmployeeCount(): number {
  return Array.from(employeesMap.values()).filter((c) => c.status === 'running').length;
}

/**
 * Restore employees from database on startup
 */
export async function restoreEmployees(): Promise<number> {
  const db = await initDatabase();
  const savedEmployees = await db.select().from(employees);

  let restored = 0;
  for (const record of savedEmployees) {
    if (record.containerId) {
      try {
        const container = docker.getContainer(record.containerId);
        const info = await container.inspect();
        
        // Restore to memory
        const instance: EmployeeInstance = {
          id: record.containerId || '',
          organizationId: record.organizationId || '',
          roleId: record.roleId || '',
          roleSlug: '',
          roleVersion: '',
          employeeId: record.id || '',
          containerId: record.containerId || '',
          status: info.State.Running ? 'running' : 'stopped',
          port: 0,
          url: '',
          password: '',
          employeeDataPath: record.employeeDataPath || '',
          healthStatus: 'unknown',
          createdAt: new Date(record.createdAt),
          matrixUserId: record.matrixUserId || undefined,
          matrixAccessToken: record.matrixAccessToken || undefined,
        };
        
        employeesMap.set(record.containerId, instance);
        restored++;
      } catch (error) {
        logger.error(error, `Failed to restore employee ${record.id}:`);
      }
    }
  }

  return restored;
}

/**
 * Rebuild all employees for an organization (used when auth config changes)
 */
export async function rebuildEmployeesForOrg(orgSlug: string): Promise<{ rebuilt: number; errors: string[] }> {
  const db = await initDatabase();
  const errors: string[] = [];
  let rebuilt = 0;
  
  // Get organization ID from slug
  const { getOrganizationBySlug } = await import('./org-service.js');
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) {
    throw new Error(`Organization '${orgSlug}' not found`);
  }
  
  // Get all employees for this org
  const orgEmployees = Array.from(employeesMap.values()).filter(
    (c) => c.organizationId === org.id
  );
  
  if (orgEmployees.length === 0) {
    return { rebuilt: 0, errors: [] };
  }
  
  logger.info({ orgSlug, count: orgEmployees.length }, 'Rebuilding employees for organization');
  
  for (const instance of orgEmployees) {
    try {
      // Store employee config before removal
      const employeeConfig = {
        roleSlug: instance.roleSlug,
        roleVersion: instance.roleVersion,
        roleId: instance.roleId,
      };
      
      // Stop and remove the container
      const container = docker.getContainer(instance.containerId);
      try {
        await container.stop({ t: 5 });
      } catch (e) {
        // Container might already be stopped
      }
      await container.remove({ force: true });
      
      // Remove from memory
      employeesMap.delete(instance.id);
      
      // Delete from database
      await db.delete(employees).where(eq(employees.id, instance.employeeId));
      
      // Create new employee with same config
      await createEmployee(
        org.id,
        orgSlug,
        instance.roleId,
        instance.roleSlug,
        instance.employeeId,
        instance.roleSlug + '-' + orgSlug.slice(-4),
        instance.roleVersion
      );
      
      rebuilt++;
      logger.info({ employeeId: instance.id, roleSlug: employeeConfig.roleSlug }, 'Employee rebuilt');
    } catch (error: any) {
      errors.push(`Failed to rebuild ${instance.roleSlug}: ${error.message}`);
      logger.error(error, `Failed to rebuild employee ${instance.id}`);
    }
  }
  
  logger.info({ orgSlug, rebuilt, errors: errors.length }, 'Finished rebuilding employees');
  return { rebuilt, errors };
}

// Export types
export type { EmployeeInstance };

/**
 * Get employee config (opencode.json)
 */
export function getEmployeeConfig(employeeId: string): Record<string, unknown> | null {
  const instance = employeesMap.get(employeeId);
  if (!instance) return null;
  
  try {
    const configPath = join(process.cwd(), 'roles', instance.roleSlug, 'opencode.json');
    if (!existsSync(configPath)) return null;
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Update employee model (write to opencode.json)
 */
export function updateEmployeeModel(employeeId: string, model: string): void {
  const instance = employeesMap.get(employeeId);
  if (!instance) {
    throw new Error(`Employee ${employeeId} not found`);
  }
  
  const configPath = join(process.cwd(), 'roles', instance.roleSlug, 'opencode.json');
  
  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf-8');
    config = JSON.parse(content);
  }
  
  config.model = model;
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  logger.info({ employeeId, model, roleSlug: instance.roleSlug }, 'Employee model updated');
}
