import logger from '../lib/logger.js';
import Docker from 'dockerode';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { initDatabase, employees } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { initEmployeeData } from './config-manager.js';
import { getOrgAuthPath, getOrgPublicPath } from './org-service.js';
import { registerMatrixUserAdmin, generateMatrixPassword, inviteToRoom, joinRoom } from './matrix-service.js';

// Initialize Docker connection with explicit socket path
const docker = new Docker({ socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock' });

// Configuration
const MAX_CONTAINERS = 10;
const DEFAULT_START_PORT = 4096;
const CONTAINER_PREFIX = 'nexus';

// Host data path for volume mounts (when running in a container)
// Backend container mounts /opt/nexus/data -> /app/data
// Employee containers need host paths for mounts
const HOST_DATA_PATH = process.env.NEXUS_HOST_DATA_PATH || '/opt/nexus/data';
const CONTAINER_DATA_PATH = join(process.cwd(), 'data');

/**
 * Convert container-internal path to host path for volume mounts
 * When Backend runs in a container, paths like /app/data/employees/xxx
 * need to be converted to /opt/nexus/data/employees/xxx for employee containers
 */
function toHostPath(containerPath: string): string {
  if (containerPath.startsWith(CONTAINER_DATA_PATH)) {
    return containerPath.replace(CONTAINER_DATA_PATH, HOST_DATA_PATH);
  }
  return containerPath;
}

// Employee instance tracking
interface EmployeeInstance {
  id: string; // 员工 ID（数据库主键，也是 map key）
  containerId: string; // Docker 容器 ID
  organizationId: string;
  roleSlug: string;
  roleVersion: string;
  name: string; // 告工名称
  marketplaceRoleId?: string; // Marketplace role ID
  mcpIds?: string; // JSON array string
  skillIds?: string; // JSON array string
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
    // Docker connection failed - assume port is available since no containers can be using it
    logger.warn({ error, port }, 'Docker not reachable, assuming port available');
    return true;
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
  roleSlug: string,
  employeeId?: string,
  empSlug?: string,
  roleVersion: string = 'latest',
  imageName?: string,
  port?: number,
  marketplaceRoleId?: string,
  orgInternalRoomId?: string,
  orgMatrixAdminToken?: string
): Promise<EmployeeInstance> {
  await checkEmployeeLimit();

  // Query marketplace role if provided
  let marketplaceRole: any = null;
  let mcpIds: string[] = [];
  let skillIds: string[] = [];
  let agentsMd: string = '';

  if (marketplaceRoleId) {
    try {
      const { initDatabase } = await import('../db/index.js');
      const db = await initDatabase();
      const { marketplaceRoles } = await import('../db/index.js');
      const roleResult = await db.select().from(marketplaceRoles).where(eq(marketplaceRoles.id, marketplaceRoleId));
      if (roleResult.length > 0) {
        marketplaceRole = roleResult[0];
        // Parse config
        let config = marketplaceRole.config || {};
        if (typeof config === 'string') {
          try {
            config = JSON.parse(config);
          } catch {
            config = { mcpIds: [], skillIds: [], agentsMd: '' };
          }
        }
        mcpIds = config.mcpIds || [];
        skillIds = config.skillIds || [];
        agentsMd = config.agentsMd || '';
      }
    } catch (err) {
      logger.warn({ err, marketplaceRoleId }, 'Failed to fetch marketplace role');
    }
  }

  // Find available port if not provided
  const employeePort = port ?? (await findAvailablePort(DEFAULT_START_PORT));

  // Verify port is available
  if (!(await isPortAvailable(employeePort))) {
    throw new Error(`Port ${employeePort} is already in use`);
  }

  const containerId = generateEmployeeId();
  const password = generatePassword();
  // Sanitize container name: only [a-zA-Z0-9_.-] allowed
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase() || 'emp';
  const containerName = `${CONTAINER_PREFIX}-${sanitize(orgSlug)}-${sanitize(roleSlug)}-${containerId.slice(-8)}`;

  // Use base image (opencode-ai pre-installed)
  const image = imageName || 'nexus-base:latest';
  // Generate employee info if not provided
  const finalEmployeeId = employeeId || `emp_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const finalEmpSlug = empSlug || `${roleSlug}-${orgSlug}-${randomBytes(2).toString('hex')}`;

  // Initialize employee data directory
  const employeeDataPath = initEmployeeData(finalEmployeeId, finalEmpSlug, orgSlug);

  // Write AGENTS.md to employee data directory if marketplace role has agentsMd
  if (agentsMd && employeeDataPath) {
    const agentsMdPath = join(employeeDataPath, 'AGENTS.md');
    writeFileSync(agentsMdPath, agentsMd, 'utf-8');
    logger.info({ employeeId: finalEmployeeId, agentsMdPath }, 'AGENTS.md written to employee data directory');
  }

  // Register Matrix account for this employee
  let matrixAccount;
  let matrixPassword = '';
  try {
    // Generate unique Matrix username (role slug + timestamp to avoid conflicts)
    let matrixUsername: string;
    if (marketplaceRole && marketplaceRole.slug) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).slice(2, 6);
      matrixUsername = `${marketplaceRole.slug.toLowerCase()}-${timestamp}${random}`;
    } else {
      matrixUsername = `nexus-${orgSlug}-employee-${Date.now()}`;
    }
    matrixPassword = generateMatrixPassword();
    matrixAccount = await registerMatrixUserAdmin(
      matrixUsername,
      matrixPassword,
      `${finalEmpSlug} agent for ${orgSlug}`,
      false
    );
    logger.info({ matrixUserId: matrixAccount.userId, employeeId: finalEmployeeId }, 'Matrix account registered');

    // Invite and join employee to organization's internal room
    const internalRoomId = orgInternalRoomId;
    const orgAdminToken = orgMatrixAdminToken;
    if (internalRoomId && orgAdminToken) {
      try {
        // Invite employee to room
        await inviteToRoom(internalRoomId, matrixAccount.userId, orgAdminToken);
        logger.info({ roomId: internalRoomId, userId: matrixAccount.userId }, 'Invited employee to internal room');
        
        // Join room as employee
        await joinRoom(internalRoomId, matrixAccount.accessToken);
        logger.info({ roomId: internalRoomId, userId: matrixAccount.userId }, 'Employee joined internal room');
      } catch (roomError) {
        logger.error({ roomError, employeeId: finalEmployeeId }, 'Failed to add employee to internal room, continuing');
      }
    }
  } catch (matrixError) {
    logger.error({ matrixError, employeeId: finalEmployeeId }, 'Failed to register Matrix account');
    throw matrixError;
  }

  const instance: EmployeeInstance = {
    id: finalEmployeeId, // 员工 ID（map key）
    containerId: '', // Docker 容器 ID（稍后设置）
    organizationId,
    roleSlug,
    roleVersion,
    name: finalEmpSlug,
    marketplaceRoleId: marketplaceRoleId || undefined,
    mcpIds: mcpIds.length > 0 ? JSON.stringify(mcpIds) : undefined,
    skillIds: skillIds.length > 0 ? JSON.stringify(skillIds) : undefined,
    status: 'starting',
    port: employeePort,
    url: `http://localhost:${employeePort}`,
    password,
    employeeDataPath,
    healthStatus: 'unknown',
    createdAt: new Date(),
    matrixUserId: matrixAccount?.userId,
    matrixAccessToken: matrixAccount?.accessToken,
  };
  try {
    // Prepare volume mounts - employee data path maps directly to /workspace
    // Use host paths for mounts (Backend runs in container, employee containers run on host)
    const volumes = [
      `${toHostPath(employeeDataPath)}:/workspace:rw`,
    ];

    // Mount organization auth.json (required, read-only)
    const authPath = getOrgAuthPath(orgSlug);
    if (!existsSync(authPath)) {
      throw new Error(`Organization auth.json not found: ${orgSlug}. Please configure auth first.`);
    }
    volumes.push(`${toHostPath(authPath)}:/workspace/auth/auth.json:ro`);

    // Mount organization public directory (read-only)
    const orgPublicPath = getOrgPublicPath(orgSlug);
    if (existsSync(orgPublicPath)) {
      volumes.push(`${toHostPath(orgPublicPath)}:/workspace/org:ro`);
    }

    const envVars = [
      `OPENCODE_SERVER_PORT=4096`,
      'OPENCODE_SERVER_HOSTNAME=0.0.0.0',
      `OPENCODE_SERVER_PASSWORD=${password}`,
      `OPENCODE_PASSWORD=${password}`,  // Same password for client authentication
      `OPENCODE_AUTH_PATH=/workspace/auth/auth.json`,
      `EMPLOYEE_ID=${finalEmployeeId}`,
      `EMPLOYEE_SLUG=${finalEmpSlug}`,
    ];

    // Add Matrix config if account was created
    if (matrixAccount) {
      // Replace localhost with host.docker.internal for container access
      const matrixUrl = (process.env.MATRIX_HOMESERVER_URL || 'http://localhost:8008')
        .replace(/localhost/g, 'host.docker.internal');
      envVars.push(`MATRIX_HOMESERVER_URL=${matrixUrl}`);
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
    employeesMap.set(finalEmployeeId, instance);
    // Save employee to database
    try {
      const db = await initDatabase();
      await db.insert(employees).values({
        id: finalEmployeeId,
        slug: finalEmpSlug,
        name: finalEmpSlug,
        organizationId: organizationId,
        containerId: container.id,
        employeeDataPath: employeeDataPath,
        marketplaceRoleId: marketplaceRoleId || null,
        mcpIds: JSON.stringify(mcpIds),
        skillIds: JSON.stringify(skillIds),
        agentsContent: agentsMd || null,
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

    // Install MCPs and Skills from role config
    if (mcpIds.length > 0 || skillIds.length > 0 || agentsMd) {
      try {
        const { applyRoleConfig } = await import('./employee-config-service.js');
        await applyRoleConfig(finalEmployeeId, { mcpIds, skillIds, agentsMd });
        logger.info({ empId: finalEmployeeId, mcpCount: mcpIds.length, skillCount: skillIds.length }, 'Role config applied to employee');
      } catch (configError) {
        logger.error(configError, 'Failed to apply role config, employee created but config incomplete');
      }
    }

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
      await db.delete(employees).where(eq(employees.id, instance.id));
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
 * Get employee info by employee ID (map key)
 */
export function getEmployee(employeeId: string): EmployeeInstance | undefined {
  return employeesMap.get(employeeId);
}

/**
 * Get employee info by container ID
 */
export function getEmployeeByContainerId(containerId: string): EmployeeInstance | undefined {
  return Array.from(employeesMap.values()).find(e => e.containerId === containerId);
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
        
        // Restore to memory - use employeeId as map key
        const instance: EmployeeInstance = {
          id: record.id || '',
          containerId: record.containerId || '',
          organizationId: record.organizationId || '',
          roleSlug: '',
          roleVersion: '',
          name: record.name || record.slug || '',
          marketplaceRoleId: record.marketplaceRoleId || undefined,
          mcpIds: record.mcpIds || undefined,
          skillIds: record.skillIds || undefined,
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
        
        employeesMap.set(record.id, instance);
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
      await db.delete(employees).where(eq(employees.id, instance.id));
      
      // Create new employee with same config
      await createEmployee(
        org.id,
        orgSlug,
        instance.roleSlug,
        instance.id,
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
