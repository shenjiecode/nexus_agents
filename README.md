# Nexus Agents

"容器即人" - AI Agent Container Management System

## 架构

```
┌─ 前端 ──────────────────────────────────────────────────────┐
│  http://localhost:13208  (React + Vite)                      │
│  赛博风格 UI · 组织/角色/员工管理 · Marketplace              │
└──────────────────────────┬───────────────────────────────────┘
                           │ /api/*
                           ▼
┌─ 后端 ──────────────────────────────────────────────────────┐
│  http://localhost:13207  (Hono + TypeScript)                 │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ API 路由  │  │ 业务 Services │  │  外部集成             │  │
│  │ 6 个模块  │─▶│ 7 个服务      │─▶│ Matrix · Docker      │  │
│  └──────────┘  └──────────────┘  └───────────────────────┘  │
│         │                                        │           │
│         ▼                                        ▼           │
│  ┌──────────────┐                     ┌──────────────────┐  │
│  │  PostgreSQL  │                     │ Docker/Podman    │  │
│  │  :5433       │                     │ (容器管理)        │  │
│  └──────────────┘                     └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                                              │ 创建容器
                                              ▼
┌─ Agent 容器（每个员工一个）──────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │  opencode serve (常驻, port 4096)                    │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │ HTTP API                         │
│  ┌────────────────────────▼────────────────────────────┐    │
│  │  agent.ts (Matrix 客户端, 原生 fetch)                │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 消息流

```
用户雇佣角色 → Backend 注册 Matrix 账户 → 写入 employees 表
    → 创建 Docker 容器（注入 MATRIX_* 环境变量）
    → 容器启动：opencode serve + agent.ts
    → 用户邀请 agent 进入 Matrix 房间 → agent 自动接受
    → 用户发消息 → agent 转发到 opencode → 回复到 Matrix 房间
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + Tailwind CSS（赛博主题） |
| 后端 | Hono + Drizzle ORM + PostgreSQL + Pino |
| Agent 容器 | Node.js 24 + opencode-ai + 原生 fetch |
| 容器运行时 | Docker / Podman (Dockerode) |
| 消息协议 | Matrix (Dendrite) |

## 项目结构

```
nexus_agents/
├── frontend/              # React 前端 (@nexus/frontend)
│   ├── src/
│   │   ├── components/    # 5 个通用组件 (CyberCard, CyberButton...)
│   │   ├── pages/         # 7 个页面 (Dashboard, Organizations...)
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
│   └── rules/             # 开发规范 (10 个文件)
│
├── AGENTS.md              # AI 开发规范入口
├── pnpm-workspace.yaml    # monorepo (backend + frontend)
└── .env.example           # 环境变量模板
```

## 各模块部署

### Matrix（独立项目）

消息基础设施，可独立部署到任何服务器。

```powershell
cd matrix
docker-compose up -d    # Dendrite(:8008) + PostgreSQL(:5432) + Element Web(:8080)
```

详见 [matrix/README.md](matrix/README.md)

### Backend（本地开发）

```powershell
cd backend

# 1. 启动 PostgreSQL 依赖
docker-compose up -d

# 2. 同步数据库表结构
pnpm db:push

# 3. 启动开发服务器（热重载）
pnpm dev                 # http://localhost:13207
```

### Frontend（本地开发）

```powershell
cd frontend
pnpm dev                 # http://localhost:13208
```

前端通过 Vite proxy 将 `/api/*` 转发到 `localhost:13207`。

### Agent 容器（运行时创建）

不需要手动部署。Backend 通过 Dockerode 在用户"雇佣员工"时自动创建：

1. 构建角色镜像（`nexus-role-{slug}:{version}`）
2. 创建容器，注入 Matrix 凭据和环境变量
3. 容器启动 `opencode serve` + `agent.ts`

## 环境变量

配置文件：`backend/.env`，模板：`.env.example`

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端端口 | `13207` |
| `DATABASE_URL` | PostgreSQL 连接 | `postgresql://nexus:nexussecret@localhost:5433/nexus` |
| `MATRIX_HOMESERVER_URL` | Matrix 服务器 | `http://localhost:8008` |
| `MATRIX_REGISTRATION_SECRET` | 注册密钥（需匹配 dendrite.yaml） | `dev-secret-change-in-production` |
| `OPENCODE_PROVIDER_NAME` | AI Provider | `tencent-coding-plan` |
| `OPENCODE_API_KEY` | AI API Key | - |
| `DOCKER_HOST` | Docker socket | `/var/run/docker.sock` |

## API 路由

| 模块 | 路径前缀 | 说明 |
|------|---------|------|
| Organizations | `/api/organizations` | 组织 CRUD + Auth 配置 |
| Roles | `/api/roles` | 角色模板管理 + 版本 |
| Employees | `/api/orgs/:slug/employees` | 员工生命周期（雇佣/启停/删除） |
| Sessions | `/api/orgs/:slug/employees/:id/sessions` | AI 对话会话 |
| Marketplace | `/api/skills`, `/api/mcps` | 技能/MCP 市场 |

## 参见

- [Backend README](backend/README.md) - API 文档、日志规范
- [Agent README](agent/README.md) - 容器架构
- [Matrix README](matrix/README.md) - Matrix 消息服务（独立项目）
- [AGENTS.md](AGENTS.md) - 开发规范
