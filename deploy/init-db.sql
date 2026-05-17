-- Nexus Agents Database Schema

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  password TEXT NOT NULL,
  matrix_admin_user_id TEXT,
  matrix_admin_access_token TEXT,
  matrix_admin_password TEXT,
  internal_room_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id),
  container_id TEXT,
  port INTEGER,
  password TEXT,
  status TEXT NOT NULL DEFAULT 'stopped',
  health_status TEXT NOT NULL DEFAULT 'unknown',
  memory_path TEXT,
  role_version TEXT NOT NULL DEFAULT 'latest',
  employee_data_path TEXT,
  marketplace_role_id TEXT,
  mcp_ids TEXT,
  skill_ids TEXT,
  agents_content TEXT,
  matrix_user_id TEXT UNIQUE,
  matrix_access_token TEXT,
  matrix_device_id TEXT,
  matrix_password TEXT,
  matrix_homeserver_url TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT,
  storage_key TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT,
  storage_key TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id),
  config TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);