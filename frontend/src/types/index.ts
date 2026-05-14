export interface Organization {
  id: number;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  containerCount?: number;
}

export interface Role {
  id: number;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  versions: RoleVersion[];
}

export interface RoleVersion {
  id: number;
  roleId: number;
  version: string;
  imageName: string;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface Container {
  id: number;
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
  roleId: number;
  roleName: string;
  roleSlug: string;
  roleVersionId: number;
  roleVersion: string;
  containerId: string;
  port: number;
  status: 'running' | 'stopped' | 'error' | 'pending';
  createdAt: string;
  updatedAt: string;
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

export interface CreateContainerRequest {
  roleId: number;
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
  runningContainers: number;
  totalContainers: number;
}

export interface Activity {
  id: number;
  type: 'org_created' | 'role_created' | 'container_hired' | 'container_removed' | 'container_status_changed';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}