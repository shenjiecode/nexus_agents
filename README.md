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
- **角色市场**：用户可上传/下载角色包到京东云OSS

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
│ React+Vite  │ API  │ Gin+GORM       │      │ Synapse        │
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
                     │ picoclaw    │ │ picoclaw    │ │
                     │ :4100+      │ │ :4100+      │ │
                     └──────┬──────┘ └──────┬──────┘ │
                            │               │        │
                            └───────────────┴────────┘
                                    Matrix API
```

### OSS 存储架构

角色包使用京东云OSS存储，采用 **Presigned URL** 模式（前端直传，后端仅生成签名URL）：

```
Frontend ──获取上传URL──▶ Backend ──生成Presigned URL──▶ 返回
Frontend ──PUT直传──────▶ 京东云OSS ◀────GET直传────── Frontend (下载)
Frontend ──获取下载URL──▶ Backend ──生成Presigned URL──▶ 返回

OSS路径规则：
  用户角色: roles/{userId}/{roleId}/package.zip
  市场角色: marketplace/{roleId}.zip
```

### 消息流程

```
    → 创建 Docker 容器（挂载角色配置目录）
    → 容器启动：picoclaw AI Agent
    → 用户邀请 agent 进入 Matrix 房间 → agent 自动接受
    → 用户发消息 → agent 处理并回复到 Matrix 房间

---

## 三、模块详解

### 3.1 Frontend（前端）

| 项目 | 说明 |
|------|------|
| 路径 | `platform/frontend/` |
| 端口 | `13208` |
| 技术栈 | React 18 + TypeScript + Vite + Tailwind CSS + React Router v6 |

**核心功能**：
- Dashboard：系统统计、快捷操作
- Organizations：组织管理
- Roles：角色模板管理 + 角色市场双Tab（角色市场/我的角色）
- Employees：员工生命周期管理
- Marketplace：技能包/MCP 市场 + 角色下载
- 上传/下载：京东云OSS Presigned URL交互

**目录结构**：
```
platform/frontend/src/
├── components/    # CyberCard, CyberButton, CyberModal, StatusDot, Sidebar
├── pages/         # Dashboard, Organizations, OrganizationDetail, Roles, Containers
├── hooks/         # useApi
└── types/         # TypeScript 类型定义 (User, Role, MarketplaceRole, Skill, Mcp)
```

**设计主题**：赛博朋克风格
- 背景：深色渐变 `#0A0A0F` → `#1E1E2E`
- 主色调：霓虹青 `#00D9FF`
- 次色调：霓虹紫 `#8B5CF6`

---

### 3.2 Backend（后端）

| 项目 | 说明 |
|------|------|
| 路径 | `platform/backend/` |
| 端口 | `13207` |
| 技术栈 | Gin + GORM + PostgreSQL + Zap + AWS SDK v2 (S3兼容) |

**核心功能**：
- 用户认证（注册/登录/密码重置 + SMTP邮件）
- 角色模板管理 + 版本控制
- 角色市场（京东云OSS存储 + Presigned URL上传/下载）
- Marketplace（Skills/MCP）
- 角色调试（WebSocket容器交互）

**目录结构**：
```
platform/backend/internal/
├── handler/     # API处理器 (auth, roles, marketplace, debug)
├── service/     # 业务服务 (OSS, Email)
├── model/       # GORM模型 (User, Role, PasswordResetToken)
├── middleware/   # 中间件 (Auth - X-User-Id头)
├── config/      # 配置加载 (Viper + godotenv)
└── router/      # 路由定义
```

**API 路由**：

| 模块 | 路径前缀 | 认证 | 说明 |
|------|---------|------|------|
| Auth | `/api/auth` | 无 | 注册/登录/密码重置 |
| Roles | `/api/roles` | 部分需认证 | 角色CRUD + 导入导出 |
| Roles OSS | `/api/roles/:id/upload`, `/api/roles/:id/download` | 需认证 | OSS上传/下载Presigned URL |
| Debug | `/api/roles/:id/debug` | 需认证 | 容器调试WebSocket |
| Marketplace Roles | `/api/marketplace/roles` | 无 | 角色市场列表/下载 |
| Skills | `/api/skills` | 无 | 技能包市场 |
| MCPs | `/api/mcps` | 无 | MCP服务器市场 |

**详细API列表**：

**Auth（无需认证）**：

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/forgot-password` | 忘记密码（发送重置邮件） |
| POST | `/api/auth/reset-password` | 重置密码 |

**Roles（角色管理）**：

| Method | Path | 认证 | 说明 |
|--------|------|------|------|
| GET | `/api/roles` | 无 | 列出公开角色 |
| POST | `/api/roles` | 需认证 | 创建角色 |
| GET | `/api/roles/mine` | 需认证 | 列出我的角色 |
| GET | `/api/roles/:id` | 需认证 | 获取角色详情 |
| PUT | `/api/roles/:id` | 需认证 | 更新角色 |
| DELETE | `/api/roles/:id` | 需认证 | 删除角色 |
| POST | `/api/roles/import` | 无 | 导入角色（multipart） |
| GET | `/api/roles/:id/export` | 无 | 导出角色 |
| POST | `/api/roles/:id/upload` | 需认证 | 获取OSS上传Presigned URL |
| GET | `/api/roles/:id/download` | 需认证 | 获取OSS下载Presigned URL |

**Marketplace（市场，无需认证）**：

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/marketplace/roles` | 列出市场角色 |
| GET | `/api/marketplace/roles/:id/download` | 获取市场角色下载Presigned URL |
| GET | `/api/skills` | 列出技能包 |
| GET | `/api/mcps` | 列出MCP服务器 |

