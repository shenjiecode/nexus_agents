import logger from '../lib/logger.js';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync, statSync, cpSync } from 'fs';
import { join } from 'path';
import { initDatabase, employees, skills, mcps } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { downloadFile } from '../lib/oss.js';
import AdmZip from 'adm-zip';
import os from 'os';
import { mkdtempSync } from 'fs';

// ============== Types ==============

interface EmployeeConfig {
  mcpIds: string[];
  skillIds: string[];
  agentsMd: string;
}

// ============== DB Helpers ==============

async function getDb() {
  return await initDatabase();
}

async function getEmployeeRecord(id: string) {
  const db = await getDb();
  // Try employeeId first
  let result = await db.select().from(employees).where(eq(employees.id, id));
  // If not found, try containerId
  if (result.length === 0) {
    result = await db.select().from(employees).where(eq(employees.containerId, id));
  }
  if (result.length === 0) throw new Error(`Employee '${id}' not found`);
  return result[0];
}

async function updateEmployeeRecord(id: string, updates: Record<string, any>) {
  const emp = await getEmployeeRecord(id);
  const db = await getDb();
  await db.update(employees).set({ ...updates, updatedAt: Date.now() }).where(eq(employees.id, emp.id));
}

// ============== File System Helpers ==============
// All paths are relative to employee's dataPath from DB

function getOpencodeJsonPath(dataPath: string): string {
  return join(dataPath, 'opencode.json');
}

function getAgentsMdPath(dataPath: string): string {
  return join(dataPath, 'AGENTS.md');
}

function getSkillsDir(dataPath: string): string {
  return join(dataPath, '.opencode', 'skills');
}

function getSkillDir(dataPath: string, slug: string): string {
  return join(getSkillsDir(dataPath), slug);
}

function readOpencodeJson(dataPath: string): Record<string, any> {
  const path = getOpencodeJsonPath(dataPath);
  if (!existsSync(path)) return { mcp: {} };
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { mcp: {} };
  }
}

function writeOpencodeJson(dataPath: string, config: Record<string, any>): void {
  const path = getOpencodeJsonPath(dataPath);
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
  logger.info({ path }, 'opencode.json updated');
}

// ============== Public API ==============

/**
 * Get employee config (from DB + filesystem)
 */
export async function getEmployeeConfig(empId: string): Promise<{
  config: EmployeeConfig;
  installedMcps: Array<{ id: string; slug: string; name: string; config: Record<string, any> }>;
  installedSkills: Array<{ id: string; slug: string; name: string }>;
}> {
  const emp = await getEmployeeRecord(empId);
  const dataPath = emp.employeeDataPath;

  if (!dataPath) {
    throw new Error(`Employee '${empId}' has no data path`);
  }

  // Parse from separate fields
  const mcpIds: string[] = emp.mcpIds ? JSON.parse(emp.mcpIds) : [];
  const skillIds: string[] = emp.skillIds ? JSON.parse(emp.skillIds) : [];

  const db = await getDb();

  // Fetch installed MCP details
  const installedMcps: Array<{ id: string; slug: string; name: string; config: Record<string, any> }> = [];
  if (mcpIds.length > 0) {
    const opencodeConfig = readOpencodeJson(dataPath);
    for (const mcpId of mcpIds) {
      const mcpResult = await db.select().from(mcps).where(eq(mcps.id, mcpId));
      if (mcpResult.length > 0) {
        const mcp = mcpResult[0];
        // Get the actual config from opencode.json for this MCP
        const mcpConfig = opencodeConfig.mcp?.[mcp.slug] || {};
        installedMcps.push({ id: mcp.id, slug: mcp.slug, name: mcp.name, config: mcpConfig });
      }
    }
  }

  // Fetch installed Skill details
  const installedSkills: Array<{ id: string; slug: string; name: string }> = [];
  if (skillIds.length > 0) {
    for (const skillId of skillIds) {
      const skillResult = await db.select().from(skills).where(eq(skills.id, skillId));
      if (skillResult.length > 0) {
        const skill = skillResult[0];
        installedSkills.push({ id: skill.id, slug: skill.slug, name: skill.name });
      }
    }
  }

  // Read AGENTS.md from file system (not DB)
  const agentsMd = readAgentsMdFromFile(dataPath);

  return {
    config: {
      mcpIds,
      skillIds,
      agentsMd,
    },
    installedMcps,
    installedSkills,
  };
}

/**
 * Read AGENTS.md from file system
 */
function readAgentsMdFromFile(dataPath: string): string {
  const agentsPath = getAgentsMdPath(dataPath);
  if (existsSync(agentsPath)) {
    return readFileSync(agentsPath, 'utf-8');
  }
  return '';
}

/**
 * Install MCP to employee
 * - Downloads MCP JSON config from OSS
 * - Merges into employee's opencode.json mcp section
 * - Updates employee DB record
 */
