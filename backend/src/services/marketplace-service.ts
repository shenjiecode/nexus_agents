import logger from '../lib/logger.js';
import { skills, mcps, marketplaceRoles } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { uploadFile, deleteFile, getSignedDownloadUrl } from '../lib/oss.js';

// Zod schemas for validation
import { z } from 'zod';

const CreateSkillSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().min(1),
  category: z.string().optional(),
});

const CreateMcpSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().min(1),
  category: z.string().optional(),
});

const CreateRoleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().min(1),
  mcpIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  agentsMd: z.string().optional(),
});

export type CreateSkillInput = z.infer<typeof CreateSkillSchema>;
export type CreateMcpInput = z.infer<typeof CreateMcpSchema>;
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

// Helper to get database instance
let db: any = null;

async function getDb() {
  if (!db) {
    const { initDatabase } = await import('../db/index.js');
    db = await initDatabase();
  }
  return db;
}

function generateSkillId(): string {
  return `skill_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function generateMcpId(): string {
  return `mcp_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function generateRoleId(): string {
  return `mr_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

// ============== Skills CRUD ==============

export async function getAllSkills(orgId?: string): Promise<any[]> {
  const database = await getDb();
  let query = database.select().from(skills);
  
  if (orgId) {
    query = query.where(eq(skills.organizationId, orgId)) as any;
  }
  
  const allSkills = await query;
  return allSkills.map((s: any) => s);
}

export async function getSkillBySlug(slug: string): Promise<any | null> {
  const database = await getDb();
  const result = await database.select().from(skills).where(eq(skills.slug, slug));
  if (result.length === 0) return null;
  return result[0];
}

export async function getSkillDownloadUrl(slug: string): Promise<string> {
  const skill = await getSkillBySlug(slug);
  if (!skill) throw new Error(`Skill '${slug}' not found`);
  if (!skill.storageKey) throw new Error(`Skill '${slug}' has no file`);
  return getSignedDownloadUrl(skill.storageKey);
}

export async function createSkill(input: CreateSkillInput, fileBuffer: Buffer, organizationId: string | null): Promise<any> {
  const database = await getDb();
  const now = Date.now();
  
  const existing = await database.select().from(skills).where(eq(skills.slug, input.slug));
  if (existing.length > 0) {
    throw new Error(`Skill with slug '${input.slug}' already exists`);
  }
  
  const storageKey = `skills/${input.slug}.zip`;
  await uploadFile(storageKey, fileBuffer, 'application/zip');
  
  const skillData = {
    id: generateSkillId(),
    name: input.name,
    slug: input.slug,
    description: input.description,
    category: input.category || null,
    storageKey,
    organizationId,
    createdAt: now,
    updatedAt: now,
  };
  
  await database.insert(skills).values(skillData);
  logger.info({ skillId: skillData.id, slug: input.slug, organizationId }, 'Skill created');
  
  return skillData;
}

export async function deleteSkill(slug: string): Promise<void> {
  const database = await getDb();
  const existing = await database.select().from(skills).where(eq(skills.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Skill '${slug}' not found`);
  }
  
  const skill = existing[0];
  
  if (skill.storageKey) {
    await deleteFile(skill.storageKey);
  }
  
  await database.delete(skills).where(eq(skills.slug, slug));
  logger.info({ slug }, 'Skill deleted');
}

// ============== MCPs CRUD ==============

export async function getAllMcps(orgId?: string): Promise<any[]> {
  const database = await getDb();
  let query = database.select().from(mcps);
  
  if (orgId) {
    query = query.where(eq(mcps.organizationId, orgId)) as any;
  }
  
  const allMcps = await query;
  return allMcps.map((m: any) => m);
}

export async function getMcpBySlug(slug: string): Promise<any | null> {
  const database = await getDb();
  const result = await database.select().from(mcps).where(eq(mcps.slug, slug));
  if (result.length === 0) return null;
  return result[0];
}

export async function getMcpDownloadUrl(slug: string): Promise<string> {
  const mcp = await getMcpBySlug(slug);
  if (!mcp) throw new Error(`MCP '${slug}' not found`);
  if (!mcp.storageKey) throw new Error(`MCP '${slug}' has no file`);
  return getSignedDownloadUrl(mcp.storageKey);
}

export async function createMcp(input: CreateMcpInput, fileBuffer: Buffer, organizationId: string | null): Promise<any> {
  const database = await getDb();
  const now = Date.now();
  
  const existing = await database.select().from(mcps).where(eq(mcps.slug, input.slug));
  if (existing.length > 0) {
    throw new Error(`MCP with slug '${input.slug}' already exists`);
  }
  
  try {
    JSON.parse(fileBuffer.toString('utf-8'));
  } catch {
    throw new Error('Invalid JSON file');
  }
  
  const storageKey = `mcps/${input.slug}.json`;
  await uploadFile(storageKey, fileBuffer, 'application/json');
  
  const mcpData = {
    id: generateMcpId(),
    name: input.name,
    slug: input.slug,
    description: input.description,
    category: input.category || null,
    storageKey,
    organizationId,
    createdAt: now,
    updatedAt: now,
  };
  
  await database.insert(mcps).values(mcpData);
  logger.info({ mcpId: mcpData.id, slug: input.slug, organizationId }, 'MCP created');
  
  return mcpData;
}

export async function deleteMcp(slug: string): Promise<void> {
  const database = await getDb();
  const existing = await database.select().from(mcps).where(eq(mcps.slug, slug));
  if (existing.length === 0) {
    throw new Error(`MCP '${slug}' not found`);
  }
  
  const mcp = existing[0];
  
  if (mcp.storageKey) {
    await deleteFile(mcp.storageKey);
  }
  
  await database.delete(mcps).where(eq(mcps.slug, slug));
  logger.info({ slug }, 'MCP deleted');
}

