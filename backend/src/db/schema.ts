import { pgTable, text, integer, bigint } from 'drizzle-orm/pg-core';

// Organizations table
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  password: text('password').notNull(), // bcrypt hashed login password
  matrixAdminUserId: text('matrix_admin_user_id'),        // @nexus-admin-{slug}:localhost
  matrixAdminAccessToken: text('matrix_admin_access_token'), // Org admin's Matrix token
  matrixAdminPassword: text('matrix_admin_password'),       // Stored for re-login
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
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
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

// Role versions table - 角色版本历史
export const roleVersions = pgTable('role_versions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  version: text('version').notNull(),
  imageName: text('image_name').notNull(), // 该版本的镜像名
  config: text('config'), // 该版本的配置快照
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
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
  
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

// Skills table - Skills 市场技能包
export const skills = pgTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  category: text('category'), // 分类：development, analysis, writing 等
  storageKey: text('storage_key').notNull(), // OSS 对象键，如 skills/{slug}.zip
  organizationId: text('organization_id').references(() => organizations.id), // null=公共
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

// MCPs table - MCP 市场服务器
export const mcps = pgTable('mcps', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  category: text('category'), // 分类：tools, filesystem, database 等
  storageKey: text('storage_key').notNull(), // OSS 对象键，如 mcps/{slug}.json
  organizationId: text('organization_id').references(() => organizations.id), // null=公共
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});
// Marketplace Roles table - 角色模板（市场）
export const marketplaceRoles = pgTable('marketplace_roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(), // 全局唯一
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  organizationId: text('organization_id').references(() => organizations.id), // null=公共
  config: text('config'), // JSON: { mcpIds: string[], skillIds: string[], agentsMd: string }
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});



// Role Skills junction - 角色关联的 Skills
export const roleSkills = pgTable('role_skills', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  skillId: text('skill_id').notNull().references(() => skills.id),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

// Role MCPs junction - 角色关联的 MCPs
export const roleMcps = pgTable('role_mcps', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull().references(() => roles.id),
  mcpId: text('mcp_id').notNull().references(() => mcps.id),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
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
export type MarketplaceRole = typeof marketplaceRoles.$inferSelect;
export type NewMarketplaceRole = typeof marketplaceRoles.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;