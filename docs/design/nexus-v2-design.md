# Nexus Agents V2 设计文档

> 版本 2.0 | 2026-05-19
> 核心理念：**官方镜像 + 配置注入**，最小化自定义构建

---

## 一、总览

### 1.1 系统定位

Nexus Agents 是一个"容器即人"的 AI Agent 管理系统。每个 AI 员工是独立运行的 Agent 实例，通过 Matrix 消息协议与用户交互。

### 1.2 V2 核心变化

| 维度 | V1 (当前) | V2 (新方案) |
|------|----------|-------------|
| **Agent 运行时** | opencode serve (Node.js) | PicoClaw (Go) |
| **镜像策略** | 自定义构建 Ubuntu + Node.js | 官方镜像 + 配置注入 |
| **镜像大小** | ~500MB | ~15MB (轻量) / ~150MB (全量) |
| **内存占用** | ~200MB | ~20MB / ~50MB |
| **交互界面** | WebUI (必需) | Channel (Telegram/Matrix 等) |
| **部署方式** | 仅 Docker | Docker + 裸机 + 嵌入式设备 |
| **配置管理** | AGENTS.md + 复杂挂载 | config.json + .security.yml + workspace |

### 1.3 设计原则

1. **官方优先**：使用官方 PicoClaw 镜像，不自建构建流水线
2. **配置注入**：通过文件注入实现定制化，无需修改镜像
3. **Channel 即界面**：通过 Matrix/Telegram 等渠道交互，WebUI 非必需
4. **多端部署**：支持容器、裸机、嵌入式设备多种部署方式
5. **敏感分离**：API keys 与配置分离，.security.yml 独立管理

### 1.4 系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           用户界面层                                     │
│         Element Web (Matrix) / Telegram / Discord / 其他 Channel         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   前端 UI    │      │    平台后端       │      │  Matrix 服务     │
│  (管理界面)  │─────▶│  (Hono API)     │◀────▶│  (Dendrite)     │
│   :13208    │      │    :13207       │      │    :8008        │
└─────────────┘      └────────┬────────┘      └────────┬────────┘
                              │                        │
                     ┌────────┴────────┐              │
                     ▼                 ▼              │
              ┌───────────┐    ┌─────────────┐        │
              │PostgreSQL │    │容器/进程管理 │        │
              │   :5433   │    │ Dockerode   │        │
              └───────────┘    └──────┬──────┘        │
                                      │               │
                              ┌───────┴───────┐       │
                              ▼               ▼      │
                     ┌─────────────┐ ┌─────────────┐ │
                     │ Agent 实例1 │ │ Agent 实例2 │ │
                     │ PicoClaw    │ │ PicoClaw    │ │
                     │ :4096       │ │ :4096       │ │
                     └──────┬──────┘ └──────┬──────┘ │
                            │               │        │
                            └───────────────┴────────┘
                                    Matrix API
```

### 1.5 组件关系

```
┌──────────────────────────────────────────────────────────────────┐
│                        平台后端 (Agent Platform)                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 组织管理      │  │ 角色模板管理   │  │ 员工生命周期   │          │
│  │ Organization │  │ RoleTemplate │  │ Employee     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Matrix 桥接   │  │ 配置生成      │  │ 部署管理      │          │
│  │ MatrixBridge │  │ ConfigGen    │  │ Deployer     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                              │
│  │ Marketplace  │  │ MCP 注册表    │                              │
│  │ Skills/MCP   │  │ MCPRegistry  │                              │
│  └──────────────┘  └──────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │        Agent 实例              │
              │  ┌─────────────────────────┐  │
              │  │ PicoClaw (官方镜像)      │  │
              │  │ - config.json           │  │
              │  │ - .security.yml         │  │
              │  │ - workspace/            │  │
              │  │   ├── AGENT.md          │  │
              │  │   ├── SOUL.md           │  │
              │  │   └── memory/            │  │
              │  └─────────────────────────┘  │
              │                               │
              │  部署方式:                     │
              │  - Docker 容器                 │
              │  - Podman 容器                 │
              │  - systemd 服务                │
              │  - 裸机二进制                   │
              └───────────────────────────────┘
