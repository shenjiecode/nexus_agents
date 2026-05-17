# Nexus Agents

"容器即人" - AI Agent Container Management System

---

## 一、项目概述

**Nexus Agents** 是一个"容器即人"的 AI Agent 容器管理系统。核心概念是将每个 AI 员工封装为独立容器，通过 Matrix 消息协议与用户交互。

### 核心价值

- **组织化管理**：多租户架构，每个组织独立管理员工
- **容器化员工**：每个员工运行在独立 Docker 容器中
- **Matrix 消息协议**：实时双向通信
- **Marketplace**：技能包/MCP 服务器市场

---

## 二、系统架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              用户浏览器                                    │
│                    http://localhost:13208                                 │
│                    Element Web: http://localhost:8080                     │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Frontend  │      │    Backend      │      │ Matrix Server   │
│   :13208    │─────▶│    :13207       │◀────▶│    :8008        │
│ React+Vite  │ API  │ Hono+Drizzle    │      │ Dendrite       │
└─────────────┘      └────────┬────────┘      └────────┬────────┘
                              │                        │
                     ┌────────┴────────┐              │
                     ▼                 ▼              │
              ┌───────────┐    ┌─────────────┐        │
              │PostgreSQL │    │Docker/Podman│        │
              │   :5433   │    │  Socket     │        │
              └───────────┘    └──────┬──────┘        │
                                      │               │
                              ┌───────┴───────┐       │
                              ▼               ▼      │
                     ┌─────────────┐ ┌─────────────┐ │
                     │ Agent 容器1 │ │ Agent 容器2 │ │
                     │ opencode    │ │ opencode    │ │
                     │ :4096       │ │ :4096       │ │
                     └──────┬──────┘ └──────┬──────┘ │
                            │               │        │
                            └───────────────┴────────┘
                                    Matrix API
```

### 消息流程

```
用户雇佣角色
    → Backend 注册 Matrix 账户
    → 写入 employees 表
    → 创建 Docker 容器（注入 MATRIX_* 环境变量）
    → 容器启动：opencode serve + agent.ts
    → 用户邀请 agent 进入 Matrix 房间 → agent 自动接受
    → 用户发消息 → agent 转发到 opencode → 回复到 Matrix 房间
```

---

## 三、模块详解

### 3.1 Frontend（前端）

| 项目 | 说明 |
|------|------|
| 路径 | `frontend/` |
| 端口 | `13208` |
| 技术栈 | React 18 + TypeScript + Vite + Tailwind CSS + React Router v6 |

**核心功能**：
- Dashboard：系统统计、快捷操作
- Organizations：组织管理
- Roles：角色模板管理
- Employees：员工生命周期管理
- Marketplace：技能包/MCP 市场

**目录结构**：
```
frontend/src/
├── components/    # CyberCard, CyberButton, CyberModal, StatusDot, Sidebar
├── pages/         # Dashboard, Organizations, OrganizationDetail, Roles, Containers
├── hooks/         # useApi
└── types/         # TypeScript 类型定义
```

**设计主题**：赛博朋克风格
- 背景：深色渐变 `#0A0A0F` → `#1E1E2E`
- 主色调：霓虹青 `#00D9FF`
- 次色调：霓虹紫 `#8B5CF6`

---

### 3.2 Backend（后端）

| 项目 | 说明 |
|------|------|
| 路径 | `backend/` |
| 端口 | `13207` |
| 技术栈 | Hono + Drizzle ORM + PostgreSQL + Pino + Dockerode |

**核心功能**：
- 组织 CRUD + Auth 配置
- 角色模板管理 + 版本控制
- 员工生命周期（雇佣/启停/删除）
- AI 对话会话管理
- Marketplace（Skills/MCP）

**目录结构**：
```
backend/src/
├── api/routes/    # 6 个路由模块
├── db/            # Drizzle schema + 连接
├── services/      # 7 个业务服务
├── integrations/  # OpenCode 集成
└── lib/           # Pino 日志
```

**API 路由**：

| 模块 | 路径前缀 | 说明 |
|------|---------|------|
| Organizations | `/api/organizations` | 组织 CRUD + Auth 配置 |
| Roles | `/api/roles` | 角色模板管理 + 版本 |
| Employees | `/api/orgs/:slug/employees` | 员工生命周期 |
| Sessions | `/api/orgs/:slug/employees/:id/sessions` | AI 对话会话 |
| Marketplace | `/api/skills`, `/api/mcps` | 技能/MCP 市场 |

---

### 3.3 Agent Container（Agent 容器）

| 项目 | 说明 |
|------|------|
| 路径 | `agent/` |
| 端口 | `4096`（容器内） |
| 技术栈 | Node.js 24 + opencode-ai + 原生 fetch |

**架构**：
```
┌─────────────────────────────────────────────┐
│                  Container                   │
│                                              │
│  opencode serve (常驻运行, port 4096)         │
│        ↕ HTTP API                            │
│  agent.ts (Matrix client, 原生 fetch)        │
│        ↕ Matrix sync                         │
│  Matrix Homeserver (外部)                    │
└─────────────────────────────────────────────┘
```

