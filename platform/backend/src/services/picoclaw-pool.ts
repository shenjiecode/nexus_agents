import logger from '../lib/logger.js';
import Docker from 'dockerode';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Initialize Docker connection
const docker = new Docker({ socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock' });

// Configuration
const MAX_CONTAINERS = 20;
const DEFAULT_START_PORT = 4100;
const CONTAINER_PREFIX = 'picoclaw';

// Data paths
const DATA_BASE_PATH = join(process.cwd(), 'data', 'picoclaw');
const HOST_DATA_PATH = process.env.NEXUS_HOST_DATA_PATH || '/opt/nexus/data';
const CONTAINER_DATA_PATH = join(process.cwd(), 'data');

// Valid variants
const VALID_VARIANTS = ['base', 'full', 'heavy'] as const;
export type PicoClawVariant = typeof VALID_VARIANTS[number];

// Container state
export interface PicoClawInstance {
  workspaceId: string;
  userId: string;
  containerId: string;
  variant: PicoClawVariant;
  port: number;
  url: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  errorMessage?: string;
}

// In-memory registry
const instancesMap = new Map<string, PicoClawInstance>();

/**
 * Convert container path to host path for volume mounts
 */
function toHostPath(containerPath: string): string {
  if (containerPath.startsWith(CONTAINER_DATA_PATH)) {
    return containerPath.replace(CONTAINER_DATA_PATH, HOST_DATA_PATH);
  }
  return containerPath;
}

/**
 * Get user data directory path
 */
function getUserDataPath(userId: string): string {
  const userPath = join(DATA_BASE_PATH, userId);
  if (!existsSync(userPath)) {
    mkdirSync(userPath, { recursive: true });
  }
  return userPath;
}

/**
 * Get workspace config file path
 */
function getWorkspaceConfigPath(userId: string, workspaceId: string): string {
  return join(getUserDataPath(userId), `${workspaceId}.json`);
}

/**
 * Save workspace config
 */
function saveWorkspaceConfig(instance: PicoClawInstance): void {
  const config = {
    workspaceId: instance.workspaceId,
    userId: instance.userId,
    variant: instance.variant,
    port: instance.port,
    containerId: instance.containerId,
    createdAt: instance.createdAt.toISOString(),
  };
  const configPath = getWorkspaceConfigPath(instance.userId, instance.workspaceId);
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  logger.info({ workspaceId: instance.workspaceId, userId: instance.userId }, 'Workspace config saved');
}

/**
 * Load workspace config
 */
function loadWorkspaceConfig(userId: string, workspaceId: string): PicoClawInstance | null {
  const configPath = getWorkspaceConfigPath(userId, workspaceId);
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    return {
      ...config,
      createdAt: new Date(config.createdAt),
      status: 'stopped',
    };
  } catch (error) {
    logger.error({ error, configPath }, 'Failed to load workspace config');
    return null;
  }
}

/**
 * Check if port is available
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
    logger.warn({ error, port }, 'Docker not reachable, assuming port available');
    return true;
  }
}

/**
 * Find an available port starting from DEFAULT_START_PORT
 */
async function findAvailablePort(start: number = DEFAULT_START_PORT): Promise<number> {
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
 * Generate a unique workspace ID
 */
function generateWorkspaceId(): string {
  return `picoclaw_${randomBytes(8).toString('hex')}`;
}

/**
 * Allocate a new PicoClaw container for a user
 */
export async function allocate(
  userId: string,
  variant: PicoClawVariant
): Promise<PicoClawInstance> {
  // Validate variant
  if (!VALID_VARIANTS.includes(variant)) {
    throw new Error(`Invalid variant: ${variant}. Valid variants: ${VALID_VARIANTS.join(', ')}`);
  }

  // Check container limit
  const runningCount = Array.from(instancesMap.values()).filter(
    (c) => c.status === 'running' || c.status === 'starting'
  ).length;

  if (runningCount >= MAX_CONTAINERS) {
    throw new Error(`Maximum number of PicoClaw containers (${MAX_CONTAINERS}) reached`);
  }

  // Find available port
  const port = await findAvailablePort(DEFAULT_START_PORT);

  // Verify port is available
  if (!(await isPortAvailable(port))) {
    throw new Error(`Port ${port} is already in use`);
  }

  const workspaceId = generateWorkspaceId();
  const imageName = `sipeed/picoclaw:${variant}`;
  const containerName = `${CONTAINER_PREFIX}-${userId}-${workspaceId.slice(-8)}`;

  logger.info({ userId, variant, port, workspaceId }, 'Allocating PicoClaw container');

  const instance: PicoClawInstance = {
    workspaceId,
    userId,
    containerId: '',
    variant,
    port,
    url: `http://localhost:${port}`,
    status: 'starting',
    createdAt: new Date(),
  };

  try {
    // Initialize user data directory
    const userDataPath = getUserDataPath(userId);
    const workspacePath = join(userDataPath, workspaceId);
    mkdirSync(workspacePath, { recursive: true });

    // Create container
    const container = await docker.createContainer({
      Image: imageName,
      name: containerName,
      ExposedPorts: {
        '22/tcp': {},
        '8080/tcp': {},
      },
      Env: [
        `PIKOCLAW_MODE=${variant}`,
        `WORKSPACE_ID=${workspaceId}`,
        `USER_ID=${userId}`,
      ],
      HostConfig: {
        PortBindings: {
          '22/tcp': [{ HostPort: (port + 1000).toString() }],
          '8080/tcp': [{ HostPort: port.toString() }],
        },
        Binds: [
          `${toHostPath(workspacePath)}:/workspace:rw`,
        ],
        RestartPolicy: {
          Name: 'unless-stopped',
        },
        AutoRemove: false,
      },
      Labels: {
        'nexus.picoclaw': 'true',
        'nexus.picoclaw.workspace': workspaceId,
        'nexus.picoclaw.user': userId,
        'nexus.picoclaw.variant': variant,
        'nexus.managed': 'true',
      },
    });

    instance.containerId = container.id;

    // Start container
    await container.start();

    instance.status = 'running';
    instance.startedAt = new Date();

    // Save config
    saveWorkspaceConfig(instance);

    // Register in memory
    instancesMap.set(workspaceId, instance);

    logger.info({ workspaceId, containerId: container.id, port }, 'PicoClaw container allocated');

    return instance;
  } catch (error) {
    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, userId, variant }, 'Failed to allocate PicoClaw container');
    throw error;
  }
}