```

---

## 二、Matrix 服务

### 2.1 服务概述

Matrix 是去中心化的消息协议，作为用户与 Agent 交互的主要渠道。

| 项目 | 值 |
|------|-----|
| 服务器软件 | Dendrite (Monolith) |
| 访问地址 | `http://8.217.143.228:8008` |
| Web 客户端 | Element Web @ `http://8.217.143.228:8080` |
| 数据库 | PostgreSQL 15 |
| 联邦 | 关闭（仅内部使用） |
| E2EE | 未启用 |

### 2.2 部署结构

```
/opt/matrix/
├── docker-compose.yml
├── .env
├── config/
│   ├── dendrite.yaml        # 服务器配置
│   ├── element-config.json   # Element Web 配置
│   └── matrix_key.pem       # 签名密钥
└── data/
    ├── postgres/            # 数据库
    ├── media/               # 媒体文件
    └── jetstream/           # 消息队列
```

### 2.3 端口映射

| 端口 | 服务 | 用途 |
|------|------|------|
| 8008 | Dendrite HTTP | Matrix API |
| 8448 | Dendrite HTTPS | Matrix Federation（未启用） |
| 8080 | Element Web | Web 聊天界面 |
| 5432 | PostgreSQL | 数据库（容器内部） |

### 2.4 账号管理

**注册方式**：通过 Shared Secret HMAC-SHA1 签名注册。

**账号类型**：

| 类型 | 用途 | 示例 |
|------|------|------|
| 管理账号 | 日常管理操作 | `@test-admin:8.217.143.228` |
| 测试账号 | 开发测试 | `@alice:8.217.143.228`, `@bob:...` |
| Agent 账号 | AI 员工使用 | `@agent-xxx:8.217.143.228` |

### 2.5 与 PicoClaw 集成

PicoClaw 内置 Matrix Channel 支持，配置示例：

```json
{
  "channel_list": {
    "matrix": {
      "enabled": true,
      "type": "matrix",
      "group_trigger": { "mention_only": true },
      "settings": {
        "homeserver": "http://8.217.143.228:8008",
        "user_id": "@agent-001:8.217.143.228",
        "access_token": "syt_xxx...",
        "join_on_invite": true
      }
    }
  }
}
```

**关键特性**：
- `join_on_invite: true` — 自动接受房间邀请
- `mention_only: true` — 只响应 @提及消息

### 2.6 平台层职责

平台后端负责：

1. **账号注册**：通过 Registration Secret 为新员工创建 Matrix 账号
2. **凭据存储**：保存 user_id + access_token 到数据库
3. **配置注入**：生成 PicoClaw config.json 时注入 Matrix 配置
4. **房间管理**：创建房间、邀请用户和 Agent

---

## 三、PicoClaw

### 3.1 官方镜像变体

PicoClaw 官方提供多级镜像，按需选择：

| 变体 | 基础镜像 | 包含内容 | 大小 | 适用场景 |
|------|---------|---------|------|---------|
| **base** | alpine:3.23 | PicoClaw + curl | ~15MB | 纯对话、远程 MCP |
| **full** | node:24-alpine | PicoClaw + Node.js + Python + uv | ~150MB | 本地 MCP (npx/uvx) |
| **heavy** | node:24-alpine | full + Chromium + Playwright | ~400MB | 浏览器自动化 |
| **launcher** | alpine:3.23 | PicoClaw + WebUI | ~50MB | 需要 Web 管理界面 |

**镜像地址**：
- Docker Hub: `sipeed/picoclaw`
- 支持架构: linux/amd64, linux/arm64, linux/riscv64

### 3.2 配置文件结构

PicoClaw 通过文件注入实现配置：

