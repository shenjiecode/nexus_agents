import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Organizations table
export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  apiKey: text('api_key').unique(), // Organization API key for authentication
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Roles table - 角色定义（模板）
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // 简短标识符，如 "researcher"
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull().default('1.0.0'), // 当前版本
  imageName: text('image_name'), // 镜像名称，如 "nexus-role-researcher"
  config: text('config'), // JSON string - 角色完整配置
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Role versions table - 角色版本历史
export const roleVersions = sqliteTable('role_versions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  version: text('version').notNull(),
  imageName: text('image_name').notNull(), // 该版本的镜像名
  config: text('config'), // 该版本的配置快照
  createdAt: integer('created_at').notNull(),
});

// Containers table - 组织雇佣的角色实例（数字员工）
export const containers = sqliteTable('containers', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  roleVersion: text('role_version').notNull().default('latest'), // 使用的角色版本
  containerId: text('container_id').notNull(), // Docker/Podman 容器ID
  port: integer('port').notNull(),
  password: text('password'), // OpenCode server password
  status: text('status').notNull(),
  healthStatus: text('health_status').notNull(),
  memoryPath: text('memory_path'), // 记忆目录路径
  createdAt: integer('created_at').notNull(),
});

// Sessions table - 会话
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  containerId: text('container_id').notNull().references(() => containers.id),
  opencodeSessionId: text('opencode_session_id').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
});

// Employees table - 数字员工（独立实体）
export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // 员工标识，如 'researcher-acme'
  name: text('name').notNull(), // 员工名称
  roleId: text('role_id').notNull().references(() => roles.id), // 角色模板
  organizationId: text('organization_id').references(() => organizations.id), // 当前所属组织（可转岗，可为空）
  containerId: text('container_id').references(() => containers.id), // 当前容器实例（0-1，解雇时为空）
  
  // 员工数据路径
  employeeDataPath: text('employee_data_path'), // data/employees/{empId}
  
  // Matrix 账号信息（员工级，跨组织保持）
  matrixUserId: text('matrix_user_id').unique(), // @user:homeserver
  matrixAccessToken: text('matrix_access_token'),
  matrixDeviceId: text('matrix_device_id'),
  matrixPassword: text('matrix_password'), // 存储密码以便重新登录
  matrixHomeserverUrl: text('matrix_homeserver_url'), // Matrix 服务器地址
  
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Skills table - Skills 市场技能包
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  category: text('category'), // 分类：development, analysis, writing 等
  skillPath: text('skill_path').notNull(), // .opencode/skills/{slug}/ 路径
  metadata: text('metadata'), // JSON: version, license, allowed-tools 等
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// MCPs table - MCP 市场服务器
export const mcps = sqliteTable('mcps', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  category: text('category'), // 分类：tools, filesystem, database 等
  serverType: text('server_type').notNull().default('local'), // local 或 remote
  command: text('command').notNull(), // JSON: 启动命令数组
  envTemplate: text('env_template'), // JSON: 需要填写的环境变量模板
  requiresApiKey: integer('requires_api_key').notNull().default(0), // 是否需要 API Key
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Role Skills junction - 角色关联的 Skills
export const roleSkills = sqliteTable('role_skills', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  skillId: text('skill_id').notNull().references(() => skills.id),
  createdAt: integer('created_at').notNull(),
});

// Role MCPs junction - 角色关联的 MCPs
export const roleMcps = sqliteTable('role_mcps', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  mcpId: text('mcp_id').notNull().references(() => mcps.id),
  createdAt: integer('created_at').notNull(),
});

// Type exports
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type RoleVersion = typeof roleVersions.$inferSelect;
export type NewRoleVersion = typeof roleVersions.$inferInsert;
export type Container = typeof containers.$inferSelect;
export type NewContainer = typeof containers.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type Mcp = typeof mcps.$inferSelect;
export type NewMcp = typeof mcps.$inferInsert;
export type RoleSkill = typeof roleSkills.$inferSelect;
export type NewRoleSkill = typeof roleSkills.$inferInsert;
export type RoleMcp = typeof roleMcps.$inferSelect;
export type NewRoleMcp = typeof roleMcps.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