**Debug（调试，需认证）**：

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/roles/:id/debug/start` | 启动调试容器 |
| POST | `/api/roles/:id/debug/stop` | 停止调试容器 |
| GET | `/api/roles/:id/debug/status` | 获取调试状态 |
| GET | `/api/roles/:id/debug/ws` | 调试WebSocket |

**认证机制**：使用 `X-User-Id` 请求头传递用户ID，后端Auth中间件解析后注入Gin Context。

---

### 3.3 Agent Container（Agent 容器）

| 项目 | 说明 |
|------|------|
| 镜像 | `sipeed/picoclaw:latest` |
| 端口 | `4100+`（动态分配） |
| 技术栈 | PicoClaw (Go) + LLM API |

**架构**：
```
┌─────────────────────────────────────────────┐
│                  Container                   │
│                                              │
│  picoclaw (Go AI Agent, port dynamic)       │
│        ↕ HTTP API + WebSocket               │
│  配置文件: config.json + .security.yml        │
└─────────────────────────────────────────────┘
```

**核心配置**：
- `config.json` - PicoClaw 标准配置（version 3 格式）
- `.security.yml` - API Key + pico channel token
- `workspace/` - 工作目录，包含 AGENT.md, SOUL.md 等

**设计决策**：使用官方 PicoClaw 镜像
- 开箱即用的 AI Agent 运行时
- 支持多种 LLM Provider（腾讯混元、OpenAI 兼容等）
- WebSocket API 支持实时对话

---

### 3.4 Matrix Server（消息服务）

| 项目 | 说明 |
|------|------|
| 路径 | `matrix/` |
| 端口 | Synapse `8008/8448`, Ketesa Admin `8081`, Element Web `8080`, PostgreSQL `5432` |
| 技术栈 | Synapse + Ketesa + PostgreSQL + Element Web |

**服务组成**：

| 服务 | 端口 | 说明 |
|------|------|------|
| Synapse | 8008 (HTTP) / 8448 (HTTPS) | Matrix Homeserver |
| PostgreSQL | 5432 | 数据库 |
| Element Web | 8080 | Web 聊天客户端 |
| Ketesa Admin | 8081 | Synapse 管理 UI |

---


## 四、关键技术

### 4.1 数据库 Schema

**核心表**：

| 表名 | 说明 |
|------|------|
| `users` | 用户表：id, username, email, password, nickname, slug |
| `roles` | 角色表：id, userId, name, description, variant, status, isPublic |
| `password_reset_tokens` | 密码重置令牌：userId, token, expiresAt |
| `organizations` | 组织表：id, name, slug, password, matrix credentials |
| `employees` | 员工表：id, slug, organizationId, containerId, status, matrix credentials |

### 4.2 技术选型对比

| 领域 | 选择 | 原因 |
|------|------|------|
| 后端框架 | Gin | 高性能HTTP框架，生态成熟 |
| ORM | GORM | Go最流行的ORM，功能完整 |
| 对象存储 | AWS SDK v2 (S3兼容) | 京东云OSS S3兼容，Presigned URL模式 |
| 认证 | X-User-Id头 | 轻量级认证，前端传递用户ID |
| 日志 | Zap | 结构化日志、高性能 |
| 容器管理 | Docker/Podman | 标准容器运行时 |

### 4.3 OSS 存储

- **提供商**：京东云OSS（S3兼容）
- **SDK**：AWS SDK Go v2 (`github.com/aws/aws-sdk-go-v2`)
- **模式**：Presigned URL（后端签名，前端直传/直下载）
- **签名有效期**：1小时
- **优雅降级**：OSS未配置时服务正常启动，marketplace返回503

**关键文件**：
- `platform/backend/internal/service/oss.go` - OSS服务（ListObjects, PresignedUpload/DownloadURL, ObjectExists）
- `platform/backend/internal/handler/marketplace.go` - 市场API（ListMarketplaceRoles, GetMarketplaceRoleDownload）
- `platform/backend/internal/handler/roles.go` - 角色上传/下载API（UploadRole, DownloadRole）
- `platform/frontend/src/pages/Roles.tsx` - 双Tab UI（角色市场 + 我的角色）

---

## 五、部署方案

### 5.1 Backend（本地开发）

```bash
cd platform/backend

# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库、OSS等配置

