import type { ApiResponse } from './index';
// Container - matches backend Container model
export interface Container {
  id: string;
  userId: string;
  name: string;
  description: string;
  variant: string;
  roleId?: string;
  containerId: string;
  port: number;
  sshPort: number;
  status: ContainerStatus;
  image: string;
  createdAt: string;
  updatedAt: string;
}

// ContainerStatus - matches backend container status
export type ContainerStatus = "creating" | "running" | "stopped" | "error";

// CreateContainerRequest - request for creating a new container
export interface CreateContainerRequest {
  name: string;
  description?: string;
  variant?: string;
  roleId?: string;
}

// ContainerListResponse - response for listing containers
export interface ContainerListResponse extends ApiResponse<Container[]> {}