import logger from '../lib/logger.js';
import { roles, roleVersions } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { generateRoleConfig, updateRoleConfigFiles, deleteRoleConfig } from './config-manager.js';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Zod schemas for validation
import { z } from 'zod';

const CreateRoleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().optional(),
  prompts: z.record(z.string(), z.object({
    name: z.string().min(1),
    content: z.string().min(1),
  })).optional(),
  skills: z.record(z.string(), z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  })).optional(),
});

const UpdateRoleSchema = CreateRoleSchema.partial();

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

// Helper to get database instance
let db: any = null;

async function getDb() {
  if (!db) {
    const { initDatabase } = await import('../db/index.js');
    db = await initDatabase();
  }
  return db;
}

/**
 * Generate a unique role ID
 */
function generateRoleId(): string {
  return `role_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * Generate version ID
 */
function generateVersionId(): string {
  return `rv_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * Check if a slug is available
 */
export async function isRoleSlugAvailable(slug: string): Promise<boolean> {
  const database = await getDb();
  const existing = await database
    .select()
    .from(roles)
    .where(eq(roles.slug, slug));
  return existing.length === 0;
}

/**
 * Build role Docker image
 */
async function buildRoleImage(slug: string, version: string): Promise<string> {
  const roleDir = join(process.cwd(), 'roles', slug);
  const imageName = `nexus-role-${slug}:${version}`;
  
  try {
    // Build image using podman
    const { stderr } = await execAsync(
      `podman build -t ${imageName} ${roleDir}`,
      { timeout: 300000 } // 5 minute timeout
    );
    
    logger.info(`Built image: ${imageName}`);
    if (stderr) logger.warn({ stderr }, 'Build warnings');
    
    
    return imageName;
  } catch (error) {
    logger.error(error, 'Failed to build image');
    throw new Error(`Failed to build role image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a new role with first version
 */
export async function createRole(input: CreateRoleInput): Promise<{
  id: string;
  slug: string;
  name: string;
  description?: string;
  version: string;
  imageName: string;
  createdAt: number;
  updatedAt: number;
}> {
  const validated = CreateRoleSchema.parse(input);
  const database = await getDb();

  // Check slug uniqueness
  if (!await isRoleSlugAvailable(validated.slug)) {
    throw new Error(`Role slug '${validated.slug}' is already taken`);
  }

  const now = Date.now();
  const roleId = generateRoleId();
  const version = 'v1.0.0';

  // Generate role config files
  generateRoleConfig(validated.slug, {
    name: validated.name,
    description: validated.description,
    prompts: validated.prompts,
    skills: validated.skills,
  });

  // Build Docker image
  let imageName: string;
  try {
    imageName = await buildRoleImage(validated.slug, version);
  } catch (error) {
    // If build fails, clean up and throw
    deleteRoleConfig(validated.slug);
    throw error;
  }

  // Save to database
  await database.insert(roles).values({
    id: roleId,
    slug: validated.slug,
    name: validated.name,
    description: validated.description || null,
    version: version,
    imageName: imageName,
    config: JSON.stringify({
      name: validated.name,
      description: validated.description,
      prompts: validated.prompts,
      skills: validated.skills,
    }),
    createdAt: now,
    updatedAt: now,
  });

  // Save initial version record
  const versionId = generateVersionId();
  await database.insert(roleVersions).values({
    id: versionId,
    roleId: roleId,
    version: version,
    imageName: imageName,
    config: JSON.stringify({
      name: validated.name,
      description: validated.description,
      prompts: validated.prompts,
      skills: validated.skills,
    }),
    createdAt: now,
  });

  return {
    id: roleId,
    slug: validated.slug,
    name: validated.name,
    description: validated.description,
    version: version,
    imageName: imageName,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get all roles
 */
export async function getAllRoles(): Promise<Array<{
  id: string;
  slug: string;
  name: string;
  description?: string;
  version: string;
  imageName: string;
  createdAt: number;
  updatedAt: number;
}>> {
  const database = await getDb();
  const roleRecords = await database.select().from(roles);

  return roleRecords.map((role: any) => ({
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description || undefined,
    version: role.version,
    imageName: role.imageName,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }));
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: string): Promise<{
  id: string;
  slug: string;
  name: string;
  description?: string;
  version: string;
  imageName: string;
  config: any;
  createdAt: number;
  updatedAt: number;
} | null> {
  const database = await getDb();
  const records = await database
    .select()
    .from(roles)
    .where(eq(roles.id, roleId));

  if (records.length === 0) {
    return null;
  }

  const role = records[0];
  return {
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description || undefined,
    version: role.version,
    imageName: role.imageName,
    config: role.config ? JSON.parse(role.config) : null,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

/**
 * Get role by slug
 */
export async function getRoleBySlug(slug: string): Promise<{
  id: string;
  slug: string;
  name: string;
  description?: string;
  version: string;
  imageName: string;
  config: any;
  createdAt: number;
  updatedAt: number;
} | null> {
  const database = await getDb();
  const records = await database
    .select()
    .from(roles)
    .where(eq(roles.slug, slug));

  if (records.length === 0) {
    return null;
  }

  const role = records[0];
  return {
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description || undefined,
    version: role.version,
    imageName: role.imageName,
    config: role.config ? JSON.parse(role.config) : null,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

/**
 * Get role versions
 */
export async function getRoleVersions(roleId: string): Promise<Array<{
  id: string;
  version: string;
  imageName: string;
  createdAt: number;
}>> {
  const database = await getDb();
  const records = await database
    .select()
    .from(roleVersions)
    .where(eq(roleVersions.roleId, roleId))
    .orderBy(roleVersions.createdAt);

  return records.map((rv: any) => ({
    id: rv.id,
    version: rv.version,
    imageName: rv.imageName,
    createdAt: rv.createdAt,
  }));
}

/**
 * Increment version number
 */
function incrementVersion(currentVersion: string): string {
  const match = currentVersion.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return 'v1.0.0';
  
  const [, major, minor, patch] = match;
  const newPatch = parseInt(patch, 10) + 1;
  return `v${major}.${minor}.${newPatch}`;
}

/**
 * Update role and create new version
 */
export async function updateRole(roleSlug: string, input: UpdateRoleInput): Promise<{
  id: string;
  slug: string;
  name: string;
  description?: string;
  version: string;
  imageName: string;
  updatedAt: number;
} | null> {
  const validated = UpdateRoleSchema.parse(input);
  const database = await getDb();

  // Get existing role
  const existing = await getRoleBySlug(roleSlug);
  if (!existing) {
    return null;
  }

  const now = Date.now();
  const newVersion = incrementVersion(existing.version);

  // Update config files
  // Update config files
  updateRoleConfigFiles(roleSlug, {
    name: validated.name,
    description: validated.description,
    prompts: validated.prompts as any,
    skills: validated.skills as any,
  });

  // Build new image
  let imageName: string;
  try {
    imageName = await buildRoleImage(roleSlug, newVersion);
  } catch (error) {
    throw error;
  }

  // Build update object
  const existingConfig = existing.config || {};
  const newConfig = { ...existingConfig, ...validated };
  
  const updateData: any = {
    updatedAt: now,
    version: newVersion,
    imageName: imageName,
    config: JSON.stringify(newConfig),
  };
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.description !== undefined) updateData.description = validated.description;

  // Update role in database
  await database
    .update(roles)
    .set(updateData)
    .where(eq(roles.id, existing.id));

  // Save version record
  const versionId = generateVersionId();
  await database.insert(roleVersions).values({
    id: versionId,
    roleId: existing.id,
    version: newVersion,
    imageName: imageName,
    config: JSON.stringify(newConfig),
    createdAt: now,
  });

  return {
    id: existing.id,
    slug: roleSlug,
    name: validated.name || existing.name,
    description: validated.description ?? existing.description,
    version: newVersion,
    imageName: imageName,
    updatedAt: now,
  };
}

/**
 * Delete a role
 */
export async function deleteRole(roleSlug: string): Promise<boolean> {
  const database = await getDb();

  const existing = await getRoleBySlug(roleSlug);
  if (!existing) {
    return false;
  }

  // Delete config files
  deleteRoleConfig(roleSlug);

  // Delete version records
  await database
    .delete(roleVersions)
    .where(eq(roleVersions.roleId, existing.id));

  // Delete role
  await database
    .delete(roles)
    .where(eq(roles.id, existing.id));

  return true;
}