/**
 * Release (stop and remove) a PicoClaw container by workspace ID
 */
export async function release(workspaceId: string): Promise<void> {
  const instance = instancesMap.get(workspaceId);

  if (!instance) {
    // Try to load from config
    const saved = await restoreWorkspace(workspaceId);
    if (!saved) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }
    await release(workspaceId);
    return;
  }

  logger.info({ workspaceId, containerId: instance.containerId }, 'Releasing PicoClaw container');

  try {
    const container = docker.getContainer(instance.containerId);

    instance.status = 'stopping';

    try {
      await container.stop({ t: 10 });
    } catch (stopError) {
      // Container might already be stopped
      if (stopError instanceof Error && !stopError.message.includes('already stopped')) {
        logger.warn({ stopError, workspaceId }, 'Error stopping container, continuing with remove');
      }
    }

    await container.remove({ force: true });

    instance.status = 'stopped';
    instance.stoppedAt = new Date();

    // Remove from memory
    instancesMap.delete(workspaceId);

    // Remove config file
    const configPath = getWorkspaceConfigPath(instance.userId, workspaceId);
    try {
      const { unlinkSync } = await import('fs');
      unlinkSync(configPath);
      logger.info({ workspaceId }, 'Workspace config removed');
    } catch {
      // Config might not exist
    }

    logger.info({ workspaceId }, 'PicoClaw container released');
  } catch (error) {
    if (error instanceof Error && error.message.includes('No such container')) {
      instancesMap.delete(workspaceId);
      return;
    }
    instance.status = 'error';
    instance.errorMessage = error instanceof Error ? error.message : 'Failed to release';
    throw error;
  }
}

/**
 * Get the status of a PicoClaw container
 */
export async function getStatus(workspaceId: string): Promise<PicoClawInstance | null> {
  let instance = instancesMap.get(workspaceId);

  if (!instance) {
    // Try to restore from config
    const saved = await restoreWorkspace(workspaceId);
    if (!saved) {
      return null;
    }
    instance = instancesMap.get(workspaceId);
  }

  if (!instance) {
    return null;
  }

  try {
    const container = docker.getContainer(instance.containerId);
    const info = await container.inspect();

    if (info.State.Running) {
      instance.status = 'running';
      if (!instance.startedAt) {
        instance.startedAt = new Date();
      }
    } else {
      instance.status = 'stopped';
    }

    return instance;
  } catch (error) {
    // Container might not exist anymore
    if (error instanceof Error && error.message.includes('No such container')) {
      instance.status = 'stopped';
      return instance;
    }
    logger.error({ error, workspaceId }, 'Failed to get container status');
    return instance;
  }
}

/**
 * Get logs from a PicoClaw container
 */
export async function getLogs(workspaceId: string, tail: number = 100): Promise<string> {
  const instance = instancesMap.get(workspaceId);

  if (!instance) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  try {
    const container = docker.getContainer(instance.containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    // Convert buffer to string
    const logString = logs.toString('utf-8');

    return logString;
  } catch (error) {
    if (error instanceof Error && error.message.includes('No such container')) {
      return '';
    }
    logger.error({ error, workspaceId }, 'Failed to get container logs');
    throw error;
  }
}

/**
 * Restore a workspace from config file
 */
async function restoreWorkspace(workspaceId: string): Promise<boolean> {
  try {
    // Search for the config file
    const userDirs = existsSync(DATA_BASE_PATH) ? await import('fs').then(fs => 
      (fs as any).readdirSync ? (fs as any).readdirSync(DATA_BASE_PATH) : []
    ) : [];

    for (const userId of userDirs) {
      const configPath = getWorkspaceConfigPath(userId, workspaceId);
      if (existsSync(configPath)) {
        const instance = loadWorkspaceConfig(userId, workspaceId);
        if (instance) {
          instancesMap.set(workspaceId, instance);
          logger.info({ workspaceId }, 'Workspace restored from config');
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logger.error({ error, workspaceId }, 'Failed to restore workspace');
    return false;
  }
}

/**
 * Get all PicoClaw instances
 */
export function getAllInstances(): PicoClawInstance[] {
  return Array.from(instancesMap.values());
}

/**
 * Get instance count
 */
export function getInstanceCount(): number {
  return instancesMap.size;
}

/**
 * Get running instance count
 */
export function getRunningCount(): number {
  return Array.from(instancesMap.values()).filter(
    (c) => c.status === 'running' || c.status === 'starting'
  ).length;
}