```
~/.picoclaw/                          # PICOCLAW_HOME 默认路径
├── config.json                       # 主配置文件
├── .security.yml                     # 敏感信息（API keys）
└── workspace/                        # Agent 工作区
    ├── AGENT.md                      # Agent 身份定义
    ├── SOUL.md                       # Agent 性格/价值观
    ├── USER.md                       # 用户信息（可选）
    └── memory/
        └── MEMORY.md                 # 长期记忆（可选）
```

### 3.3 config.json 结构

```json
{
  "version": 3,
  "agents": {
    "defaults": {
      "model_name": "glm-5",
      "max_tokens": 4096,
      "temperature": 0.7,
      "restrict_to_workspace": false
    }
  },
  "model_list": [
    {
      "model_name": "glm-5",
      "model": "openai/glm-5",
      "api_keys": ["${API_KEY}"],
      "api_base": "https://api.lkeap.cloud.tencent.com/coding/v3"
    }
  ],
  "channel_list": {
    "matrix": {
      "enabled": true,
      "type": "matrix",
      "group_trigger": { "mention_only": true },
      "settings": {
        "homeserver": "${MATRIX_URL}",
        "user_id": "${MATRIX_USER_ID}",
        "access_token": "${MATRIX_TOKEN}",
        "join_on_invite": true
      }
    }
  },
  "tools": {
    "exec": { "enabled": true },
    "web": {
      "enabled": true,
      "brave": { "api_keys": ["${BRAVE_API_KEY}"] }
    },
    "mcp": {
      "enabled": true,
      "servers": {
        "filesystem": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
        }
      }
    }
  },
  "gateway": {
    "host": "0.0.0.0",
    "port": 4096,
    "log_level": "info"
  }
}
```

### 3.4 .security.yml 结构

用于存储敏感信息，与 config.json 分离：

```yaml
model_list:
  glm-5:
    api_keys:
      - "sk-xxx"

channel_list:
  matrix:
    settings:
      access_token: "syt_xxx"

tools:
  web:
    brave:
      api_keys:
        - "bs-xxx"
```

**优势**：
- 敏感数据不进入版本控制
- 部署时独立注入
- 权限控制：`chmod 600 .security.yml`

### 3.5 环境变量覆盖

支持通过环境变量覆盖配置：

| 变量 | 作用 |
|------|------|
| `PICOCLAW_HOME` | 配置目录路径（默认 `~/.picoclaw`） |
| `PICOCLAW_CONFIG` | config.json 路径 |
| `PICOCLAW_KEY_PASSPHRASE` | SSH 密钥密码（用于加密凭据） |

### 3.6 初始化流程

PicoClaw 官方初始化逻辑（`entrypoint.sh`）：

```
容器启动
    │
    ├─ config.json 存在？
    │   ├─ 是 → 跳过 onboard，直接启动 gateway
    │   └─ 否 → workspace/ 存在？
    │       ├─ 是 → 跳过 onboard（避免交互）
    │       └─ 否 → 运行 `picoclaw onboard` 创建默认配置
    │
    └─ 启动 `picoclaw gateway`
```

**关键点**：预置 config.json → 跳过 onboard → headless 部署。

### 3.7 Workspace 文件说明

| 文件 | 作用 | 必需 |
|------|------|------|
| `AGENT.md` | Agent 身份定义（系统提示词） | 是 |
| `SOUL.md` | Agent 性格、价值观、行为准则 | 是 |
| `USER.md` | 用户信息（帮助 Agent 了解用户） | 否 |
| `memory/MEMORY.md` | 长期记忆存储 | 否 |

**注意**：当前版本 PicoClaw 可能存在身份覆盖问题（Agent 回复"我是 picoclaw 🦞"而非自定义内容），需验证 AGENT.md 的加载机制。

### 3.8 非容器部署

PicoClaw 是 Go 单二进制，支持裸机部署：

| 方式 | 说明 |
|------|------|
| **直接下载** | GitHub Release 下载对应平台的二进制 |
| **自己编译** | `go build ./cmd/picoclaw` |
| **systemd 服务** | 创建 .service 文件，`picoclaw gateway` 作为 daemon |
| **直接运行** | `picoclaw gateway` 前台运行 |

