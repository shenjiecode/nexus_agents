import logger from '../lib/logger.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync, rmSync } from 'fs';
import { join, normalize, resolve, relative } from 'path';

// Configuration
const DATA_BASE_PATH = join(process.cwd(), 'data', 'roles');

// Allowed file extensions for workspace files
const WORKSPACE_ALLOWED_EXTENSIONS = ['.md', '.yml', '.yaml', '.json'];
const REQUIRED_FILENAMES = ['config.json', '.security.yml'];

// File entry for list results
export interface RoleFileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

// Role config structure
export interface RoleConfig {
  name: string;
  variant: string;
  model: string;
  provider: string;
  [key: string]: unknown;
}

// Error class
export class RoleStorageError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'RoleStorageError';
  }
}

// Default templates
const DEFAULT_CONFIG: RoleConfig = {
  name: 'new-role',
  variant: 'full',
  model: 'glm-4',
  provider: 'tencent-coding-plan',
};

const DEFAULT_SECURITY = `permissions:
  allow_file_read: true
  allow_file_write: true
  allow_execute: false
  network_access: limited

constraints:
  max_file_size: 1048576
  allowed_paths:
    - workspace/
`;

const DEFAULT_AGENT_MD = `You are a helpful AI assistant.

Your role is to assist users with their tasks efficiently and professionally. You should:
- Understand the user's intent and provide relevant solutions
- Ask clarifying questions when needed
- Proactively offer helpful suggestions
- Maintain professionalism and courtesy in all interactions
`;

const DEFAULT_SOUL_MD = `## Core Personality

You are an empathetic and patient assistant who genuinely cares about helping users succeed. You believe in:
- Continuous learning and improvement
- Transparent communication
- Respect for user autonomy
- Collaboration over competition

## Values

- **Helpfulness**: Prioritize user success above all
- **Honesty**: Be truthful, even when difficult
- **Privacy**: Respect user confidentiality
- **Excellence**: Strive for quality in every response
`;

const DEFAULT_USER_MD = `## Interaction Style

- Address the user respectfully
- Use clear, concise language
- Adapt to user preferences
- Remember previous conversations for continuity

## Communication Preferences

- Preferred tone: Professional yet friendly
- Response length: Adequate to the question
- Detail level: Depends on complexity
`;

const DEFAULT_MEMORY_MD = `# Memory

This is your long-term memory. Important information about the user will be stored here.

---

## Session History

(No sessions yet)
`;

/**
 * Validate and sanitize the requested file path
 * Rejects paths containing ".." to prevent directory traversal
 */
function validatePath(userId: string, roleId: string, requestedPath: string): string {
  // Normalize and resolve the path
  const normalizedPath = normalize(requestedPath).replace(/^[\/\\]+/, '');

  // Check for directory traversal attempts
  if (normalizedPath.includes('..')) {
    throw new RoleStorageError('Path traversal not allowed', 'PATH_TRAVERSAL');
  }

  // Build the full path within the role directory
  const rolePath = join(DATA_BASE_PATH, userId, roleId);
  const fullPath = join(rolePath, normalizedPath);

  // Ensure the resolved path is within the role directory
  const resolvedPath = resolve(fullPath);
  const resolvedRoleDir = resolve(rolePath);

  if (!resolvedPath.startsWith(resolvedRoleDir)) {
    throw new RoleStorageError('Access denied: path outside role directory', 'ACCESS_DENIED');
  }

  return resolvedPath;
}

/**
 * Validate file extension and filename
 */
function validateFileType(filePath: string, isWorkspaceFile: boolean = false): void {
  const filename = filePath.split(/[\/\\]/).pop() || '';
  const ext = filename.includes('.') ? '.' + filename.split('.').pop()?.toLowerCase() : '';

  // Allow required filenames at root level
  if (REQUIRED_FILENAMES.includes(filename)) {
    return;
  }

  // Check extension for workspace files
  if (isWorkspaceFile) {
    if (!WORKSPACE_ALLOWED_EXTENSIONS.includes(ext)) {
      throw new RoleStorageError('File type not allowed', 'INVALID_FILE_TYPE');
    }
  }
}

/**
 * Initialize role directory with default structure
 */
