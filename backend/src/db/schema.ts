import { pgTable, text, integer, boolean } from 'drizzle-orm/pg-core';

// Organizations table
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  apiKey: text('api_key').unique(), // Organization API key for authentication
  matrixAdminUserId: text('matrix_admin_user_id'),        // @nexus-admin-{slug}:localhost
  matrixAdminAccessToken: text('matrix_admin_access_token'), // Org admin's Matrix token
  matrixAdminPassword: text('matrix_admin_password'),       // Stored for re-login
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Roles table - 角色定义（模板）
export const roles = pgTable('roles', {
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
export const roleVersions = pgTable('role_versions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  version: text('version').notNull(),
  imageName: text('image_name').notNull(), // 该版本的镜像名
  config: text('config'), // 该版本的配置快照
  createdAt: integer('created_at').notNull(),
});

// Employees table - 数字员工（独立实体）
export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // 员工标识，如 'researcher-acme'
  name: text('name').notNull(), // 员工名称
  roleId: text('role_id').notNull().references(() => roles.id), // 角色模板
  organizationId: text('organization_id').references(() => organizations.id), // 当前所属组织（可转岗，可为空）
  containerId: text('container_id'), // 当前容器实例（0-1，解雇时为空）
  port: integer('port'), // 容器端口
  password: text('password'), // 容器密码
  status: text('status').notNull().default('stopped'), // 容器状态
  healthStatus: text('health_status').notNull().default('unknown'), // 健康状态
  memoryPath: text('memory_path'), // 记忆目录路径
  roleVersion: text('role_version').notNull().default('latest'), // 角色版本
  
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
export const skills = pgTable('skills', {
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
export const mcps = pgTable('mcps', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  category: text('category'), // 分类：tools, filesystem, database 等
  serverType: text('server_type').notNull().default('local'), // local 或 remote
  command: text('command').notNull(), // JSON: 启动命令数组
  envTemplate: text('env_template'), // JSON: 需要填写的环境变量模板
  requiresApiKey: boolean('requires_api_key').notNull().default(false), // 是否需要 API Key
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Role Skills junction - 角色关联的 Skills
export const roleSkills = pgTable('role_skills', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  skillId: text('skill_id').notNull().references(() => skills.id),
  createdAt: integer('created_at').notNull(),
});

// Role MCPs junction - 角色关联的 MCPs
export const roleMcps = pgTable('role_mcps', {
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