# 2. 启动开发服务器
go run cmd/server/main.go    # http://localhost:13207
```

### 5.2 Frontend（本地开发）

```bash
cd platform/frontend
pnpm dev                     # http://localhost:13208
```

### 5.3 Matrix Server（独立部署）

```bash
cd matrix
docker-compose up -d
```

**访问地址**：
- Element Web: http://localhost:8080
- Synapse API: http://localhost:8008

---

## 六、配置说明

### 6.1 环境变量总览

| 变量 | 所属模块 | 说明 | 默认值 |
|------|---------|------|--------|
| `PORT` | Backend | 后端端口 | `13207` |
| `DATABASE_URL` | Backend | PostgreSQL 连接 | `postgresql://nexus:nexussecret@localhost:5433/nexus` |
| `LOG_LEVEL` | Backend | 日志级别 | `info` |
| `ENVIRONMENT` | Backend | 环境 | `development` |
| `DOCKER_HOST` | Backend | Docker socket | `/var/run/docker.sock` |
| `OSS_ENDPOINT` | Backend | 京东云OSS Endpoint | - |
| `OSS_BUCKET` | Backend | OSS Bucket名称 | - |
| `OSS_ACCESS_KEY_ID` | Backend | OSS Access Key ID | - |
| `OSS_ACCESS_KEY_SECRET` | Backend | OSS Access Key Secret | - |
| `OSS_REGION` | Backend | OSS Region | `cn-east-1` |
| `SMTP_HOST` | Backend | SMTP服务器地址 | - |
| `SMTP_PORT` | Backend | SMTP端口 | `587` |
| `SMTP_USER` | Backend | SMTP用户名 | - |
| `SMTP_PASSWORD` | Backend | SMTP密码 | - |
| `SMTP_FROM` | Backend | 邮件发件人 | - |
| `FRONTEND_URL` | Backend | 前端URL（密码重置链接） | - |
| `MATRIX_HOMESERVER_URL` | Backend/Agent | Matrix 服务器 | `http://localhost:8008` |
| `MATRIX_REGISTRATION_SECRET` | Backend | Matrix 注册密钥 | `dev-secret-change-in-production` |
| `MATRIX_ACCESS_TOKEN` | Agent | Matrix 访问令牌 | - |
| `MATRIX_USER_ID` | Agent | Matrix 用户 ID | - |

### 6.2 配置文件示例

**Backend `.env`**：
```env
# Database
DATABASE_URL=postgresql://nexus:nexussecret@localhost:5433/nexus

# OSS (京东云)
OSS_ENDPOINT=s3.cn-east-1.jdcloud-oss.com
OSS_BUCKET=agent-resource
OSS_ACCESS_KEY_ID=your_access_key
OSS_ACCESS_KEY_SECRET=your_secret_key
OSS_REGION=cn-east-1

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASSWORD=your_password
SMTP_FROM=noreply@example.com
FRONTEND_URL=http://localhost:13208


# Matrix
MATRIX_HOMESERVER_URL=http://localhost:8008
MATRIX_REGISTRATION_SECRET=dev-secret-change-in-production
```

### 6.3 端口汇总

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 13208 | React + Vite |
| Backend | 13207 | Gin API |
| Backend PostgreSQL | 5433 | 业务数据库 |
| Matrix Synapse | 8008 | Matrix Homeserver |
| Matrix PostgreSQL | 5432 | Matrix 数据库 |
| Element Web | 8080 | Matrix 客户端 |
| Ketesa Admin | 8081 | Synapse 管理 UI |
| Agent 容器 | 4100+ | picoclaw (动态分配) |

---

## 七、项目结构

```
nexus_agents/
├── platform/
│   ├── frontend/                    # React 前端
│   │   ├── src/
│   │   │   ├── components/          # CyberCard, CyberButton, CyberModal, StatusDot, Sidebar
│   │   │   ├── pages/               # Dashboard, Organizations, Roles(双Tab), Containers
│   │   │   ├── hooks/               # useApi
│   │   │   └── types/               # TypeScript 类型定义
│   │   └── vite.config.ts           # API 代理 → localhost:13207
│   │
│   └── backend/                     # Go API 服务
│       ├── cmd/server/main.go       # 入口
│       ├── internal/
│       │   ├── handler/             # API处理器 (auth, roles, marketplace, debug)
│       │   ├── service/             # 业务服务 (OSS, Email)
│       │   ├── model/               # GORM模型
│       │   ├── middleware/          # 中间件 (Auth)
│       │   ├── config/              # 配置加载
│       │   └── router/              # 路由定义
│       ├── go.mod                   # Go依赖 (Gin, GORM, AWS SDK v2)
│       └── .env                     # 环境变量
│
├── matrix/                          # Matrix 消息服务
│   ├── docker-compose.yml           # Synapse + PostgreSQL + Element Web + Ketesa
│   └── config/                      # Synapse 配置
│
├── roles/                           # 角色定义文件（已弃用）
├── docs/                            # 文档
│   └── rules/                       # 开发规范
│
├── AGENTS.md                        # 开发规范入口
└── README.md                        # 本文件
```

---

## 八、参见

- [Frontend README](platform/frontend/README.md) - 前端架构、组件规范
- [Agent README](agent/README.md) - 容器架构
- [Matrix README](matrix/README.md) - Matrix 消息服务
- [AGENTS.md](AGENTS.md) - 开发规范