**核心文件**：
```
agent/src/
├── agent.ts         # Matrix 客户端 (原生 fetch)
├── serve-client.ts  # OpenCode API 客户端
├── config.ts        # 配置加载
├── types.ts         # 类型定义
└── logger.ts        # 日志模块
```

**设计决策**：使用原生 fetch 而非 Matrix SDK
- SDK 的核心价值是 E2EE，但本项目不需要
- 仅使用 4 个 Matrix API：`sync`, `join`, `send`, `typing`
- 依赖数量：SDK 235 packages → 原生 fetch 39 packages

---

### 3.4 Matrix Server（消息服务）

| 项目 | 说明 |
|------|------|
| 路径 | `matrix/` |
| 端口 | Dendrite `8008/8448`, Element Web `8080`, PostgreSQL `5432` |
| 技术栈 | Dendrite + PostgreSQL + Element Web |

**服务组成**：

| 服务 | 端口 | 说明 |
|------|------|------|
| Dendrite | 8008 (HTTP) / 8448 (HTTPS) | Matrix Homeserver |
| PostgreSQL | 5432 | 数据库 |
| Element Web | 8080 | Web 聊天客户端 |

**目录结构**：
```
matrix/
├── docker-compose.yml     # 容器编排
├── config/
│   ├── dendrite.yaml      # Dendrite 服务器配置
│   ├── element-config.json # Element Web 客户端配置
│   └── matrix_key.pem     # 签名密钥（首次启动自动生成）
└── data/
    ├── postgres/          # PostgreSQL 数据
    ├── media/             # 媒体文件
    └── jetstream/         # Dendrite 消息队列
```

---

### 3.5 Images（容器镜像）

| 路径 | 说明 |
|------|------|
| `images/base/` | 基础镜像：Ubuntu 24.04 + Node.js 24 + opencode-ai |
| `images/role/` | 角色镜像模板 |

**基础镜像内容**：
- Ubuntu 24.04
- Node.js 24 (nodesource)
- 全局工具：opencode-ai, tsx
- 工作目录：/workspace
- 入口脚本：entrypoint.sh

---

## 四、关键技术

### 4.1 数据库 Schema

**核心表**：

| 表名 | 说明 |
|------|------|
| `organizations` | 组织表：id, name, slug, password, matrix credentials |
| `employees` | 员工表：id, slug, organizationId, containerId, status, matrix credentials |
| `skills` | 技能包：id, name, slug, category, storageKey |
| `mcps` | MCP 服务器：id, name, slug, category, storageKey |
| `marketplace_roles` | 角色模板：id, name, slug, config(JSON) |

### 4.2 技术选型对比

| 领域 | 选择 | 原因 |
|------|------|------|
| 后端框架 | Hono | 轻量级、类型安全、边缘友好 |
| ORM | Drizzle | 类型安全、轻量、无运行时开销 |
| Matrix 客户端 | 原生 fetch | 无 native 依赖、构建简单 |
| 日志 | Pino | 结构化日志、高性能 |
| 容器管理 | Dockerode | 纯 JS、Docker/Podman 兼容 |

---

## 五、部署方案

### 5.1 Matrix Server（独立部署）

```powershell
cd matrix

# 首次初始化（生成配置）
.\init.ps1

# 启动服务
docker-compose up -d

# 验证
docker-compose ps
```

**访问地址**：
- Element Web: http://localhost:8080
- Dendrite API: http://localhost:8008

---

### 5.2 Backend（本地开发）

```powershell
cd backend

# 1. 启动 PostgreSQL 依赖
docker-compose up -d

# 2. 同步数据库表结构
pnpm db:push

# 3. 启动开发服务器（热重载）
pnpm dev                 # http://localhost:13207
```

**生产部署**：
```powershell
pnpm build
node dist/index.js
```

---

### 5.3 Frontend（本地开发）

```powershell
cd frontend
pnpm dev                 # http://localhost:13208
```

**生产构建**：
```powershell
pnpm build
pnpm preview             # 预览生产构建
```

---

### 5.4 Agent 容器（运行时创建）

**不需要手动部署**。Backend 通过 Dockerode 在用户"雇佣员工"时自动创建：

1. 构建角色镜像：`nexus-role-{slug}:{version}`
2. 创建容器，注入 Matrix 凭据和环境变量
3. 容器启动：`opencode serve` + `agent.ts`

**手动构建基础镜像**：
```powershell
docker build -t localhost/nexus-base:latest images/base/
```

---

### 5.5 完整启动流程

```powershell
# 1. 安装依赖（项目根目录）
pnpm install

# 2. 启动 Matrix（独立终端）
cd matrix && docker-compose up -d && cd ..

# 3. 启动 Backend（独立终端）
cd backend && docker-compose up -d && pnpm db:push && pnpm dev

# 4. 启动 Frontend（独立终端）
cd frontend && pnpm dev
```

或使用根目录脚本：
```powershell
# 同时启动 Backend + Frontend
pnpm dev:all
```

---

## 六、配置说明

### 6.1 环境变量总览