**适用场景**：
- 嵌入式设备（ARM 板、RISC-V）
- 边缘计算节点
- 不需要容器化的环境

---

## 四、平台层

### 4.1 架构设计

平台层是 Nexus Agents 的核心，负责：
- 组织与用户管理
- 角色模板管理
- 员工生命周期
- 配置生成与注入
- 部署管理

### 4.2 目录结构

```
backend/
├── src/
│   ├── api/routes/              # HTTP API
│   │   ├── organizations.ts
│   │   ├── roles.ts
│   │   ├── employees.ts
│   │   ├── sessions.ts
│   │   └── marketplace.ts
│   ├── services/
│   │   ├── org-service.ts       # 组织管理
│   │   ├── role-service.ts      # 角色模板
│   │   ├── employee-service.ts  # 员工生命周期
│   │   ├── matrix-bridge.ts     # Matrix 账号注册
│   │   ├── config-generator.ts  # PicoClaw 配置生成
│   │   ├── deployer.ts          # 部署管理
│   │   └── marketplace.ts       # Skills/MCP 市场
│   ├── integrations/
│   │   ├── docker.ts            # Docker/Podman 集成
│   │   └── matrix.ts            # Matrix API 封装
│   ├── db/
│   │   └── schema.ts            # 数据库 Schema
│   └── lib/
│       ├── logger.ts
│       └── config.ts
├── docker-compose.yml
└── .env
```

### 4.3 核心服务

#### 4.3.1 配置生成器 (config-generator.ts)

负责为每个员工生成 PicoClaw 配置：

```typescript
interface ConfigGeneratorParams {
  // 模型配置
  model: string;
  provider: string;
  apiKey: string;
  
  // Matrix 配置
  matrixUrl: string;
  matrixUserId: string;
  matrixAccessToken: string;
  
  // 角色配置
  agentMd: string;      // AGENT.md 内容
  soulMd: string;        // SOUL.md 内容
  userMd?: string;      // USER.md 内容
  
  // MCP 配置
  mcpServers?: Record<string, McpServerConfig>;
  
  // 工具配置
  tools?: ToolConfig;
}

function generatePicoclawConfig(params: ConfigGeneratorParams): {
  configJson: object;
  securityYml: string;
  workspaceFiles: Record<string, string>;
}
```

#### 4.3.2 Matrix 桥接 (matrix-bridge.ts)

负责 Matrix 账号管理：

```typescript
class MatrixBridge {
  // 为新员工注册 Matrix 账号
  async registerUser(
    username: string,
    password: string
  ): Promise<{ userId: string; accessToken: string }>;
  
  // 获取用户 Access Token
  async getAccessToken(
    userId: string,
    password: string
  ): Promise<string>;
  
  // 创建房间并邀请用户
  async createRoom(
    name: string,
    participants: string[]
  ): Promise<string>;
}
```

#### 4.3.3 部署器 (deployer.ts)

负责 Agent 实例的部署管理：

```typescript
class Deployer {
  // 创建 Agent 实例
  async deploy(params: {
    employeeId: string;
    image: 'base' | 'full' | 'heavy';
    config: PicoclawConfig;
  }): Promise<string>;  // 返回容器 ID 或进程 ID
  
  // 停止 Agent
  async stop(employeeId: string): Promise<void>;
  
  // 重启 Agent
  async restart(employeeId: string): Promise<void>;
  
  // 获取状态
  async getStatus(employeeId: string): Promise<'running' | 'stopped' | 'error'>;
  
  // 获取日志
  async getLogs(employeeId: string, lines?: number): Promise<string>;
}
```

