# Nexus Agents 项目分析报告

> 更新时间：2026-05-16

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Matrix 基础设施层                        │
│  matrix-postgres(5432) + Dendrite(8008) + Element Web(8080)  │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ Matrix Client API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      平台业务层 (Backend)                     │
│  Hono API(13207) + Drizzle ORM + nexus-postgres(5433)        │
│  组织管理 | 角色管理 | 员工管理 | 技能市场                       │
└──────────────────────────────────────────────────────────────┘
                              │ dockerode
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Agent 容器层                             │
│  每个容器: opencode serve(4096) + agent.ts (Matrix client)    │
│  独立运行，通过 Matrix 协议与用户/其他 Agent 交流               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      前端 (Frontend)                          │
│  React + Vite + Tailwind，赛博朋克风格 UI                      │
│  7 个页面，完整 CRUD 操作                                      │
└──────────────────────────────────────────────────────────────┘
```

三层解耦设计：
1. **Matrix 层**：纯基础设施，官方镜像直接跑，不写自定义代码
2. **Agent 层**：独立容器，自带 Matrix client，不依赖平台层
3. **平台层**：薄业务层，只在雇佣/解雇时和 Matrix 交互（注册账户、加群/踢人）

## 二、技术栈

| 层级 | 技术 |
|------|------|
| Frontend | React + TypeScript + Vite + Tailwind（自定义 Cyber 组件） |
| Backend | Hono + Drizzle ORM + PostgreSQL（postgres.js 驱动） |
| Agent | Node.js 24 + TypeScript，原生 fetch Matrix 客户端 |
| Matrix | Dendrite monolith + PostgreSQL + Element Web |
| 容器运行时 | Docker / Podman（dockerode） |

## 三、已实现功能

### Backend — 50+ API 端点

| 模块 | 端点数 | 状态 | 说明 |
|------|--------|------|------|
| 组织管理 | 12 | ✅ 完整 | CRUD + Auth 配置 + API Key + 创建时自动注册 Matrix admin |
| 角色管理 | 6 | ✅ 完整 | CRUD + Docker 镜像构建 + 版本管理 |
| 容器管理 | 13 | ✅ 完整 | 雇佣/启动/停止/删除 + 健康检查 + Matrix 账户注册 |
| 会话管理 | 4 | ✅ 完整 | QA 会话 + OpenCode 集成 + 消息历史 |
| 技能市场 | 14 | ✅ 完整 | Skills/MCPs CRUD + 角色关联 |
| 健康检查 | 1 | ✅ | |

### Frontend — 7 个页面

| 页面 | 功能 |
|------|------|
| Dashboard | 统计概览 + 快捷操作 |
| Organizations | 组织列表 + 创建弹窗 |
| OrganizationDetail | 组织详情 + 容器列表 + Auth 管理 |
| Roles | 角色网格 + 技能/MCP 配置 |
| Containers | 全局容器列表 |
| Marketplace | 技能和 MCP 浏览 |
| AgentDetail | Agent 详情 + 聊天界面 |

### Agent — 完整的 Matrix 客户端

- 原生 fetch 实现（无 SDK 依赖，39 packages vs 235）
- 处理 invite → 自动加入房间
- 处理 message → 通过 OpenCode API 生成回复
- 支持打字指示器 + 会话管理

### Matrix 基础设施

- Dendrite + 两个独立 PostgreSQL + Element Web（Docker Compose）
- Shared secret admin API 注册（HMAC-SHA1）
- E2EE 已禁用，开放注册已关闭
- 数据挂载到 `matrix/data/` 目录

## 四、数据库模型

### 当前（11 张表 → 计划精简为 8 张）

```
organizations ──┬── containers ──── sessions        [待合并]
                ├── employees                        [吸收 containers]
                └── chat_rooms                       [待删除]

roles ──┬── role_versions
       ├── containers                              [待合并到 employees]
       ├── employees
       ├── role_skills ──── skills
       └── role_mcps ────── mcps
```

### 目标（8 张表）

```
organizations ──── employees（含容器运行时字段）

roles ──┬── role_versions
       ├── employees
       ├── role_skills ──── skills
       └── role_mcps ────── mcps
