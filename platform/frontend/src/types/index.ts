export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// User - matches backend UserResponse
export interface User {
  id: string;
  username: string;
  email: string;
  nickname?: string;
  token?: string;
}
// Skill - matches backend marketplace.go mock data
export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category?: string;
}

// Mcp - matches backend marketplace.go mock data
export interface Mcp {
  id: string;
  name: string;
  slug: string;
  description: string;
  category?: string;
}

// Role - matches backend RoleResponse
export interface Role {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  variant: string;
  status: string;
  containerId?: string;
  containerPort?: number;
  isPublic: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleFile {
  path: string;
  filename: string;
  content: string;
  language?: string;
}