export async function initRoleDir(userId: string, roleId: string): Promise<{ path: string; initialized: boolean }> {
  logger.info({ userId, roleId }, 'Initializing role directory');

  const rolePath = join(DATA_BASE_PATH, userId, roleId);

  // Create directory structure
  if (!existsSync(rolePath)) {
    mkdirSync(rolePath, { recursive: true });
  }

  const workspacePath = join(rolePath, 'workspace');
  const memoryPath = join(workspacePath, 'memory');

  // Create subdirectories
  if (!existsSync(workspacePath)) {
    mkdirSync(workspacePath, { recursive: true });
  }
  if (!existsSync(memoryPath)) {
    mkdirSync(memoryPath, { recursive: true });
  }

  // Write default files if they don't exist
  const configPath = join(rolePath, 'config.json');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }

  const securityPath = join(rolePath, '.security.yml');
  if (!existsSync(securityPath)) {
    writeFileSync(securityPath, DEFAULT_SECURITY, 'utf-8');
  }

  const agentPath = join(workspacePath, 'AGENT.md');
  if (!existsSync(agentPath)) {
    writeFileSync(agentPath, DEFAULT_AGENT_MD, 'utf-8');
  }

  const soulPath = join(workspacePath, 'SOUL.md');
  if (!existsSync(soulPath)) {
    writeFileSync(soulPath, DEFAULT_SOUL_MD, 'utf-8');
  }

  const userPath = join(workspacePath, 'USER.md');
  if (!existsSync(userPath)) {
    writeFileSync(userPath, DEFAULT_USER_MD, 'utf-8');
  }

  const memoryFilePath = join(memoryPath, 'MEMORY.md');
  if (!existsSync(memoryFilePath)) {
    writeFileSync(memoryFilePath, DEFAULT_MEMORY_MD, 'utf-8');
  }

  logger.info({ userId, roleId, path: rolePath }, 'Role directory initialized');

  return { path: rolePath, initialized: true };
}

/**
 * List all files in a role directory
 */
export async function listRoleFiles(userId: string, roleId: string, dirPath: string = ''): Promise<RoleFileEntry[]> {
  logger.info({ userId, roleId, dirPath }, 'Listing role files');

  const fullPath = validatePath(userId, roleId, dirPath);

  // Ensure the directory exists
  if (!existsSync(fullPath)) {
    return [];
  }

  const stats = statSync(fullPath);
  if (!stats.isDirectory()) {
    // If it's a file, return it as a single entry
    const filename = fullPath.split(/[\/\\]/).pop() || '';
    return [{
      name: filename,
      path: relative(join(DATA_BASE_PATH, userId, roleId), fullPath),
      type: 'file',
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    }];
  }

  // List directory contents
  const entries = readdirSync(fullPath, { withFileTypes: true });
  const files: RoleFileEntry[] = [];

  for (const entry of entries) {
    const entryPath = join(fullPath, entry.name);
    const entryStats = statSync(entryPath);

    // Skip hidden files (except .security.yml)
    if (entry.name.startsWith('.') && entry.name !== '.security.yml') {
      continue;
    }

    // Only include allowed files
    if (entry.isFile()) {
      const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop()?.toLowerCase() : '';
      const isRequiredFilename = REQUIRED_FILENAMES.includes(entry.name);
      const isAllowedExt = WORKSPACE_ALLOWED_EXTENSIONS.includes(ext);

      if (!isRequiredFilename && !isAllowedExt) {
        continue;
      }
    }

    const relativePath = join(dirPath, entry.name).replace(/^[\/\\]+/, '');
    files.push({
      name: entry.name,
      path: relativePath,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: entry.isFile() ? entryStats.size : undefined,
      modifiedAt: entryStats.mtime.toISOString(),
    });
  }

  // Sort: directories first, then files, alphabetically
  files.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return files;
}

/**
 * Read a file from the role directory
 */
export async function readRoleFile(userId: string, roleId: string, filePath: string): Promise<string> {
  logger.info({ userId, roleId, filePath }, 'Reading role file');

  const fullPath = validatePath(userId, roleId, filePath);
  validateFileType(fullPath, filePath.includes('workspace'));

  if (!existsSync(fullPath)) {
    throw new RoleStorageError('File not found', 'FILE_NOT_FOUND');
  }

  const stats = statSync(fullPath);
  if (!stats.isFile()) {
    throw new RoleStorageError('Path is a directory', 'IS_DIRECTORY');
  }

  const content = readFileSync(fullPath, 'utf-8');
  logger.info({ userId, roleId, filePath, size: content.length }, 'Role file read successfully');

  return content;
}

/**
 * Write content to a file in the role directory
 */
