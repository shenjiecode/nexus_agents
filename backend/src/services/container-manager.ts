import logger from '../lib/logger.js';
import Docker from 'dockerode';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { containers as containersTable, initDatabase } from '../db/index.js';
import { initContainerMemory } from './config-manager.js';
import { getOrgAuthPath } from './org-service.js';

// Auto-detect Docker/Podman socket
function getDockerSocket(): string {
  if (process.env.DOCKER_HOST) {
    return process.env.DOCKER_HOST.replace('unix://', '');
  }
  // Try common socket paths in order
  const socketPaths = [
    '/run/user/1000/podman/podman.sock',
    '/var/run/docker.sock',
  ];
  for (const path of socketPaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  // Default fallback
  return '/var/run/docker.sock';
}

const docker = new Docker({ socketPath: getDockerSocket() });

// Configuration
const MAX_CONTAINERS = 10;
const DEFAULT_START_PORT = 4096;
const CONTAINER_PREFIX = 'nexus';

// Container instance tracking
interface ContainerInstance {
  id: string;
  organizationId: string;
  roleId: string;
  roleSlug: string;
  roleVersion: string;
  containerId: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  port: number;
  url: string;
  password: string;
  memoryPath: string;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck?: Date;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  errorMessage?: string;
}

// In-memory container registry
const containers = new Map<string, ContainerInstance>();

/**
 * Generate a unique container ID
 */
function generateContainerId(): string {
  return `container_${randomBytes(8).toString('hex')}`;
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
async function checkContainerLimit(): Promise<void> {
  const runningContainers = Array.from(containers.values()).filter(
    (c) => c.status === 'running' || c.status === 'starting'
  );

  if (runningContainers.length >= MAX_CONTAINERS) {
    throw new Error(`Maximum number of containers (${MAX_CONTAINERS}) reached`);
  }
}

/**
 * Create a new container for an organization (hire a role)
 */
export async function createContainer(
  organizationId: string,
  orgSlug: string,
  roleId: string,
  roleSlug: string,
  roleVersion: string = 'latest',
  imageName?: string,
  port?: number
): Promise<ContainerInstance> {
  await checkContainerLimit();

  // Find available port if not provided
  const containerPort = port ?? (await findAvailablePort(DEFAULT_START_PORT));

  // Verify port is available
  if (!(await isPortAvailable(containerPort))) {
    throw new Error(`Port ${containerPort} is already in use`);
  }

  const containerId = generateContainerId();
  const password = generatePassword();
  const containerName = `${CONTAINER_PREFIX}-${orgSlug}-${roleSlug}-${containerId.slice(-8)}`;

  // Determine image name
  const image = imageName || `localhost/nexus-role-${roleSlug}:${roleVersion}`;

  // Initialize container memory directory
  const memoryPath = initContainerMemory(orgSlug, containerId);

  const instance: ContainerInstance = {
    id: containerId,
    organizationId,
    roleId,
    roleSlug,
    roleVersion,
    containerId: '',
    status: 'starting',
    port: containerPort,
    url: `http://localhost:${containerPort}`,
    password,
    memoryPath,
    healthStatus: 'unknown',
    createdAt: new Date(),
  };

  try {
    // Prepare volume mounts
    const volumes = [
      // Mount memory directory (read-write)
      `${memoryPath}/AGENTS.md:/workspace/AGENTS.md:rw`,
      `${memoryPath}/memory:/workspace/memory:rw`,
      `${memoryPath}/docs:/workspace/docs:rw`,
    ];

    // Mount organization auth.json if configured
    const authPath = getOrgAuthPath(orgSlug);
    const containerAuthPath = '/app/.opencode/auth.json';
    
    if (existsSync(authPath)) {
      volumes.push(`${authPath}:${containerAuthPath}:ro`);
    }

    // Prepare environment variables
    const envVars = [
      `OPENCODE_SERVER_PORT=4096`,
      'OPENCODE_SERVER_HOSTNAME=0.0.0.0',
      `OPENCODE_SERVER_PASSWORD=${password}`,
    ];
    
    // Set auth path if auth.json is mounted
    if (existsSync(authPath)) {
      envVars.push(`OPENCODE_AUTH_PATH=${containerAuthPath}`);
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
          '4096/tcp': [{ HostPort: containerPort.toString() }],
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
        'nexus.managed': 'true',
        'nexus.org.auth': existsSync(authPath) ? 'true' : 'false',
      },
    });

    instance.containerId = container.id;
    containers.set(containerId, instance);

    // Save to database
    try {
      const db = await initDatabase();
      await db.insert(containersTable).values({
        id: containerId,
        organizationId: organizationId,
        roleId: roleId,
        roleVersion: roleVersion,
        containerId: container.id,
        port: containerPort,
        status: 'running',
        healthStatus: 'unknown',
        memoryPath: memoryPath,
        createdAt: Date.now(),
      });
    } catch (dbError) {
      logger.error(dbError, 'Failed to save container to database');
    }

    return instance;
  } catch (error) {
    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
}

/**
 * Start a container
 */
export async function startContainer(containerId: string): Promise<ContainerInstance> {
  const instance = containers.get(containerId);
  if (!instance) {
    throw new Error(`Container ${containerId} not found`);
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

    return instance;
  } catch (error) {
    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Failed to start container';
    throw error;
  }
}

/**
 * Stop a container
 */
export async function stopContainer(
  containerId: string,
  timeout: number = 30
): Promise<ContainerInstance> {
  const instance = containers.get(containerId);
  if (!instance) {
    throw new Error(`Container ${containerId} not found`);
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

    return instance;
  } catch (error) {
    if (error instanceof Error && error.message.includes('is already stopped')) {
      instance.status = 'stopped';
      instance.stoppedAt = new Date();
      return instance;
    }

    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Failed to stop container';
    throw error;
  }
}

/**
 * Restart a container
 */
export async function restartContainer(containerId: string): Promise<ContainerInstance> {
  const instance = containers.get(containerId);
  if (!instance) {
    throw new Error(`Container ${containerId} not found`);
  }

  try {
    if (instance.status === 'running') {
      await stopContainer(containerId);
    }

    return await startContainer(containerId);
  } catch (error) {
    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Failed to restart container';
    throw error;
  }
}

/**
 * Remove a container
 */
export async function removeContainer(containerId: string, force: boolean = false): Promise<void> {
  const instance = containers.get(containerId);
  if (!instance) {
    throw new Error(`Container ${containerId} not found`);
  }

  try {
    const container = docker.getContainer(instance.containerId);

    if (instance.status === 'running' && !force) {
      await stopContainer(containerId);
    }

    await container.remove({ force });
    containers.delete(containerId);
  } catch (error) {
    if (error instanceof Error && !error.message.includes('No such container')) {
      throw error;
    }
    containers.delete(containerId);
  }
}

/**
 * Check container health
 */
export async function healthCheck(containerUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${containerUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for container to become healthy
 */
export async function waitForHealthy(
  containerUrl: string,
  timeout: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  const interval = 1000;

  while (Date.now() - startTime < timeout) {
    if (await healthCheck(containerUrl)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Update container health status
 */
export async function updateHealthStatus(containerId: string): Promise<void> {
  const instance = containers.get(containerId);
  if (!instance || instance.status !== 'running') {
    return;
  }

  const isHealthy = await healthCheck(instance.url);
  instance.healthStatus = isHealthy ? 'healthy' : 'unhealthy';
  instance.lastHealthCheck = new Date();
}

/**
 * Get container info
 */
export function getContainer(containerId: string): ContainerInstance | undefined {
  return containers.get(containerId);
}

/**
 * Get all containers
 */
export function getAllContainers(): ContainerInstance[] {
  return Array.from(containers.values());
}

/**
 * Get containers by organization ID
 */
export function getContainersByOrganization(organizationId: string): ContainerInstance[] {
  return Array.from(containers.values()).filter((c) => c.organizationId === organizationId);
}

/**
 * Get container count
 */
export function getContainerCount(): number {
  return containers.size;
}

/**
 * Get running container count
 */
export function getRunningContainerCount(): number {
  return Array.from(containers.values()).filter((c) => c.status === 'running').length;
}

/**
 * Restore containers from database on startup
 */
export async function restoreContainers(): Promise<number> {
  const db = await initDatabase();
  const savedContainers = await db.select().from(containersTable);

  let restored = 0;
  for (const record of savedContainers) {
    if (record.status === 'running') {
      try {
        const container = docker.getContainer(record.containerId);
        const info = await container.inspect();
        
        // Restore to memory
        const instance: ContainerInstance = {
          id: record.id,
          organizationId: record.organizationId,
          roleId: record.roleId,
          roleSlug: info.Config.Labels?.['nexus.role.slug'] || '',
          roleVersion: record.roleVersion,
          containerId: record.containerId,
          status: info.State.Running ? 'running' : 'stopped',
          port: record.port,
          url: `http://localhost:${record.port}`,
          password: '', // Password not stored, need to regenerate or store securely
          memoryPath: record.memoryPath || '',
          healthStatus: 'unknown',
          createdAt: new Date(record.createdAt),
        };
        
        containers.set(record.id, instance);
        restored++;
      } catch (error) {
        logger.error(error, `Failed to restore container ${record.id}:`);
      }
    }
  }

  return restored;
}

// Export types
export type { ContainerInstance };