export async function installMcp(empId: string, mcpId: string): Promise<void> {
  const db = await getDb();
  const emp = await getEmployeeRecord(empId);
  const dataPath = emp.employeeDataPath;

  if (!dataPath) {
    throw new Error(`Employee '${empId}' has no data path`);
  }

  // 1. Verify MCP exists
  const mcpResult = await db.select().from(mcps).where(eq(mcps.id, mcpId));
  if (mcpResult.length === 0) throw new Error(`MCP '${mcpId}' not found`);
  const mcp = mcpResult[0];

  // 2. Download MCP config from OSS
  logger.info({ empId, mcpId, mcpSlug: mcp.slug, storageKey: mcp.storageKey }, 'Downloading MCP config from OSS');
  const mcpJsonBuffer = await downloadFile(mcp.storageKey);
  let mcpConfig: Record<string, any>;
  try {
    mcpConfig = JSON.parse(mcpJsonBuffer.toString('utf-8'));
  } catch {
    throw new Error(`Invalid MCP config JSON for '${mcp.slug}'`);
  }

  // 3. Merge into employee's opencode.json
  const opencodeConfig = readOpencodeJson(dataPath);
  if (!opencodeConfig.mcp) opencodeConfig.mcp = {};
  
  // mcpConfig format: { "mcp-name": { type, command, ... } }
  // Merge each MCP entry (overwrite if same key)
  for (const [key, value] of Object.entries(mcpConfig)) {
    opencodeConfig.mcp[key] = value;
  }
  writeOpencodeJson(dataPath, opencodeConfig);

  // 4. Update employee DB record
  const currentMcpIds: string[] = emp.mcpIds ? JSON.parse(emp.mcpIds) : [];
  if (!currentMcpIds.includes(mcpId)) {
    currentMcpIds.push(mcpId);
  }
  await updateEmployeeRecord(empId, { mcpIds: JSON.stringify(currentMcpIds) });

  logger.info({ empId, mcpId, mcpSlug: mcp.slug }, 'MCP installed to employee');
}

/**
 * Uninstall MCP from employee
 * - Removes MCP entry from opencode.json
 * - Updates employee DB record
 */
export async function uninstallMcp(empId: string, mcpId: string): Promise<void> {
  const db = await getDb();
  const emp = await getEmployeeRecord(empId);
  const dataPath = emp.employeeDataPath;

  if (!dataPath) {
    throw new Error(`Employee '${empId}' has no data path`);
  }

  // 1. Get MCP info
  const mcpResult = await db.select().from(mcps).where(eq(mcps.id, mcpId));
  if (mcpResult.length === 0) throw new Error(`MCP '${mcpId}' not found`);
  const mcp = mcpResult[0];

  // 2. Remove from opencode.json
  const opencodeConfig = readOpencodeJson(dataPath);
  if (opencodeConfig.mcp && opencodeConfig.mcp[mcp.slug] !== undefined) {
    delete opencodeConfig.mcp[mcp.slug];
    writeOpencodeJson(dataPath, opencodeConfig);
  }

  // 3. Update employee DB record
  const currentMcpIds: string[] = emp.mcpIds ? JSON.parse(emp.mcpIds) : [];
  const updatedMcpIds = currentMcpIds.filter(id => id !== mcpId);
  await updateEmployeeRecord(empId, { mcpIds: JSON.stringify(updatedMcpIds) });

  logger.info({ empId, mcpId, mcpSlug: mcp.slug }, 'MCP uninstalled from employee');
}

/**
 * Install Skill to employee
 * - Downloads skill zip from OSS
 * - Extracts to .opencode/skills/{slug}/
 * - Updates employee DB record
 */