```

## 五、最终合并方案

### 要删除的表（3张）
- `containers` → 合并到 `employees`
- `sessions` → 删除（QA 用内存或直接走 Matrix）
- `chatRooms` → 删除（群聊完全由 Matrix 管理，通过 alias 查找）

### employees 表改动

**当前字段**：`id, slug, name, roleId, organizationId, containerId(FK), employeeDataPath, matrixUserId, matrixAccessToken, matrixDeviceId, matrixPassword, matrixHomeserverUrl, createdAt, updatedAt`

**从 containers 吸收**：`port`, `password`（OpenCode 密码）, `status`, `healthStatus`, `memoryPath`

**containerId**：从外键（FK→containers）变为普通字段（存 Docker 容器 ID）

### 6 处文件改动

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/src/db/schema.ts` | 删 `containers`/`sessions`/`chatRooms` 三张表 + 类型导出；`employees` 加 5 个容器字段 |
| 2 | `backend/src/db/index.ts` | 移除三张表的 import/export |
| 3 | `backend/src/services/container-manager.ts` | 所有 `containersTable` → `employees`；删除 chatRooms 查询；删除 sessions 引用 |
| 4 | `backend/src/services/org-service.ts` | 删除创建默认内部群（chatRooms）的 try/catch 块 |
| 5 | `backend/src/services/qa-service.ts` | 删除 sessions 表写入，保留内存 Map |
| 6 | 路由文件 `containers.ts` + `org-containers.ts` + `sessions.ts` | 所有 containers 引用改为 employees；sessions 路由去掉 DB 操作 |

### 不改动的文件
- `matrix-service.ts`、`marketplace-service.ts`、`role-service.ts` — 不变
- `frontend/` — API 路径不变，只改内部实现
- `agent/` — 不变

## 六、优先改进点

### P0 — 必须尽快修

| # | 问题 | 原因 |
|---|------|------|
| 1 | README 和实际代码不一致 | README 写的 SQLite，代码已迁移到 PostgreSQL |
| 2 | 硬编码密码 | docker-compose、dendrite.yaml、db/index.ts 里都有明文密码 |
| 3 | 没有数据库迁移 | Drizzle config 已创建但未运行 generate/migrate，nexus-postgres 是空的 |

### P1 — 近期做

| # | 问题 | 建议 |
|---|------|------|
| 4 | Element Web `disable_registration: false` | Dendrite 已关闭开放注册，但 Element 还显示注册按钮 |
| 5 | nexus-postgres 没有健康检查 | docker-compose 里缺少 healthcheck |
| 6 | init.ps1 需要更新 | 脚本还用旧的 open registration API |

### P2 — 后续考虑

| # | 问题 |
|---|------|
| 7 | 没有测试（0 个测试文件） |
| 8 | 容器没有日志/终端 API |
| 9 | 没有 Webhook/事件通知 |
| 10 | Agent 里的 `matrix-client.ts` 是废弃代码（SDK 版本） |
| 11 | Matrix access token 存明文 |

### P3 — 生产部署前

| # | 问题 |
|---|------|
| 12 | 没有 HTTPS/TLS |
| 13 | 没有 API 限流 |
| 14 | Dendrite shared secret 是弱默认值 |

## 七、环境配置

### 端口映射

| 服务 | 端口 |
|------|------|
| Backend API | 13207 |
| Matrix Dendrite | 8008 (HTTP) / 8448 (HTTPS) |
| Element Web | 8080 |
| matrix-postgres | 5432 |
| nexus-postgres | 5433 |
| Agent OpenCode serve | 4096+（每个容器分配） |

### 关键环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://nexus:nexussecret@localhost:5433/nexus` | 业务数据库 |
| `MATRIX_HOMESERVER_URL` | `http://localhost:8008` | Matrix 服务器 |
| `MATRIX_REGISTRATION_SECRET` | `dev-secret-change-in-production` | 注册密钥（须匹配 dendrite.yaml） |
| `OPENCODE_PROVIDER_NAME` | `tencent-coding-plan` | AI Provider |
| `OPENCODE_API_KEY` | - | AI API Key |
| `DOCKER_HOST` | `/var/run/docker.sock` | Docker socket |

## 八、数据目录结构

```
matrix/
├── config/
│   ├── dendrite.yaml          # Dendrite 配置
│   ├── element-config.json    # Element Web 配置
│   └── matrix_key.pem         # 签名密钥（自动生成）
├── data/
│   ├── matrix-postgres/       # Dendrite 数据库（挂载）
│   ├── nexus-postgres/        # 业务数据库（挂载）
│   ├── media/                 # Dendrite 媒体文件
│   └── jetstream/             # Dendrite 消息流
├── docker-compose.yml
└── init.ps1
```
