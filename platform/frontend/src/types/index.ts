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
  userId?: string;
  storageKey?: string;
  size?: number;
  isPublic?: string;
}

// Mcp - matches backend marketplace.go mock data
export interface Mcp {
  id: string;
  name: string;
  slug: string;
  description: string;
  category?: string;
  userId?: string;
  storageKey?: string;
  size?: number;
  isPublic?: string;
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
  modifiedAt?: string;  // 本地修改时间
  uploadedAt?: string;  // OSS 上传时间
  createdAt: string;
  updatedAt: string;
}

export interface RoleFile {
  path: string;
  filename: string;
  content: string;
  language?: string;
}

// MarketplaceRole - matches backend marketplace_roles table
export interface MarketplaceRole {
  id: string;
  name: string;
  description?: string;
  storageKey: string;
  size: number;
  createdAt: string;
  updatedAt?: string;
  author?: string;
}

// Picoclaw config.json types
export interface PicoclawConfig {
  version: number;
  agents: {
    defaults: PicoclawAgentDefaults;
  };
  model_list: PicoclawModelConfig[];
  channel_list: Record<string, PicoclawChannelConfig>;
  gateway?: PicoclawGatewayConfig;
  tools?: Record<string, unknown>;
  heartbeat?: Record<string, unknown>;
  hooks?: Record<string, unknown>;
  session?: Record<string, unknown>;
  isolation?: Record<string, unknown>;
}

export interface PicoclawAgentDefaults {
  model_name: string;
  max_tokens: number;
  temperature?: number;
  max_tool_iterations?: number;
  workspace?: string;
  restrict_to_workspace?: boolean;
  summarize_message_threshold?: number;
  summarize_token_percent?: number;
  steering_mode?: string;
  skills?: string[];
  mcp_servers?: string[];
}

export interface PicoclawModelConfig {
  model_name: string;
  provider: string;
  model: string;
  api_base?: string;
  api_keys?: string[];
}

export interface PicoclawChannelConfig {
  enabled: boolean;
  type: string;
  settings?: Record<string, unknown>;
}

export interface PicoclawGatewayConfig {
  host: string;
  port: number;
}

// Picoclaw .security.yml types
export interface PicoclawSecurity {
  channel_list?: Record<string, { settings?: { token?: string; [key: string]: unknown } }>;
  model_list?: Record<string, { api_keys?: string[] }>;
}