### 4.4 员工生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│                        员工生命周期                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① 创建角色                                                      │
│     └─ 从模板选择 / 自定义                                        │
│                                                                 │
│  ② 雇佣员工                                                      │
│     ├─ 注册 Matrix 账号                                          │
│     ├─ 生成 PicoClaw 配置                                         │
│     ├─ 准备 workspace 文件                                        │
│     └─ 部署 Agent 实例                                           │
│                                                                 │
│  ③ 运行中                                                        │
│     ├─ 健康检查                                                   │
│     ├─ 日志收集                                                   │
│     └─ 会话管理                                                   │
│                                                                 │
│  ④ 配置变更                                                      │
│     ├─ 更新 config.json                                          │
│     ├─ 更新 workspace 文件                                        │
│     └─ 重启 Agent                                                │
│                                                                 │
│  ⑤ 停用/删除                                                     │
│     ├─ 停止 Agent                                                │
│     ├─ 归档数据                                                   │
│     └─ 释放资源                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 数据库 Schema

```typescript
// 组织
interface Organization {
  id: string;
  name: string;
  slug: string;
  matrixHomeserverUrl: string;
  matrixRegistrationSecret: string;
  createdAt: Date;
}

// 角色模板
interface RoleTemplate {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  
  // 配置模板
  defaultModel: string;
  defaultProvider: string;
  agentMdTemplate: string;   // AGENT.md 模板
  soulMdTemplate: string;    // SOUL.md 模板
  userMdTemplate?: string;   // USER.md 模板
  
  // 工具配置
  defaultTools: ToolConfig;
  defaultMcpServers?: Record<string, McpServerConfig>;
  
  // 元数据
  category: string;
  tags: string[];
  isPublic: boolean;
}

// 员工
interface Employee {
  id: string;
  organizationId: string;
  roleTemplateId: string;
  roleTemplateVersion: string;
  
  // 自定义配置
  name: string;
  customAgentMd?: string;
  customSoulMd?: string;
  customUserMd?: string;
  customModel?: string;
  customTools?: ToolConfig;
  customMcpServers?: Record<string, McpServerConfig>;
  
  // Matrix 凭据
  matrixUserId: string;
  matrixAccessToken: string;  // 加密存储
  matrixDeviceId: string;
  
  // 部署信息
  image: 'base' | 'full' | 'heavy';
  deploymentType: 'docker' | 'podman' | 'systemd' | 'binary';
  deploymentId?: string;      // 容器 ID 或进程 ID
  status: 'pending' | 'running' | 'stopped' | 'error';
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.6 API 端点

| 模块 | 端点 | 说明 |
|------|------|------|
| 组织 | `POST /api/organizations` | 创建组织 |
| 组织 | `GET /api/organizations/:slug` | 获取组织详情 |
| 角色 | `GET /api/roles` | 列出角色模板 |
| 角色 | `POST /api/roles` | 创建角色模板 |
| 员工 | `POST /api/orgs/:slug/employees` | 雇佣员工 |
| 员工 | `GET /api/orgs/:slug/employees` | 列出员工 |
| 员工 | `POST /api/orgs/:slug/employees/:id/start` | 启动员工 |
| 员工 | `POST /api/orgs/:slug/employees/:id/stop` | 停止员工 |
| 员工 | `DELETE /api/orgs/:slug/employees/:id` | 删除员工 |
| 会话 | `GET /api/orgs/:slug/employees/:id/sessions` | 获取会话列表 |

---

## 五、MCP 服务

### 5.1 MCP 概述

MCP (Model Context Protocol) 是工具扩展协议，PicoClaw 原生支持。

### 5.2 部署模式

#### 模式 A：本地 MCP（推荐用于 full 镜像）

Agent 容器内直接运行 MCP 服务器：

```json
{
  "tools": {
    "mcp": {
      "enabled": true,
      "servers": {
        "filesystem": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
        },
        "github": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-github"],
          "env": {
            "GITHUB_TOKEN": "${GITHUB_TOKEN}"
          }
        }
      }
    }
  }
}
```

**要求**：使用 `full` 或 `heavy` 镜像（包含 Node.js）。

#### 模式 B：远程 MCP（用于 base 镜像）

通过 HTTP/SSE 连接远程 MCP 网关：

```json
{
  "tools": {
    "mcp": {
      "enabled": true,
      "servers": {
        "web-search": {
          "url": "http://mcp-gateway:3000/mcp/web-search",
          "transport": "sse"
        }
      }
    }
  }
}
```

**MCP Gateway 架构**（Phase 2 可选）：

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Gateway                              │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Web Search  │  │ Database    │  │ API Proxy   │  ...   │
│  │ MCP Server  │  │ MCP Server  │  │ MCP Server  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ HTTP/SSE Adapter                                    │  │
│  │ - 接收 Agent 请求                                    │  │
│  │ - 转发到对应 MCP Server                              │  │
│  │ - 返回结果                                           │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 常用 MCP 服务器

| 服务器 | 用途 | 部署模式 |
|--------|------|---------|
| `@modelcontextprotocol/server-filesystem` | 文件系统操作 | 本地 |
| `@modelcontextprotocol/server-github` | GitHub API | 本地 |
| `@modelcontextprotocol/server-postgres` | PostgreSQL 查询 | 本地/远程 |
| `@modelcontextprotocol/server-web-search` | Web 搜索 | 远程 |
| 自定义 | 特定业务逻辑 | 本地/远程 |

### 5.4 平台层 MCP 管理

```typescript
interface McpRegistry {
  // 注册 MCP 服务器
  register(name: string, config: McpServerConfig): void;
  