export async function writeRoleFile(
  userId: string,
  roleId: string,
  filePath: string,
  content: string
): Promise<{ path: string; size: number }> {
  logger.info({ userId, roleId, filePath, size: content.length }, 'Writing role file');

  const fullPath = validatePath(userId, roleId, filePath);
  validateFileType(fullPath, filePath.includes('workspace'));

  // Create parent directories if needed
  const parentPath = fullPath.substring(0, fullPath.lastIndexOf(fullPath.includes('/') ? '/' : '\\'));
  if (parentPath && !existsSync(parentPath)) {
    mkdirSync(parentPath, { recursive: true });
  }

  writeFileSync(fullPath, content, 'utf-8');
  const size = Buffer.byteLength(content, 'utf-8');

  logger.info({ userId, roleId, filePath, size }, 'Role file written successfully');

  return { path: filePath, size };
}

/**
 * Delete role directory
 */
export async function deleteRoleDir(userId: string, roleId: string): Promise<void> {
  logger.info({ userId, roleId }, 'Deleting role directory');

  const rolePath = join(DATA_BASE_PATH, userId, roleId);
  const resolvedPath = resolve(rolePath);
  const resolvedBase = resolve(DATA_BASE_PATH);

  // Security check: ensure we're deleting within the roles directory
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new RoleStorageError('Access denied: path outside roles directory', 'ACCESS_DENIED');
  }

  if (!existsSync(rolePath)) {
    throw new RoleStorageError('Role directory not found', 'NOT_FOUND');
  }

  rmSync(rolePath, { recursive: true, force: true });
  logger.info({ userId, roleId }, 'Role directory deleted');
}

/**
 * Export role directory as zip buffer
 */
export async function exportRoleZip(userId: string, roleId: string): Promise<Buffer> {
  logger.info({ userId, roleId }, 'Exporting role as zip');

  const rolePath = join(DATA_BASE_PATH, userId, roleId);

  if (!existsSync(rolePath)) {
    throw new RoleStorageError('Role directory not found', 'NOT_FOUND');
  }

  // Dynamic import to avoid type issues
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const archiver = await import('archiver');

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const archive = archiver.default('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on('end', () => {
      const buffer = Buffer.concat(chunks);
      logger.info({ userId, roleId, size: buffer.length }, 'Role exported as zip');
      resolve(buffer);
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.directory(rolePath, roleId);
    archive.finalize();
  });
}

/**
 * Import role from zip buffer
 */
export async function importRoleZip(userId: string, roleId: string, zipBuffer: Buffer): Promise<{ path: string; files: number }> {
  logger.info({ userId, roleId, size: zipBuffer.length }, 'Importing role from zip');

  // Dynamic import to avoid type issues
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const extract = await import('extract-zip');
  const tempDir = join(DATA_BASE_PATH, '.temp', `${userId}-${roleId}-${Date.now()}`);

  try {
    // Write zip to temp file
    const tempZipPath = `${tempDir}.zip`;
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(tempZipPath, zipBuffer);

    // Extract to temp directory
    await extract.default(tempZipPath, { dir: tempDir });

    // Determine extracted role folder name
    const extractedEntries = readdirSync(tempDir, { withFileTypes: true });
    const extractedFolder = extractedEntries.find(e => e.isDirectory())?.name;

    if (!extractedFolder) {
      throw new RoleStorageError('Invalid zip structure', 'INVALID_ZIP');
    }

    // Move to final location
    const rolePath = join(DATA_BASE_PATH, userId, roleId);
    if (existsSync(rolePath)) {
      rmSync(rolePath, { recursive: true, force: true });
    }

    const sourcePath = join(tempDir, extractedFolder);
    mkdirSync(rolePath, { recursive: true });

    // Copy files recursively
    const copyRecursive = (src: string, dest: string) => {
      const entries = readdirSync(src, { withFileTypes: true });
      let fileCount = 0;

      for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
          mkdirSync(destPath, { recursive: true });
          fileCount += copyRecursive(srcPath, destPath);
        } else {
          const content = readFileSync(srcPath);
          writeFileSync(destPath, content);
          fileCount++;
        }
      }

      return fileCount;
    };

    const files = copyRecursive(sourcePath, rolePath);

    // Cleanup temp files
    rmSync(tempDir, { recursive: true, force: true });
    unlinkSync(tempZipPath);

    logger.info({ userId, roleId, files }, 'Role imported successfully');

    return { path: rolePath, files };
  } catch (error) {
    // Cleanup on error
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}
