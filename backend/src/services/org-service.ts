import logger from '../lib/logger.js';
import { organizations, containers } from '../db/index.js';
import { eq, count } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { getContainersByOrganization } from './container-manager.js';

// Zod schemas for validation
import { z } from 'zod';

const CreateOrgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().optional(),
});

const UpdateOrgSchema = CreateOrgSchema.partial();

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;
export type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>;

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
 * Generate a unique organization ID
 */
function generateOrgId(): string {
  return `org_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * Generate an API key for organization authentication
 * Format: nexus_live_{32 random hex chars}
 */
function generateApiKey(): string {
  return `nexus_live_${randomBytes(16).toString('hex')}`;
}

/**
 * Verify an API key and return the organization
 */
export async function verifyApiKey(apiKey: string): Promise<{
  id: string;
  name: string;
  slug: string;
} | null> {
  if (!apiKey || !apiKey.startsWith('nexus_live_')) {
    return null;
  }
  
  const database = await getDb();
  const records = await database
    .select()
    .from(organizations)
    .where(eq(organizations.apiKey, apiKey));
  
  if (records.length === 0) {
    return null;
  }
  
  const org = records[0];
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
  };
}

/**
 * Regenerate API key for an organization
 */
export async function regenerateApiKey(orgId: string): Promise<string | null> {
  const database = await getDb();
  const existing = await getOrganizationById(orgId);
  if (!existing) {
    return null;
  }
  
  const newApiKey = generateApiKey();
  await database
    .update(organizations)
    .set({ apiKey: newApiKey, updatedAt: Date.now() })
    .where(eq(organizations.id, orgId));
  
  return newApiKey;
}

/**
 * Revoke API key for an organization (set to null)
 */
export async function revokeApiKey(orgId: string): Promise<boolean> {
  const database = await getDb();
  const existing = await getOrganizationById(orgId);
  if (!existing) {
    return false;
  }
  
  await database
    .update(organizations)
    .set({ apiKey: null, updatedAt: Date.now() })
    .where(eq(organizations.id, orgId));
  
  return true;
}

/**
 * Slugify a name to create a valid slug
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')         // Replace spaces with dashes
    .replace(/-+/g, '-')          // Collapse multiple dashes
    .slice(0, 50);                // Limit length
}

/**
 * Check if a slug is available
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const database = await getDb();
  const existing = await database
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug));
  return existing.length === 0;
}

/**
 * Create a new organization
 */
export async function createOrganization(
  input: CreateOrgInput,
  authConfig?: AuthConfig
): Promise<{
  id: string;
  name: string;
  slug: string;
  description?: string;
  apiKey: string;
  createdAt: number;
  updatedAt: number;
}> {
  const validated = CreateOrgSchema.parse(input);
  const database = await getDb();

  // Check slug uniqueness
  if (!await isSlugAvailable(validated.slug)) {
    throw new Error(`Slug '${validated.slug}' is already taken`);
  }

  const now = Date.now();
  const orgId = generateOrgId();
  const apiKey = generateApiKey();

  await database.insert(organizations).values({
    id: orgId,
    name: validated.name,
    slug: validated.slug,
    description: validated.description || null,
    apiKey: apiKey,
    createdAt: now,
    updatedAt: now,
  });

  // Create auth.json for the organization
  const finalAuthConfig = authConfig || getDefaultAuthConfig();
  if (finalAuthConfig && Object.keys(finalAuthConfig).length > 0) {
    setOrganizationAuth(validated.slug, finalAuthConfig);
    logger.info({ orgSlug: validated.slug, providers: Object.keys(finalAuthConfig) }, 'Created auth.json for organization');
  }

  // Initialize organization public directory
  initOrgPublicDir(validated.slug, validated.name);
  return {
    id: orgId,
    name: validated.name,
    slug: validated.slug,
    description: validated.description,
    apiKey: apiKey,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get default auth config from environment variables
 */
function getDefaultAuthConfig(): AuthConfig | null {
  const providerName = process.env.OPENCODE_PROVIDER_NAME || 'tencent-coding-plan';
  const apiKey = process.env.OPENCODE_API_KEY || process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return null;
  }
  
  return {
    [providerName]: {
      type: 'api',
      key: apiKey,
    },
  };
}

/**
 * Get all organizations
 */
export async function getAllOrganizations(): Promise<Array<{
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  containerCount: number;
}>> {
  const database = await getDb();
  const orgRecords = await database.select().from(organizations);

  // Get container count for each organization
  const orgsWithCount = await Promise.all(
    orgRecords.map(async (org: any) => {
      const containerResult = await database
        .select({ count: count() })
        .from(containers)
        .where(eq(containers.organizationId, org.id));
      const containerCount = containerResult[0]?.count || 0;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description || undefined,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        containerCount,
      };
    })
  );

  return orgsWithCount;
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(orgId: string): Promise<{
  id: string;
  name: string;
  slug: string;
  description?: string;
  apiKey?: string;
  createdAt: number;
  updatedAt: number;
} | null> {
  const database = await getDb();
  const records = await database
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId));

  if (records.length === 0) {
    return null;
  }

  const org = records[0];
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description || undefined,
    apiKey: org.apiKey || undefined,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string): Promise<{
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  containerCount?: number;
} | null> {
  const database = await getDb();
  const records = await database
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug));

  if (records.length === 0) {
    return null;
  }
  const org = records[0];
  
  // Count containers for this organization
  const orgContainers = getContainersByOrganization(org.id);
  
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description || undefined,
    containerCount: orgContainers.length,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * Update organization
 */
export async function updateOrganization(orgId: string, input: UpdateOrgInput): Promise<{
  id: string;
  name: string;
  slug: string;
  description?: string;
  updatedAt: number;
} | null> {
  const validated = UpdateOrgSchema.parse(input);
  const database = await getDb();

  // Check if organization exists
  const existing = await getOrganizationById(orgId);
  if (!existing) {
    return null;
  }

  // If slug is being changed, check uniqueness
  if (validated.slug && validated.slug !== existing.slug) {
    if (!await isSlugAvailable(validated.slug)) {
      throw new Error(`Slug '${validated.slug}' is already taken`);
    }
  }

  const now = Date.now();
  const updateData: any = { updatedAt: now };
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.slug !== undefined) updateData.slug = validated.slug;
  if (validated.description !== undefined) updateData.description = validated.description;

  await database
    .update(organizations)
    .set(updateData)
    .where(eq(organizations.id, orgId));

  return {
    id: orgId,
    name: validated.name || existing.name,
    slug: validated.slug || existing.slug,
    description: validated.description ?? existing.description,
    updatedAt: now,
  };
}

/**
 * Delete organization
 * Note: This will fail if organization has containers (foreign key constraint)
 */
export async function deleteOrganization(orgId: string): Promise<boolean> {
  const database = await getDb();

  // Check if organization exists
  const existing = await getOrganizationById(orgId);
  if (!existing) {
    return false;
  }

  // Delete organization
  await database
    .delete(organizations)
    .where(eq(organizations.id, orgId));

  return true;
}

// ============ Auth Configuration Management ============

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Auth config type (matches OpenCode auth.json format)
export interface AuthProviderConfig {
  type: 'api';
  key: string;
}

export type AuthConfig = Record<string, AuthProviderConfig>;

/**
 * Get the auth.json file path for an organization
 */
export function getOrgAuthPath(orgSlug: string): string {
  const orgDir = join(process.cwd(), 'data', 'orgs', orgSlug);
  return join(orgDir, 'auth.json');
}

/**
 * Ensure organization directory exists
 */
function ensureOrgDir(orgSlug: string): string {
  const orgDir = join(process.cwd(), 'data', 'orgs', orgSlug);
  if (!existsSync(orgDir)) {
    mkdirSync(orgDir, { recursive: true });
  }
  return orgDir;
}
/**
 * Get the public directory path for an organization
 */
export function getOrgPublicPath(orgSlug: string): string {
  const orgDir = join(process.cwd(), 'data', 'orgs', orgSlug, 'public');
  return orgDir;
}

/**
 * Initialize organization public directory
 */
export function initOrgPublicDir(orgSlug: string, orgName: string): void {
  const publicDir = getOrgPublicPath(orgSlug);
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
  
  // Initialize README.md if not exists
  const readmePath = join(publicDir, 'README.md');
  if (!existsSync(readmePath)) {
    const readmeContent = `# ${orgName} Organization

This directory contains organization-level public resources.
Employees can read these files but cannot modify them.

## Contents

- README.md - Organization overview
- Any shared resources for employees

`;
    writeFileSync(readmePath, readmeContent, 'utf-8');
  }
}


/**
 * Get organization's auth configuration
 * Returns null if not configured
 */
export function getOrganizationAuth(orgSlug: string): AuthConfig | null {
  const authPath = getOrgAuthPath(orgSlug);
  
  if (!existsSync(authPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(authPath, 'utf-8');
    return JSON.parse(content) as AuthConfig;
  } catch (error) {
    logger.error(error, `Failed to read auth.json for org ${orgSlug}:`);
    return null;
  }
}

/**
 * Set organization's auth configuration
 * Creates the organization directory if it doesn't exist
 */
export function setOrganizationAuth(orgSlug: string, authConfig: AuthConfig): void {
  ensureOrgDir(orgSlug);
  const authPath = getOrgAuthPath(orgSlug);
  
  // Validate auth config
  for (const [provider, config] of Object.entries(authConfig)) {
    if (!config.type || !config.key) {
      throw new Error(`Invalid auth config for provider '${provider}': must have 'type' and 'key'`);
    }
  }
  
  writeFileSync(authPath, JSON.stringify(authConfig, null, 2), 'utf-8');
}

/**
 * Delete organization's auth configuration
 */
export function deleteOrganizationAuth(orgSlug: string): boolean {
  const authPath = getOrgAuthPath(orgSlug);
  
  if (!existsSync(authPath)) {
    return false;
  }
  
  try {
    const { unlinkSync } = require('fs');
    unlinkSync(authPath);
    return true;
  } catch (error) {
    logger.error(error, `Failed to delete auth.json for org ${orgSlug}:`);
    return false;
  }
}

/**
 * Check if organization has auth configured
 */
export function hasOrganizationAuth(orgSlug: string): boolean {
  const auth = getOrganizationAuth(orgSlug);
  return auth !== null && Object.keys(auth).length > 0;
}