  // 获取可用 MCP 列表
  list(): McpServerInfo[];
  
  // 为员工配置 MCP
  configureForEmployee(employeeId: string, mcps: string[]): void;
}
```

---

## 六、容器托管

### 6.1 部署方式对比

| 方式 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **Docker** | 标准服务器 | 生态完善、管理方便 | 需要 root/特权 |
| **Podman** | rootless 环境 | 无特权运行、安全 | 兼容性差异 |
| **systemd** | Linux 裸机 | 原生服务管理 | 无容器隔离 |
| **二进制** | 嵌入式/边缘 | 零依赖、最轻量 | 无隔离、手动管理 |

### 6.2 Docker 部署

```yaml
# docker-compose.yml for Agent
version: '3.8'
services:
  agent-001:
    image: sipeed/picoclaw:full
    container_name: agent-001
    restart: unless-stopped
    volumes:
      - ./data/agent-001/config.json:/root/.picoclaw/config.json:ro
      - ./data/agent-001/.security.yml:/root/.picoclaw/.security.yml:ro
      - ./data/agent-001/workspace:/root/.picoclaw/workspace
    environment:
      - PICOCLAW_HOME=/root/.picoclaw
    ports:
      - "4096:4096"  # Gateway API
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4096/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 6.3 systemd 部署

```ini
# /etc/systemd/system/picoclaw-agent@.service
[Unit]
Description=PicoClaw Agent %i
After=network.target

[Service]
Type=simple
User=picoclaw
WorkingDirectory=/opt/picoclaw/agents/%i
Environment=PICOCLAW_HOME=/opt/picoclaw/agents/%i
ExecStart=/usr/local/bin/picoclaw gateway
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动：`systemctl enable --now picoclaw-agent@001`

### 6.4 配置注入流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      配置注入流程                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① 用户请求雇佣员工                                              │
│     │                                                           │
│     ▼                                                           │
│  ② 平台后端处理                                                  │
│     ├─ 注册 Matrix 账号                                          │
│     ├─ 从角色模板获取配置模板                                     │
│     ├─ 合并用户自定义配置                                         │
│     └─ 生成最终配置                                              │
│     │                                                           │
│     ▼                                                           │
│  ③ 生成配置文件                                                  │
│     ├─ config.json (主配置)                                     │
│     ├─ .security.yml (API keys)                                 │
│     └─ workspace/                                               │
│         ├─ AGENT.md                                             │
│         ├─ SOUL.md                                              │
│         └─ USER.md                                              │
│     │                                                           │
│     ▼                                                           │
│  ④ 部署 Agent                                                   │
│     ├─ Docker: 挂载配置目录                                      │
│     ├─ Podman: 同上                                             │
│     ├─ systemd: 写入 /opt/picoclaw/agents/{id}/                  │
│     └─ 二进制: 写入指定目录                                       │
│     │                                                           │
│     ▼                                                           │
│  ⑤ 启动并验证                                                    │
│     ├─ 等待健康检查通过                                          │
│     ├─ Agent 连接 Matrix                                        │
│     └─ 自动接受房间邀请                                          │
│     │                                                           │
│     ▼                                                           │
│  ⑥ 员工就绪                                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 镜像选择策略

| 场景 | 推荐镜像 | 理由 |
|------|---------|------|
| 纯对话 Agent（无本地工具） | base | 最轻量，资源占用低 |
| 需要本地 MCP (npx/uvx) | full | 包含 Node.js + Python |
| 需要浏览器自动化 | heavy | 包含 Playwright |
| 需要 Web 管理界面 | launcher | 包含 WebUI |

### 6.6 运维管理

```bash
# 查看员工状态
GET /api/orgs/:slug/employees/:id/status

