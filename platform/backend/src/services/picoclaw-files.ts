import logger from '../lib/logger.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join, normalize, resolve, relative } from 'path';

// Configuration
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const DATA_BASE_PATH = join(process.cwd(), 'data', 'picoclaw');

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.json', '.yml', '.yaml', '.md'];
const ALLOWED_FILENAMES = ['config.json', '.security.yml'];

// File entry for list results
export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

// Error classes
export class PicoClawFileError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PicoClawFileError';
  }
}

/**
 * Validate and sanitize the requested file path
 * Rejects paths containing ".." to prevent directory traversal
 * Restricts access to .picoclaw/ directory only
 */
function validatePath(workspaceId: string, requestedPath: string): string {
  // Normalize and resolve the path
  const normalizedPath = normalize(requestedPath).replace(/^[\/\\]+/, '');

  // Check for directory traversal attempts
  if (normalizedPath.includes('..')) {
    throw new PicoClawFileError('Path traversal not allowed', 'PATH_TRAVERSAL');
  }

  // Build the full path within the workspace
  const workspacePath = join(DATA_BASE_PATH, 'workspace', workspaceId);
  const fullPath = join(workspacePath, normalizedPath);

  // Ensure the resolved path is within the workspace directory
  const resolvedPath = resolve(fullPath);
  const resolvedWorkspace = resolve(workspacePath);

  if (!resolvedPath.startsWith(resolvedWorkspace)) {
    throw new PicoClawFileError('Access denied: path outside workspace', 'ACCESS_DENIED');
  }

  return resolvedPath;
}

/**
 * Validate file extension and filename
 */
function validateFileType(requestedPath: string): void {
  const filename = requestedPath.split(/[\/\\]/).pop() || '';
  const ext = filename.includes('.') ? '.' + filename.split('.').pop()?.toLowerCase() : '';

  // Allow specific filenames
  if (ALLOWED_FILENAMES.includes(filename)) {
    return;
  }

  // Check extension for files in workspace/
  if (requestedPath.includes('/workspace/') || requestedPath.includes('\\workspace\\')) {
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new PicoClawFileError('File type not allowed', 'INVALID_FILE_TYPE');
    }
  }
}

/**
 * Validate file size
 */
function validateFileSize(content: string): void {
  const size = Buffer.byteLength(content, 'utf-8');
  if (size > MAX_FILE_SIZE) {
    throw new PicoClawFileError(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024}KB`,
      'FILE_TOO_LARGE'
    );
  }
}

/**
 * List files in a workspace directory
 */
export async function listFiles(workspaceId: string, dirPath: string = ''): Promise<FileEntry[]> {
  logger.info({ workspaceId, dirPath }, 'Listing files');

  const fullPath = validatePath(workspaceId, dirPath);

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
      path: relative(join(DATA_BASE_PATH, 'workspace', workspaceId), fullPath),
      type: 'file',
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    }];
  }

  // List directory contents
  const entries = readdirSync(fullPath, { withFileTypes: true });
  const files: FileEntry[] = [];

  for (const entry of entries) {
    const entryPath = join(fullPath, entry.name);
    const entryStats = statSync(entryPath);

    // Only include allowed files
    if (entry.isFile()) {
      const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop()?.toLowerCase() : '';
      const isAllowedFilename = ALLOWED_FILENAMES.includes(entry.name);
      const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);

      if (!isAllowedFilename && !isAllowedExt) {
        continue;
      }
    }

    files.push({
      name: entry.name,
      path: join(dirPath, entry.name).replace(/^[\/\\]+/, ''),
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
 * Read a file from the workspace
 */
export async function readFile(workspaceId: string, filePath: string): Promise<string> {
  logger.info({ workspaceId, filePath }, 'Reading file');

  const fullPath = validatePath(workspaceId, filePath);
  validateFileType(fullPath);

  if (!existsSync(fullPath)) {
    throw new PicoClawFileError('File not found', 'FILE_NOT_FOUND');
  }

  const stats = statSync(fullPath);
  if (!stats.isFile()) {
    throw new PicoClawFileError('Path is a directory', 'IS_DIRECTORY');
  }

  const content = readFileSync(fullPath, 'utf-8');
  logger.info({ workspaceId, filePath, size: content.length }, 'File read successfully');

  return content;
}

/**
 * Write content to a file in the workspace
 */
export async function writeFile(
  workspaceId: string,
  filePath: string,
  content: string
): Promise<{ path: string; size: number }> {
  logger.info({ workspaceId, filePath, size: content.length }, 'Writing file');

  const fullPath = validatePath(workspaceId, filePath);
  validateFileType(fullPath);
  validateFileSize(content);

  // Create parent directories if needed
  const parentPath = fullPath.substring(0, fullPath.lastIndexOf(fullPath.includes('/') ? '/' : '\\'));
  if (parentPath && !existsSync(parentPath)) {
    mkdirSync(parentPath, { recursive: true });
  }

  writeFileSync(fullPath, content, 'utf-8');
  const size = Buffer.byteLength(content, 'utf-8');

  logger.info({ workspaceId, filePath, size }, 'File written successfully');

  return { path: filePath, size };
}

/**
 * Delete a file from the workspace
 */
export async function deleteFile(workspaceId: string, filePath: string): Promise<void> {
  logger.info({ workspaceId, filePath }, 'Deleting file');

  const fullPath = validatePath(workspaceId, filePath);

  if (!existsSync(fullPath)) {
    throw new PicoClawFileError('File not found', 'FILE_NOT_FOUND');
  }

  const stats = statSync(fullPath);
  if (!stats.isFile()) {
    throw new PicoClawFileError('Path is a directory, not a file', 'IS_DIRECTORY');
  }

  unlinkSync(fullPath);
  logger.info({ workspaceId, filePath }, 'File deleted successfully');
}