| 变量 | 所属模块 | 说明 | 默认值 |
|------|---------|------|--------|
| `PORT` | Backend | 后端端口 | `13207` |
| `DATABASE_URL` | Backend | PostgreSQL 连接 | `postgresql://nexus:nexussecret@localhost:5433/nexus` |
| `LOG_LEVEL` | Backend | 日志级别 | `info` |
| `NODE_ENV` | Backend | 环境 | `development` |
| `DOCKER_HOST` | Backend | Docker socket | `/var/run/docker.sock` |
| `MATRIX_HOMESERVER_URL` | Backend/Agent | Matrix 服务器 | `http://localhost:8008` |
| `MATRIX_REGISTRATION_SECRET` | Backend | Matrix 注册密钥 | `dev-secret-change-in-production` |
| `OPENCODE_PROVIDER_NAME` | Backend | AI Provider | `tencent-coding-plan` |
| `OPENCODE_API_KEY` | Backend | AI API Key | - |
| `MATRIX_ACCESS_TOKEN` | Agent | Matrix 访问令牌 | - |
| `MATRIX_USER_ID` | Agent | Matrix 用户 ID | - |
| `OPENCODE_BASE_URL` | Agent | OpenCode API 地址 | `http://localhost:4096` |

### 6.2 配置文件示例

**Backend `.env`**：
```env
# OpenCode Provider
OPENCODE_PROVIDER_NAME=tencent-coding-plan
OPENCODE_API_KEY=sk-sp-xxxxxxxx

# Matrix
MATRIX_HOMESERVER_URL=http://localhost:8008
MATRIX_REGISTRATION_SECRET=dev-secret-change-in-production

# Database
DATABASE_URL=postgresql://nexus:nexussecret@localhost:5433/nexus
```

**Matrix `dendrite.yaml` 关键配置**：
```yaml
global:
  server_name: localhost
  disable_federation: true

client_api:
  registration_disabled: true
  registration_shared_secret: "dev-secret-change-in-production"
```

**Matrix 环境变量**：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `POSTGRES_USER` | dendrite | 数据库用户 |
| `POSTGRES_PASSWORD` | itsasecret | 数据库密码 |
| `POSTGRES_DB` | dendrite | 数据库名 |
| `DENDRITE_HTTP_PORT` | 8008 | Dendrite HTTP 端口 |
| `ELEMENT_PORT` | 8080 | Element Web 端口 |

### 6.3 端口汇总

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 13208 | React + Vite |
| Backend | 13207 | Hono API |
| Backend PostgreSQL | 5433 | 业务数据库 |
| Matrix Dendrite | 8008 | Matrix Homeserver |
| Matrix PostgreSQL | 5432 | Matrix 数据库 |
| Element Web | 8080 | Matrix 客户端 |
| Agent 容器 | 4096 | opencode serve |

---

## 七、项目结构

```
nexus_agents/
├── frontend/              # React 前端 (@nexus/frontend)
│   ├── src/
│   │   ├── components/    # 通用组件 (CyberCard, CyberButton...)
│   │   ├── pages/         # 页面 (Dashboard, Organizations...)
│   │   ├── hooks/         # useApi
│   │   └── types/         # TS 类型定义
│   └── vite.config.ts     # API 代理 → localhost:13207
│
├── backend/               # Hono API 服务 (@nexus/backend)
│   ├── src/
│   │   ├── api/routes/    # 6 个路由模块
│   │   ├── db/            # Drizzle schema + 连接
│   │   ├── services/      # 7 个业务服务
│   │   ├── integrations/  # OpenCode 集成
│   │   └── lib/           # Pino 日志
│   ├── docker-compose.yml # 开发用 PostgreSQL
│   ├── drizzle.config.ts  # Drizzle Kit 配置
│   └── .env               # 环境变量
│
├── agent/                 # 容器内 Agent 程序
│   └── src/
│       ├── agent.ts       # Matrix 客户端 (原生 fetch)
│       ├── serve-client.ts # OpenCode API 客户端
│       └── config.ts      # 配置
│
├── matrix/                # Matrix 消息服务（独立项目）
│   ├── docker-compose.yml # Dendrite + PostgreSQL + Element Web
│   ├── config/            # Dendrite 配置
│   └── README.md
│
├── images/                # Agent 容器镜像
│   ├── base/              # 基础镜像 (Ubuntu + Node.js + opencode-ai)
│   └── role/              # 角色镜像模板
│
├── roles/                 # 角色定义文件
│   └── researcher/        # 预置研究员角色
│
├── docs/                  # 文档
│   └── rules/             # 开发规范
│
├── AGENTS.md              # AI 开发规范入口
├── pnpm-workspace.yaml    # monorepo (backend + frontend)
├── package.json           # 根 package.json
└── .env.example           # 环境变量模板
```

---

## 八、参见

- [Backend README](backend/README.md) - API 文档、日志规范
- [Agent README](agent/README.md) - 容器架构
- [Matrix README](matrix/README.md) - Matrix 消息服务（独立项目）
- [AGENTS.md](AGENTS.md) - 开发规范