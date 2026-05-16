import logger from '../lib/logger.js';
import { skills, mcps, roleSkills, roleMcps, roles, marketplaceRoles } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { uploadFile, downloadFile, deleteFile, getSignedDownloadUrl } from '../lib/oss.js';
import { extract } from 'tar-fs';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

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

function generateRoleSkillId(): string {
  return `rs_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function generateRoleMcpId(): string {
  return `rm_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function getRoleOpenCodePath(slug: string): string {
  return join(process.cwd(), 'roles', slug, 'opencode.json');
}

function getRoleSkillDir(slug: string, skillSlug: string): string {
  return join(process.cwd(), 'roles', slug, '.opencode', 'skills', skillSlug);
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

// ============== Role Association ==============

export async function getSkillsForRole(roleSlug: string): Promise<any[]> {
  const database = await getDb();
  
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) return [];
  const roleId = roleResult[0].id;
  
  const roleSkillResult = await database.select().from(roleSkills).where(eq(roleSkills.roleId, roleId));
  const skillIds = roleSkillResult.map((rs: any) => rs.skillId);
  
  if (skillIds.length === 0) return [];
  
  const allSkills = await database.select().from(skills);
  return allSkills.filter((s: any) => skillIds.includes(s.id));
}

export async function getMcpsForRole(roleSlug: string): Promise<any[]> {
  const database = await getDb();
  
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) return [];
  const roleId = roleResult[0].id;
  
  const roleMcpResult = await database.select().from(roleMcps).where(eq(roleMcps.roleId, roleId));
  const mcpIds = roleMcpResult.map((rm: any) => rm.mcpId);
  
  if (mcpIds.length === 0) return [];
  
  const allMcps = await database.select().from(mcps);
  return allMcps.filter((m: any) => mcpIds.includes(m.id));
}

export async function addSkillToRole(roleSlug: string, skillSlug: string): Promise<void> {
  const database = await getDb();
  
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) throw new Error(`Role '${roleSlug}' not found`);
  
  const skillResult = await database.select().from(skills).where(eq(skills.slug, skillSlug));
  if (skillResult.length === 0) throw new Error(`Skill '${skillSlug}' not found`);
  
  const existing = await database.select().from(roleSkills)
    .where(eq(roleSkills.roleId, roleResult[0].id))
    .where(eq(roleSkills.skillId, skillResult[0].id));
  
  if (existing.length > 0) {
    logger.warn({ roleSlug, skillSlug }, 'Skill already associated with role');
    return;
  }
  
  await database.insert(roleSkills).values({
    id: generateRoleSkillId(),
    roleId: roleResult[0].id,
    skillId: skillResult[0].id,
    createdAt: Date.now(),
  });
  
  const skill = skillResult[0];
  const skillDir = getRoleSkillDir(roleSlug, skillSlug);
  mkdirSync(skillDir, { recursive: true });
  
  try {
    const fileBuffer = await downloadFile(skill.storageKey);
    const stream = Readable.from(fileBuffer);
    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(createGunzip())
        .pipe(extract(skillDir, { ignore: (path: string) => path.includes('..') }))
        .on('finish', () => resolve())
        .on('error', reject);
    });
    logger.info({ roleSlug, skillSlug }, 'Skill extracted to role directory');
  } catch (err) {
    logger.warn({ err, roleSlug, skillSlug }, 'Failed to extract skill, continuing');
  }
  
  logger.info({ roleSlug, skillSlug }, 'Skill added to role');
}

