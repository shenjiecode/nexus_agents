export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string;
  apiKey?: string; // Only returned on creation
  createdAt: string;
  updatedAt: string;
  containerCount?: number;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  versions: RoleVersion[];
}

export interface RoleVersion {
  id: string;
  roleId: string;
  version: string;
  imageName: string;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface Employee {
  id: string;
  organizationId?: string;
  roleSlug: string;
  roleVersion: string;
  status: 'running' | 'stopped' | 'error' | 'pending';
  port: number;
  url: string;
  healthStatus: string;
  createdAt: string;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  description: string;
}

export interface CreateRoleRequest {
  name: string;
  slug: string;
  description: string;
}

export interface CreateEmployeeRequest {
  roleSlug: string;
  roleVersion: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface SystemStats {
  totalOrganizations: number;
  totalRoles: number;
  runningEmployees: number;
  totalEmployees: number;
}

export interface Activity {
  id: number;
  type: 'org_created' | 'role_created' | 'employee_hired' | 'employee_removed' | 'employee_status_changed';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category?: string;
  skillPath: string;
  metadata?: Record<string, unknown>;
}

export interface Mcp {
  id: string;
  name: string;
  slug: string;
  description: string;
  category?: string;
  serverType: string;
  command: string[];
  envTemplate?: Record<string, string>;
  requiresApiKey: boolean;
}