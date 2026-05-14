import { organizations } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

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
export async function createOrganization(input: CreateOrgInput): Promise<{
  id: string;
  name: string;
  slug: string;
  description?: string;
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

  await database.insert(organizations).values({
    id: orgId,
    name: validated.name,
    slug: validated.slug,
    description: validated.description || null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: orgId,
    name: validated.name,
    slug: validated.slug,
    description: validated.description,
    createdAt: now,
    updatedAt: now,
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
}>> {
  const database = await getDb();
  const orgRecords = await database.select().from(organizations);

  return orgRecords.map((org: any) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description || undefined,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  }));
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(orgId: string): Promise<{
  id: string;
  name: string;
  slug: string;
  description?: string;
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
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description || undefined,
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