# 查看日志
GET /api/orgs/:slug/employees/:id/logs?lines=100

# 重启员工
POST /api/orgs/:slug/employees/:id/restart

# 更新配置并重启
PATCH /api/orgs/:slug/employees/:id
{
  "customModel": "glm-5"
}
```

### 6.7 监控告警

| 指标 | 告警阈值 | 处理 |
|------|---------|------|
| Agent 进程退出 | 任何退出 | 自动重启 + 通知 |
| 健康检查失败 | 连续 3 次 | 重启 + 通知 |
| Matrix 连接断开 | > 5 分钟 | 重启 Agent |
| 内存使用 | > 80% | 告警 + 扩容 |

---

## 七、实施计划

### Phase 0: 验证（1-2 天）

- [ ] 验证官方镜像 base/full/heavy 功能
- [ ] 验证 config.json + .security.yml 注入
- [ ] 验证 Matrix Channel 配置
- [ ] 验证 AGENT.md 加载（确认身份覆盖问题）
- [ ] 验证非容器部署（二进制 + systemd）

### Phase 1: 平台核心（3-5 天）

- [ ] 重构 config-generator.ts
- [ ] 重构 matrix-bridge.ts
- [ ] 重构 deployer.ts（支持 Docker/Podman/systemd）
- [ ] 更新数据库 Schema
- [ ] 更新 API 端点

### Phase 2: 集成测试（2-3 天）

- [ ] 端到端测试：雇佣 → 部署 → 对话
- [ ] 多部署方式测试
- [ ] 配置变更测试
- [ ] 错误恢复测试

### Phase 3: MCP 集成（2-3 天）

- [ ] 本地 MCP 配置验证
- [ ] MCP Gateway 设计（可选）
- [ ] Skills 市场集成

---

## 八、风险与缓解

| 风险 | 严重度 | 缓解措施 |
|------|--------|---------|
| PicoClaw pre-v1.0 API 变更 | 高 | 锁定版本，保留回退方案 |
| AGENT.md 身份覆盖问题 | 中 | 调研官方机制，必要时提 issue |
| Matrix Channel 不稳定 | 中 | 充分测试，准备降级方案 |
| 非 Docker 部署管理复杂 | 低 | 优先 Docker，其他方式按需支持 |

---

## 九、附录

### A. LLM Provider 配置

| Provider | API Base | 模型 |
|----------|---------|------|
| tencent-coding-plan | `https://api.lkeap.cloud.tencent.com/coding/v3` | glm-5, kimi-k2.5, hunyuan-t1 |
| zhipuai | `https://open.bigmodel.cn/api/paas/v4` | glm-4, glm-4-plus |

### B. Matrix 配置参考

详见 `docs/matrix-info.md`。

### C. PicoClaw 官方文档

- GitHub: https://github.com/nicholasxuu/picoclaw
- Docker Hub: https://hub.docker.com/r/sipeed/picoclaw