export async function addMcpToRole(roleSlug: string, mcpSlug: string): Promise<void> {
  const database = await getDb();
  
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) throw new Error(`Role '${roleSlug}' not found`);
  
  const mcpResult = await database.select().from(mcps).where(eq(mcps.slug, mcpSlug));
  if (mcpResult.length === 0) throw new Error(`MCP '${mcpSlug}' not found`);
  
  const existing = await database.select().from(roleMcps)
    .where(eq(roleMcps.roleId, roleResult[0].id))
    .where(eq(roleMcps.mcpId, mcpResult[0].id));
  
  if (existing.length > 0) {
    logger.warn({ roleSlug, mcpSlug }, 'MCP already associated with role');
    return;
  }
  
  await database.insert(roleMcps).values({
    id: generateRoleMcpId(),
    roleId: roleResult[0].id,
    mcpId: mcpResult[0].id,
    createdAt: Date.now(),
  });
  
  const mcp = mcpResult[0];
  const opencodePath = getRoleOpenCodePath(roleSlug);
  let opencodeConfig: any = {};
  
  if (existsSync(opencodePath)) {
    try {
      const content = readFileSync(opencodePath, 'utf-8');
      opencodeConfig = JSON.parse(content);
    } catch (e) {
      logger.warn({ err: e, opencodePath }, 'Failed to parse opencode.json, creating new');
    }
  }
  
  try {
    const mcpConfigBuffer = await downloadFile(mcp.storageKey);
    const mcpConfig = JSON.parse(mcpConfigBuffer.toString('utf-8'));
    
    if (!opencodeConfig.mcpServers) {
      opencodeConfig.mcpServers = {};
    }
    
    opencodeConfig.mcpServers[mcpSlug] = mcpConfig;
    writeFileSync(opencodePath, JSON.stringify(opencodeConfig, null, 2), 'utf-8');
    logger.info({ roleSlug, mcpSlug }, 'MCP written to opencode.json');
  } catch (err) {
    logger.warn({ err, roleSlug, mcpSlug }, 'Failed to merge MCP config, continuing');
  }
  
  logger.info({ roleSlug, mcpSlug }, 'MCP added to role');
}

export async function removeSkillFromRole(roleSlug: string, skillSlug: string): Promise<void> {
  const database = await getDb();
  
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) throw new Error(`Role '${roleSlug}' not found`);
  
  const skillResult = await database.select().from(skills).where(eq(skills.slug, skillSlug));
  if (skillResult.length === 0) throw new Error(`Skill '${skillSlug}' not found`);
  
  await database.delete(roleSkills)
    .where(eq(roleSkills.roleId, roleResult[0].id))
    .where(eq(roleSkills.skillId, skillResult[0].id));
  
  const skillDir = getRoleSkillDir(roleSlug, skillSlug);
  if (existsSync(skillDir)) {
    try {
      rmSync(skillDir, { recursive: true, force: true });
      logger.info({ roleSlug, skillSlug }, 'Skill directory deleted');
    } catch (e) {
      logger.warn({ err: e, skillDir }, 'Failed to delete skill directory');
    }
  }
  
  logger.info({ roleSlug, skillSlug }, 'Skill removed from role');
}

export async function removeMcpFromRole(roleSlug: string, mcpSlug: string): Promise<void> {
  const database = await getDb();
  
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) throw new Error(`Role '${roleSlug}' not found`);
  
  const mcpResult = await database.select().from(mcps).where(eq(mcps.slug, mcpSlug));
  if (mcpResult.length === 0) throw new Error(`MCP '${mcpSlug}' not found`);
  
  await database.delete(roleMcps)
    .where(eq(roleMcps.roleId, roleResult[0].id))
    .where(eq(roleMcps.mcpId, mcpResult[0].id));
  
  const opencodePath = getRoleOpenCodePath(roleSlug);
  
  if (existsSync(opencodePath)) {
    try {
      const content = readFileSync(opencodePath, 'utf-8');
      const opencodeConfig = JSON.parse(content);
      
      if (opencodeConfig.mcpServers && opencodeConfig.mcpServers[mcpSlug]) {
        delete opencodeConfig.mcpServers[mcpSlug];
        writeFileSync(opencodePath, JSON.stringify(opencodeConfig, null, 2), 'utf-8');
        logger.info({ roleSlug, mcpSlug }, 'MCP removed from opencode.json');
      }
    } catch (e) {
      logger.warn({ err: e, opencodePath }, 'Failed to update opencode.json');
    }
  }
  
  logger.info({ roleSlug, mcpSlug }, 'MCP removed from role');
}