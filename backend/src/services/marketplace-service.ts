import logger from '../lib/logger.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { skills, mcps, roleSkills, roleMcps, roles } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

// Zod schemas for validation
import { z } from 'zod';

const CreateSkillSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().min(1),
  category: z.string().optional(),
  skillPath: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

const CreateMcpSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().min(1),
  category: z.string().optional(),
  serverType: z.enum(['local', 'remote']).default('local'),
  command: z.array(z.string()).min(1),
  envTemplate: z.record(z.string(), z.string()).optional(),
  requiresApiKey: z.boolean().default(false),
});

export type CreateSkillInput = z.infer<typeof CreateSkillSchema>;
export type CreateMcpInput = z.infer<typeof CreateMcpSchema>;

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
 * Generate unique IDs
 */
function generateSkillId(): string {
  return `skill_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function generateMcpId(): string {
  return `mcp_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function generateRoleSkillId(): string {
  return `rs_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function generateRoleMcpId(): string {
  return `rm_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

// Helper functions for role file system operations
function getRoleOpenCodePath(slug: string): string {
  return join(process.cwd(), 'roles', slug, 'opencode.json');
}


function getRoleSkillDir(slug: string, skillSlug: string): string {
  return join(process.cwd(), 'roles', slug, '.opencode', 'skills', skillSlug);
}

/**
 * Demo Skills data - pre-populated for marketplace
 */
const DEMO_SKILLS = [
  {
    id: 'skill_review_work',
    name: 'Review Work',
    slug: 'review-work',
    description: 'Post-implementation review orchestrator. Launches 5 parallel background sub-agents: Oracle (goal/constraint verification), Oracle (code quality), Oracle (security), unspecified-high (hands-on QA execution), unspecified-high (context mining from GitHub/git/Slack/Notion).',
    category: 'development',
    skillPath: '.opencode/skills/review-work',
    metadata: {
      version: '1.0.0',
      license: 'MIT',
      allowedTools: ['read', 'bash', 'glob', 'grep', 'ast_grep_search'],
    },
  },
  {
    id: 'skill_git_master',
    name: 'Git Master',
    slug: 'git-master',
    description: 'MUST USE for ANY git operations. Atomic commits, rebase/squash, history search (blame, bisect, log -S). Recommended: Use with task(category=\'quick\', load_skills=[\'git-master\'], ...)',
    category: 'development',
    skillPath: '.opencode/skills/git-master',
    metadata: {
      version: '1.0.0',
      license: 'MIT',
      allowedTools: ['read', 'write', 'bash'],
    },
  },
  {
    id: 'skill_ai_slop_remover',
    name: 'AI Slop Remover',
    slug: 'ai-slop-remover',
    description: 'Removes AI-generated code smells from a SINGLE file while preserving functionality. For multiple files, call in PARALLEL per file.',
    category: 'development',
    skillPath: '.opencode/skills/ai-slop-remover',
    metadata: {
      version: '1.0.0',
      license: 'MIT',
      allowedTools: ['read', 'write', 'edit'],
    },
  },
  {
    id: 'skill_frontend_ui_ux',
    name: 'Frontend UI/UX Designer',
    slug: 'frontend-ui-ux',
    description: 'Designer-turned-developer who crafts stunning UI/UX even without design mockups.',
    category: 'design',
    skillPath: '.opencode/skills/frontend-ui-ux',
    metadata: {
      version: '1.0.0',
      license: 'MIT',
      allowedTools: ['read', 'write', 'edit', 'glob', 'grep'],
    },
  },
  {
    id: 'skill_researcher',
    name: 'Researcher',
    slug: 'researcher',
    description: 'Deep research skill for gathering information from multiple sources, synthesizing findings, and producing comprehensive reports.',
    category: 'analysis',
    skillPath: '.opencode/skills/researcher',
    metadata: {
      version: '1.0.0',
      license: 'MIT',
      allowedTools: ['read', 'webfetch', 'websearch_web_search_exa'],
    },
  },
];

/**
 * Demo MCPs data - pre-populated for marketplace
 */
const DEMO_MCPS = [
  {
    id: 'mcp_filesystem',
    name: 'Filesystem MCP',
    slug: 'filesystem',
    description: 'Local filesystem operations - read, write, search directories with configurable allowed paths.',
    category: 'tools',
    serverType: 'local',
    command: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed'],
    envTemplate: {},
    requiresApiKey: false,
  },
  {
    id: 'mcp_postgres',
    name: 'PostgreSQL MCP',
    slug: 'postgres',
    description: 'Connect to PostgreSQL databases for querying and schema inspection.',
    category: 'database',
    serverType: 'local',
    command: ['npx', '-y', '@modelcontextprotocol/server-postgres'],
    envTemplate: {
      'POSTGRES_CONNECTION_STRING': 'postgresql://user:password@localhost:5432/database',
    },
    requiresApiKey: false,
  },
  {
    id: 'mcp_brave_search',
    name: 'Brave Search MCP',
    slug: 'brave-search',
    description: 'Web search using Brave Search API for real-time information retrieval.',
    category: 'tools',
    serverType: 'local',
    command: ['npx', '-y', '@modelcontextprotocol/server-brave-search'],
    envTemplate: {
      'BRAVE_API_KEY': 'your_brave_api_key_here',
    },
    requiresApiKey: true,
  },
  {
    id: 'mcp_github',
    name: 'GitHub MCP',
    slug: 'github',
    description: 'GitHub API integration - repos, issues, pull requests, workflows.',
    category: 'tools',
    serverType: 'local',
    command: ['npx', '-y', '@modelcontextprotocol/server-github'],
    envTemplate: {
      'GITHUB_TOKEN': 'your_github_token_here',
    },
    requiresApiKey: true,
  },
  {
    id: 'mcp_slack',
    name: 'Slack MCP',
    slug: 'slack',
    description: 'Slack workspace integration - channels, messages, users.',
    category: 'communication',
    serverType: 'local',
    command: ['npx', '-y', '@modelcontextprotocol/server-slack'],
    envTemplate: {
      'SLACK_BOT_TOKEN': 'xoxb-your-bot-token',
      'SLACK_TEAM_ID': 'T01234567',
    },
    requiresApiKey: true,
  },
];

/**
 * Initialize marketplace with demo data
 */
export async function initializeMarketplace(): Promise<void> {
  const database = await getDb();
  
  // Check if skills already exist
  const existingSkills = await database.select().from(skills);
  if (existingSkills.length === 0) {
    const now = Date.now();
    for (const skill of DEMO_SKILLS) {
      await database.insert(skills).values({
        ...skill,
        metadata: JSON.stringify(skill.metadata),
        createdAt: now,
        updatedAt: now,
      });
    }
    logger.info({ count: DEMO_SKILLS.length }, 'Initialized demo skills');
  }
  
  // Check if mcps already exist
  const existingMcps = await database.select().from(mcps);
  if (existingMcps.length === 0) {
    const now = Date.now();
    for (const mcp of DEMO_MCPS) {
      await database.insert(mcps).values({
        ...mcp,
        command: JSON.stringify(mcp.command),
        envTemplate: Object.keys(mcp.envTemplate).length > 0 ? JSON.stringify(mcp.envTemplate) : null,
        createdAt: now,
        updatedAt: now,
      });
    }
    logger.info({ count: DEMO_MCPS.length }, 'Initialized demo MCPs');
  }
}

// ============== Skills CRUD ==============

export async function getAllSkills(): Promise<any[]> {
  const database = await getDb();
  const allSkills = await database.select().from(skills);
  return allSkills.map((s: any) => ({
    ...s,
    metadata: s.metadata ? JSON.parse(s.metadata) : null,
  }));
}

export async function getSkillBySlug(slug: string): Promise<any | null> {
  const database = await getDb();
  const result = await database.select().from(skills).where(eq(skills.slug, slug));
  if (result.length === 0) return null;
  const s = result[0];
  return {
    ...s,
    metadata: s.metadata ? JSON.parse(s.metadata) : null,
  };
}

export async function createSkill(input: CreateSkillInput): Promise<any> {
  const database = await getDb();
  const now = Date.now();
  
  // Check slug uniqueness
  const existing = await database.select().from(skills).where(eq(skills.slug, input.slug));
  if (existing.length > 0) {
    throw new Error(`Skill with slug '${input.slug}' already exists`);
  }
  
  const skillData = {
    id: generateSkillId(),
    name: input.name,
    slug: input.slug,
    description: input.description,
    category: input.category || null,
    skillPath: input.skillPath,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    createdAt: now,
    updatedAt: now,
  };
  
  await database.insert(skills).values(skillData);
  logger.info({ skillId: skillData.id, slug: input.slug }, 'Skill created');
  
  return {
    ...skillData,
    metadata: input.metadata || null,
  };
}

export async function deleteSkill(slug: string): Promise<void> {
  const database = await getDb();
  const existing = await database.select().from(skills).where(eq(skills.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Skill '${slug}' not found`);
  }
  
  await database.delete(skills).where(eq(skills.slug, slug));
  logger.info({ slug }, 'Skill deleted');
}

// ============== MCPs CRUD ==============

export async function getAllMcps(): Promise<any[]> {
  const database = await getDb();
  const allMcps = await database.select().from(mcps);
  return allMcps.map((m: any) => ({
    ...m,
    command: m.command ? JSON.parse(m.command) : [],
    envTemplate: m.envTemplate ? JSON.parse(m.envTemplate) : null,
  }));
}

export async function getMcpBySlug(slug: string): Promise<any | null> {
  const database = await getDb();
  const result = await database.select().from(mcps).where(eq(mcps.slug, slug));
  if (result.length === 0) return null;
  const m = result[0];
  return {
    ...m,
    command: m.command ? JSON.parse(m.command) : [],
    envTemplate: m.envTemplate ? JSON.parse(m.envTemplate) : null,
  };
}

export async function createMcp(input: CreateMcpInput): Promise<any> {
  const database = await getDb();
  const now = Date.now();
  
  // Check slug uniqueness
  const existing = await database.select().from(mcps).where(eq(mcps.slug, input.slug));
  if (existing.length > 0) {
    throw new Error(`MCP with slug '${input.slug}' already exists`);
  }
  
  const mcpData = {
    id: generateMcpId(),
    name: input.name,
    slug: input.slug,
    description: input.description,
    category: input.category || null,
    serverType: input.serverType || 'local',
    command: JSON.stringify(input.command),
    envTemplate: input.envTemplate ? JSON.stringify(input.envTemplate) : null,
    requiresApiKey: input.requiresApiKey ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  };
  
  await database.insert(mcps).values(mcpData);
  logger.info({ mcpId: mcpData.id, slug: input.slug }, 'MCP created');
  
  return {
    ...mcpData,
    command: input.command,
    envTemplate: input.envTemplate || null,
    requiresApiKey: input.requiresApiKey || false,
  };
}

export async function deleteMcp(slug: string): Promise<void> {
  const database = await getDb();
  const existing = await database.select().from(mcps).where(eq(mcps.slug, slug));
  if (existing.length === 0) {
    throw new Error(`MCP '${slug}' not found`);
  }
  
  await database.delete(mcps).where(eq(mcps.slug, slug));
  logger.info({ slug }, 'MCP deleted');
}

// ============== Role Association ==============

export async function getSkillsForRole(roleSlug: string): Promise<any[]> {
  const database = await getDb();
  
  // First get role id from slug
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) return [];
  const roleId = roleResult[0].id;
  
  // Get skill IDs associated with this role
  const roleSkillResult = await database.select().from(roleSkills).where(eq(roleSkills.roleId, roleId));
  const skillIds = roleSkillResult.map((rs: any) => rs.skillId);
  
  if (skillIds.length === 0) return [];
  
  // Get all skills and filter
  const allSkills = await database.select().from(skills);
  const roleSkillList = allSkills.filter((s: any) => skillIds.includes(s.id));
  
  return roleSkillList.map((s: any) => ({
    ...s,
    metadata: s.metadata ? JSON.parse(s.metadata) : null,
  }));
}

export async function getMcpsForRole(roleSlug: string): Promise<any[]> {
  const database = await getDb();
  
  // First get role id from slug
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) return [];
  const roleId = roleResult[0].id;
  
  // Get MCP IDs associated with this role
  const roleMcpResult = await database.select().from(roleMcps).where(eq(roleMcps.roleId, roleId));
  const mcpIds = roleMcpResult.map((rm: any) => rm.mcpId);
  
  if (mcpIds.length === 0) return [];
  
  // Get all MCPs and filter
  const allMcps = await database.select().from(mcps);
  const roleMcpList = allMcps.filter((m: any) => mcpIds.includes(m.id));
  
  return roleMcpList.map((m: any) => ({
    ...m,
    command: m.command ? JSON.parse(m.command) : [],
    envTemplate: m.envTemplate ? JSON.parse(m.envTemplate) : null,
  }));
}

export async function addSkillToRole(roleSlug: string, skillSlug: string): Promise<void> {
  const database = await getDb();
  
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) throw new Error(`Role '${roleSlug}' not found`);
  
  const skillResult = await database.select().from(skills).where(eq(skills.slug, skillSlug));
  if (skillResult.length === 0) throw new Error(`Skill '${skillSlug}' not found`);
  
  // Check if already associated
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

  // Create skill directory and SKILL.md
  const skill = skillResult[0];
  const metadata = skill.metadata ? JSON.parse(skill.metadata) : {};

  const skillDir = getRoleSkillDir(roleSlug, skillSlug);
  mkdirSync(skillDir, { recursive: true });

  const skillContent = '# ' + skill.name + '\n\n' + (skill.description || '') + '\n\n' + '``` Skill metadata\n' + '- version: ' + (metadata.version || '1.0.0') + '\n' + '- license: ' + (metadata.license || 'MIT') + '\n' + '- allowedTools: ' + (metadata.allowedTools ? metadata.allowedTools.join(', ') : 'none') + '\n```\n';

  writeFileSync(join(skillDir, 'SKILL.md'), skillContent, 'utf-8');
  logger.info({ roleSlug, skillSlug }, 'Skill directory created');
  
  logger.info({ roleSlug, skillSlug }, 'Skill added to role');
}

export async function addMcpToRole(roleSlug: string, mcpSlug: string): Promise<void> {
  const database = await getDb();
  
  const roleResult = await database.select().from(roles).where(eq(roles.slug, roleSlug));
  if (roleResult.length === 0) throw new Error(`Role '${roleSlug}' not found`);
  
  const mcpResult = await database.select().from(mcps).where(eq(mcps.slug, mcpSlug));
  if (mcpResult.length === 0) throw new Error(`MCP '${mcpSlug}' not found`);
  
  // Check if already associated
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

  // Write MCP config to opencode.json
  const mcp = mcpResult[0];
  const command = mcp.command ? JSON.parse(mcp.command) : [];
  const envTemplate = mcp.envTemplate ? JSON.parse(mcp.envTemplate) : {};
  
  const opencodePath = getRoleOpenCodePath(roleSlug);
  let opencodeConfig: any = {};
  
  if (existsSync(opencodePath)) {
    try {
      const content = readFileSync(opencodePath, 'utf-8');
      opencodeConfig = JSON.parse(content);
    } catch (e) {
      logger.warn({ err: e, opencodePath }, 'Failed to parse opencode.json, creating new');
      opencodeConfig = {};
    }
  }
  
  if (!opencodeConfig.mcpServers) {
    opencodeConfig.mcpServers = {};
  }
  
  opencodeConfig.mcpServers[mcpSlug] = {
    type: mcp.serverType || 'local',
    command: command,
    env: envTemplate,
  };
  
  writeFileSync(opencodePath, JSON.stringify(opencodeConfig, null, 2), 'utf-8');
  logger.info({ roleSlug, mcpSlug }, 'MCP written to opencode.json');
  
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

  // Delete skill directory
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

  // Remove MCP from opencode.json
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
