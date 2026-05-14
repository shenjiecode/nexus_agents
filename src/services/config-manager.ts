import { z } from 'zod';
import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

// Zod schemas for validation
const PromptConfigSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
});

const SkillConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

const RoleConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  prompts: z.record(z.string(), PromptConfigSchema).optional(),
  skills: z.record(z.string(), SkillConfigSchema).optional(),
});

// Auth config matches OpenCode standard format
const AuthProviderSchema = z.object({
  type: z.literal('api'),
  key: z.string().min(1),
});

const AuthConfigSchema = z.record(z.string(), AuthProviderSchema);

export type RoleConfig = z.infer<typeof RoleConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// Base paths
const ROLES_BASE_DIR = 'roles';

function getRoleDir(slug: string): string {
  return join(ROLES_BASE_DIR, slug);
}

function getOpenCodeConfigPath(slug: string): string {
  return join(getRoleDir(slug), 'opencode.json');
}

function getPromptsDir(slug: string): string {
  return join(getRoleDir(slug), 'prompts');
}

function getSkillsDir(slug: string): string {
  return join(getRoleDir(slug), '.opencode', 'skills');
}

function getAuthConfigPath(slug: string): string {
  return join(getRoleDir(slug), 'auth.json');
}

function getDockerfilePath(slug: string): string {
  return join(getRoleDir(slug), 'Dockerfile');
}

/**
 * Generate Dockerfile for role
 */
function generateDockerfile(slug: string): string {
  return `# Auto-generated Dockerfile for role: ${slug}
# Build: podman build -t nexus-role-${slug}:v1.0.0 .

# Use base image (pre-built with OpenCode CLI)
ARG BASE_IMAGE=localhost/nexus-base:latest
FROM \${BASE_IMAGE}

# Copy role configuration
COPY opencode.json /app/opencode.json
COPY prompts/ /app/prompts/
COPY .opencode/ /app/.opencode/

# Note: auth.json is mounted at runtime, not baked into image
# Set working directory
WORKDIR /workspace

# Expose OpenCode Serve port
EXPOSE 4096

# Entrypoint is inherited from base image
`;
}

/**
 * Generate role configuration files
 * Creates directory structure and config files for a role
 */
export function generateRoleConfig(slug: string, config: RoleConfig): void {
  // Validate config
  const validated = RoleConfigSchema.parse(config);

  const roleDir = getRoleDir(slug);
  const promptsDir = getPromptsDir(slug);
  const skillsDir = getSkillsDir(slug);

  // Create directories
  mkdirSync(roleDir, { recursive: true });
  mkdirSync(promptsDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });

  // Write opencode.json
  const opencodeConfig = {
    name: validated.name,
    description: validated.description || '',
    version: '1.0.0',
  };
  writeFileSync(
    getOpenCodeConfigPath(slug),
    JSON.stringify(opencodeConfig, null, 2),
    'utf-8'
  );

  // Write prompt files
  if (validated.prompts) {
    for (const [promptName, promptConfig] of Object.entries(validated.prompts)) {
      const promptPath = join(promptsDir, `${promptName}.txt`);
      writeFileSync(promptPath, promptConfig.content, 'utf-8');
    }
  }

  // Write skill files
  if (validated.skills) {
    for (const [skillName, skillConfig] of Object.entries(validated.skills)) {
      const skillDir = join(skillsDir, skillName);
      mkdirSync(skillDir, { recursive: true });
      const skillPath = join(skillDir, 'SKILL.md');
      const skillContent = `# ${skillConfig.name}\n\n${skillConfig.description}\n`;
      writeFileSync(skillPath, skillContent, 'utf-8');
    }
  }

  // Write auth.json from environment (OpenCode standard format)
  const providerName = process.env.OPENCODE_PROVIDER_NAME || 'tencent-coding-plan';
  const apiKey = process.env.OPENCODE_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    const authConfig = {
      [providerName]: {
        type: 'api' as const,
        key: apiKey,
      },
    };
    writeFileSync(
      getAuthConfigPath(slug),
      JSON.stringify(authConfig, null, 2),
      'utf-8'
    );
  }

  // Write Dockerfile
  writeFileSync(
    getDockerfilePath(slug),
    generateDockerfile(slug),
    'utf-8'
  );
}

/**
 * Update role configuration files
 */
export function updateRoleConfigFiles(slug: string, updates: Partial<RoleConfig>): void {
  const configPath = getOpenCodeConfigPath(slug);

  if (!existsSync(configPath)) {
    throw new Error(`Role config not found: ${slug}`);
  }

  // Read existing config
  const existingContent = readFileSync(configPath, 'utf-8');
  const existing = JSON.parse(existingContent);

  // Validate and merge
  const validated = RoleConfigSchema.parse({ ...existing, ...updates });
  const merged = { ...existing, ...validated };

  // Write updated config
  writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');

  // Update prompts if provided
  if (updates.prompts) {
    const promptsDir = getPromptsDir(slug);
    mkdirSync(promptsDir, { recursive: true });
    for (const [promptName, promptConfig] of Object.entries(updates.prompts)) {
      const promptPath = join(promptsDir, `${promptName}.txt`);
      writeFileSync(promptPath, promptConfig.content, 'utf-8');
    }
  }

  // Update skills if provided
  if (updates.skills) {
    const skillsDir = getSkillsDir(slug);
    for (const [skillName, skillConfig] of Object.entries(updates.skills)) {
      const skillDir = join(skillsDir, skillName);
      mkdirSync(skillDir, { recursive: true });
      const skillPath = join(skillDir, 'SKILL.md');
      const skillContent = `# ${skillConfig.name}\n\n${skillConfig.description}\n`;
      writeFileSync(skillPath, skillContent, 'utf-8');
    }
  }
}

/**
 * Delete role configuration
 */
export function deleteRoleConfig(slug: string): void {
  const roleDir = getRoleDir(slug);

  if (!existsSync(roleDir)) {
    throw new Error(`Role config not found: ${slug}`);
  }

  rmSync(roleDir, { recursive: true, force: true });
}

/**
 * Initialize container memory directory
 */
export function initContainerMemory(orgSlug: string, containerId: string): string {
  const memoryPath = join(process.cwd(), 'data', 'orgs', orgSlug, 'containers', containerId);
  
  // Create directories
  mkdirSync(join(memoryPath, 'memory'), { recursive: true });
  mkdirSync(join(memoryPath, 'docs'), { recursive: true });

  // Initialize AGENTS.md template
  const agentsContent = `# Digital Employee Memory

## Basic Information
- Container ID: ${containerId}
- Organization: ${orgSlug}
- Created: ${new Date().toISOString()}

## Work Records
<!-- AI will automatically append work summaries here -->

`;

  writeFileSync(join(memoryPath, 'AGENTS.md'), agentsContent, 'utf-8');

  return memoryPath;
}