// ============== Marketplace Roles CRUD ==============

export async function getAllRoles(orgId?: string): Promise<any[]> {
  const database = await getDb();
  let query = database.select().from(marketplaceRoles);
  
  if (orgId) {
    query = query.where(eq(marketplaceRoles.organizationId, orgId)) as any;
  }
  
  const allRoles = await query;
  return allRoles.map((r: any) => {
    if (typeof r.config === 'string') {
      try { r.config = JSON.parse(r.config); } catch { r.config = { mcpIds: [], skillIds: [], agentsMd: '' }; }
    }
    return r;
  });
}

export async function getRoleBySlug(slug: string): Promise<any | null> {
  const database = await getDb();
  const result = await database.select().from(marketplaceRoles).where(eq(marketplaceRoles.slug, slug));
  if (result.length === 0) return null;
  const role = result[0];
  if (typeof role.config === 'string') {
    try { role.config = JSON.parse(role.config); } catch { role.config = { mcpIds: [], skillIds: [], agentsMd: '' }; }
  }
  return role;
}

export async function getRoleById(id: string): Promise<any | null> {
  const database = await getDb();
  const result = await database.select().from(marketplaceRoles).where(eq(marketplaceRoles.id, id));
  if (result.length === 0) return null;
  const role = result[0];
  if (typeof role.config === 'string') {
    try { role.config = JSON.parse(role.config); } catch { role.config = { mcpIds: [], skillIds: [], agentsMd: '' }; }
  }
  return role;
}

export async function createRole(input: CreateRoleInput, organizationId: string | null): Promise<any> {
  const database = await getDb();
  const now = Date.now();
  
  const existing = await database.select().from(marketplaceRoles).where(eq(marketplaceRoles.slug, input.slug));
  if (existing.length > 0) {
    throw new Error(`Role with slug '${input.slug}' already exists`);
  }
  
  if (input.skillIds && input.skillIds.length > 0) {
    for (const skillId of input.skillIds) {
      const skillResult = await database.select().from(skills).where(eq(skills.id, skillId));
      if (skillResult.length === 0) {
        throw new Error(`Skill '${skillId}' not found`);
      }
    }
  }
  
  if (input.mcpIds && input.mcpIds.length > 0) {
    for (const mcpId of input.mcpIds) {
      const mcpResult = await database.select().from(mcps).where(eq(mcps.id, mcpId));
      if (mcpResult.length === 0) {
        throw new Error(`MCP '${mcpId}' not found`);
      }
    }
  }
  
  const config = {
    mcpIds: input.mcpIds || [],
    skillIds: input.skillIds || [],
    agentsMd: input.agentsMd || '',
  };
  
  const roleData = {
    id: generateRoleId(),
    name: input.name,
    slug: input.slug,
    description: input.description,
    organizationId,
    config: JSON.stringify(config),
    createdAt: now,
    updatedAt: now,
  };
  
  await database.insert(marketplaceRoles).values(roleData);
  logger.info({ roleId: roleData.id, slug: input.slug, organizationId }, 'Marketplace role created');
  
  return { ...roleData, config };
}

export async function updateRole(slug: string, input: Partial<CreateRoleInput>): Promise<any> {
  const database = await getDb();
  const existing = await database.select().from(marketplaceRoles).where(eq(marketplaceRoles.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Role '${slug}' not found`);
  }
  
  const now = Date.now();
  const current = existing[0];
  
  let currentConfig = { mcpIds: [] as string[], skillIds: [] as string[], agentsMd: '' };
  try {
    currentConfig = JSON.parse(current.config || '{}');
  } catch {}
  
  if (input.skillIds) {
    for (const skillId of input.skillIds) {
      const skillResult = await database.select().from(skills).where(eq(skills.id, skillId));
      if (skillResult.length === 0) {
        throw new Error(`Skill '${skillId}' not found`);
      }
    }
  }
  
  if (input.mcpIds) {
    for (const mcpId of input.mcpIds) {
      const mcpResult = await database.select().from(mcps).where(eq(mcps.id, mcpId));
      if (mcpResult.length === 0) {
        throw new Error(`MCP '${mcpId}' not found`);
      }
    }
  }
  
  const config = {
    mcpIds: input.mcpIds || currentConfig.mcpIds,
    skillIds: input.skillIds || currentConfig.skillIds,
    agentsMd: input.agentsMd !== undefined ? input.agentsMd : currentConfig.agentsMd,
  };
  
  const updateData: any = {
    config: JSON.stringify(config),
    updatedAt: now,
  };
  
  if (input.name) updateData.name = input.name;
  if (input.description) updateData.description = input.description;
  
  await database.update(marketplaceRoles).set(updateData).where(eq(marketplaceRoles.slug, slug));
  logger.info({ slug }, 'Marketplace role updated');
  
  const updated = await database.select().from(marketplaceRoles).where(eq(marketplaceRoles.slug, slug));
  const role = updated[0];
  if (typeof role.config === 'string') {
    try { role.config = JSON.parse(role.config); } catch { role.config = { mcpIds: [], skillIds: [], agentsMd: '' }; }
  }
  return role;
}

export async function deleteRole(slug: string): Promise<void> {
  const database = await getDb();
  const existing = await database.select().from(marketplaceRoles).where(eq(marketplaceRoles.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Role '${slug}' not found`);
  }
  
  await database.delete(marketplaceRoles).where(eq(marketplaceRoles.slug, slug));
  logger.info({ slug }, 'Marketplace role deleted');
}