export async function installSkill(empId: string, skillId: string): Promise<void> {
  const db = await getDb();
  const emp = await getEmployeeRecord(empId);
  const dataPath = emp.employeeDataPath;

  if (!dataPath) {
    throw new Error(`Employee '${empId}' has no data path`);
  }

  // 1. Verify Skill exists
  const skillResult = await db.select().from(skills).where(eq(skills.id, skillId));
  if (skillResult.length === 0) throw new Error(`Skill '${skillId}' not found`);
  const skill = skillResult[0];

  // 2. Download skill zip from OSS
  logger.info({ empId, skillId, skillSlug: skill.slug, storageKey: skill.storageKey }, 'Downloading skill from OSS');
  const zipBuffer = await downloadFile(skill.storageKey);

  // 3. Extract to .opencode/skills/{slug}/
  const skillDir = getSkillDir(dataPath, skill.slug);
  // Remove existing if re-installing
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
  }
  mkdirSync(skillDir, { recursive: true });

  try {
    const zip = new AdmZip(zipBuffer);
    
    // Extract to temp directory first to check structure
    const tempDir = mkdtempSync(join(os.tmpdir(), 'skill-'));
    zip.extractAllTo(tempDir, true);
    
    // Recursively find the actual content directory (skip nested dirs)
    let contentDir = tempDir;
    while (true) {
      const entries = readdirSync(contentDir);
      // If only one entry and it's a directory, check if we should descend
      if (entries.length === 1) {
        const entryPath = join(contentDir, entries[0]);
        const entryStat = statSync(entryPath);
        if (entryStat.isDirectory()) {
          // Check if this directory contains actual files (not just another subdir)
          const subEntries = readdirSync(entryPath);
          const hasFiles = subEntries.some(se => {
            const seStat = statSync(join(entryPath, se));
            return seStat.isFile();
          });
          if (hasFiles || subEntries.length > 1) {
            // This subdirectory contains actual content, use it
            contentDir = entryPath;
            break;
          }
          // Keep descending
          contentDir = entryPath;
          continue;
        }
      }
      break;
    }
    
    // Copy content to skill directory
    cpSync(contentDir, skillDir, { recursive: true });
    rmSync(tempDir, { recursive: true, force: true });
    
    logger.info({ empId, skillId, skillSlug: skill.slug, skillDir }, 'Skill extracted to employee directory');
    
  } catch (error) {
    // Clean up on failure
    if (existsSync(skillDir)) {
      rmSync(skillDir, { recursive: true, force: true });
    }
    throw new Error(`Failed to extract skill '${skill.slug}': ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 4. Update employee DB record
  const currentSkillIds: string[] = emp.skillIds ? JSON.parse(emp.skillIds) : [];
  if (!currentSkillIds.includes(skillId)) {
    currentSkillIds.push(skillId);
  }
  await updateEmployeeRecord(empId, { skillIds: JSON.stringify(currentSkillIds) });

  logger.info({ empId, skillId, skillSlug: skill.slug }, 'Skill installed to employee');
}

/**
 * Uninstall Skill from employee
 * - Removes .opencode/skills/{slug}/ directory
 * - Updates employee DB record
 */
export async function uninstallSkill(empId: string, skillId: string): Promise<void> {
  const db = await getDb();
  const emp = await getEmployeeRecord(empId);
  const dataPath = emp.employeeDataPath;

  if (!dataPath) {
    throw new Error(`Employee '${empId}' has no data path`);
  }

  // 1. Get Skill info
  const skillResult = await db.select().from(skills).where(eq(skills.id, skillId));
  if (skillResult.length === 0) throw new Error(`Skill '${skillId}' not found`);
  const skill = skillResult[0];

  // 2. Remove skill directory
  const skillDir = getSkillDir(dataPath, skill.slug);
  if (existsSync(skillDir)) {
    rmSync(skillDir, { recursive: true, force: true });
    logger.info({ empId, skillId, skillSlug: skill.slug, skillDir }, 'Skill directory removed');
  }

  // 3. Update employee DB record
  const currentSkillIds: string[] = emp.skillIds ? JSON.parse(emp.skillIds) : [];
  const updatedSkillIds = currentSkillIds.filter(id => id !== skillId);
  await updateEmployeeRecord(empId, { skillIds: JSON.stringify(updatedSkillIds) });

  logger.info({ empId, skillId, skillSlug: skill.slug }, 'Skill uninstalled from employee');
}

/**
 * Update AGENTS.md content
 * - Writes directly to employee data directory file
 */
export async function updateAgentsMd(empId: string, content: string): Promise<void> {
  const emp = await getEmployeeRecord(empId);
  const dataPath = emp.employeeDataPath;

  if (!dataPath) {
    throw new Error(`Employee '${empId}' has no data path`);
  }

  // Write directly to file system
  const agentsPath = getAgentsMdPath(dataPath);
  writeFileSync(agentsPath, content, 'utf-8');
  logger.info({ empId, agentsPath }, 'AGENTS.md updated');
}

/**
 * Get AGENTS.md content - reads directly from file
 */
export async function getAgentsMd(empId: string): Promise<string> {
  const emp = await getEmployeeRecord(empId);
  const dataPath = emp.employeeDataPath;

  if (!dataPath) {
    throw new Error(`Employee '${empId}' has no data path`);
  }

  return readAgentsMdFromFile(dataPath);
}

/**
 * Apply marketplace role config to employee at hire time
 * - Installs all MCPs and Skills from role config
 * - Sets AGENTS.md if provided
 */
export async function applyRoleConfig(empId: string, roleConfig: { mcpIds?: string[]; skillIds?: string[]; agentsMd?: string }): Promise<void> {
  logger.info({ empId, mcpCount: roleConfig.mcpIds?.length || 0, skillCount: roleConfig.skillIds?.length || 0 }, 'Applying role config to employee');

  // Install MCPs
  if (roleConfig.mcpIds && roleConfig.mcpIds.length > 0) {
    for (const mcpId of roleConfig.mcpIds) {
      try {
        await installMcp(empId, mcpId);
      } catch (error) {
        logger.error({ error, empId, mcpId }, 'Failed to install MCP from role config, skipping');
      }
    }
  }

  // Install Skills
  if (roleConfig.skillIds && roleConfig.skillIds.length > 0) {
    for (const skillId of roleConfig.skillIds) {
      try {
        await installSkill(empId, skillId);
      } catch (error) {
        logger.error({ error, empId, skillId }, 'Failed to install skill from role config, skipping');
      }
    }
  }

  // Write AGENTS.md directly to file
  if (roleConfig.agentsMd) {
    await updateAgentsMd(empId, roleConfig.agentsMd);
  }
}
