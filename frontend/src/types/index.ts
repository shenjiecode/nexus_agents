export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string;
  matrixAdminUserId?: string;
  matrixAdminPassword?: string;
  createdAt: string;
  updatedAt: string;
  employeeCount?: number;
  internalRoomId?: string;
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
  marketplaceRoleId?: string;
  mcpIds?: string;
  skillIds?: string;
  createdAt: string;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  password: string;
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
  category?: string | null;
  storageKey: string;
  organizationId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Mcp {
  id: string;
  name: string;
  slug: string;
  description: string;
  category?: string | null;
  storageKey: string;
  organizationId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MarketplaceRole {
  id: string;
  name: string;
  slug: string;
  description: string;
  organizationId: string | null;
  config: {
    mcpIds: string[];
    skillIds: string[];
    agentsMd: string;
  };
  createdAt: number;
  updatedAt: number;
}
