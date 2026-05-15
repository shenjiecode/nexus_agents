# Nexus Agents Backend

Role Container Management System - Backend API Service

## 技术栈

- **框架**: Hono (轻量级 Web 框架)
- **数据库**: sql.js (SQLite in-memory, 持久化到文件)
- **ORM**: Drizzle ORM
- **日志**: Pino (结构化日志)
- **容器**: Dockerode (Docker/Podman API)
- **语言**: TypeScript (ES Modules)

## 启动

```bash
# 安装依赖
pnpm install

# 开发模式 (热重载)
pnpm dev

# 构建
pnpm build

# 生产运行
node dist/index.js
```

## 端口

- 默认端口: `13207`
- 环境变量: `PORT`

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `13207` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `NODE_ENV` | 环境 | `development` |
| `DOCKER_HOST` | Docker socket 路径 | `/var/run/docker.sock` |
| `MATRIX_HOMESERVER_URL` | Matrix 服务器地址 | `http://localhost:8008` |

## 架构决策

### Matrix 服务使用原生 fetch 而非 SDK

**背景**：初期尝试使用 `matrix-bot-sdk`，但在 Docker 构建时遇到 native 依赖问题（Rust 编译的 crypto 模块）。

**分析**：

| SDK 功能 | 是否需要 |
|---------|---------|
| E2EE 加密 | ❌ Phase 1 不做 |
| 复杂事件解析 | ❌ 只处理 register/login |
| 状态管理 | ❌ 一次性操作 |

SDK 的核心价值是 E2EE，但我们只需要 register 和 login 两个 API。

**实际使用的 API**：

```
POST /_matrix/client/v3/register  - 注册账户
POST /_matrix/client/v3/login     - 登录获取 token
```

**收益**：
- 无 native 依赖，构建简单
- 完全可控，调试方便

**详见**: `src/services/matrix-service.ts`

## 日志规范

### 日志框架

使用 Pino 结构化日志，所有日志统一通过 `src/lib/logger.ts`。

### 日志级别

| 级别 | 用途 |
|------|------|
| `trace` | 详细调试信息 |
| `debug` | 调试信息 |
| `info` | 操作日志 (默认) |
| `warn` | 警告信息 |
| `error` | 错误信息 |
| `fatal` | 严重错误 |

### 使用方式

```typescript
import logger from './lib/logger.js';

// 基础日志
logger.info('Server started');
logger.warn('Port already in use');
logger.error(error, 'Failed to connect');

// 结构化日志 (推荐)
logger.info({ orgSlug: 'demo', roleId: 'xxx' }, 'Creating container');
logger.error({ err: error, orgSlug }, 'Failed to hire container');

// 模块专用 logger
const roleLogger = logger.child({ module: 'role-service' });
roleLogger.info({ slug }, 'Building role image');
```

### 参数顺序

Pino 参数顺序: `logger.error(errorObject, 'message')`

```typescript
// 正确 ✅
logger.error(error, 'Failed to create role');
logger.info({ slug: 'researcher' }, 'Role created');

// 错误 ❌
logger.error('Failed to create role:', error);  // 参数反了
logger.info('Role created:', slug);             // 使用字符串拼接
```

### 禁止事项

- ❌ 禁止使用 `console.log`, `console.error`, `console.warn`
- ❌ 禁止空 catch 块 `catch (e) {}`
- ❌ 禁止静默吞掉错误

### API 路由日志规范

所有 API catch 块必须记录错误:

```typescript
try {
  const result = await createOrganization(body);
  return c.json(apiSuccess(result), 201);
} catch (error) {
  logger.error(error, 'Failed to create organization');
  return c.json(apiError(error.message), 500);
}
```

## API 端点

### Organizations

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/organizations` | 组织列表 |
| POST | `/api/organizations` | 创建组织 |
| GET | `/api/organizations/:slug` | 组织详情 |
| PUT | `/api/organizations/:slug` | 更新组织 |
| DELETE | `/api/organizations/:slug` | 删除组织 |
| GET | `/api/orgs/:slug/auth` | 组织 Auth 配置 |
| PUT | `/api/orgs/:slug/auth` | 设置 Auth 配置 |
| DELETE | `/api/orgs/:slug/auth` | 删除 Auth 配置 |

### Roles

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/roles` | 角色列表 |
| POST | `/api/roles` | 创建角色 |
| GET | `/api/roles/:slug` | 角色详情 |
| PUT | `/api/roles/:slug` | 更新角色 |
| DELETE | `/api/roles/:slug` | 删除角色 |
| GET | `/api/roles/:slug/versions` | 版本历史 |

### Containers

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/orgs/:slug/containers` | 组织容器列表 |
| POST | `/api/orgs/:slug/containers` | 雇佣容器 |
| GET | `/api/containers/:id` | 容器详情 |
| POST | `/api/containers/:id/start` | 启动容器 |
| POST | `/api/containers/:id/stop` | 停止容器 |
| DELETE | `/api/containers/:id` | 删除容器 |

### Sessions

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/containers/:id/sessions` | 会话列表 |
| POST | `/api/containers/:id/sessions` | 创建会话 |
| POST | `/api/sessions/:id/messages` | 发送消息 |

## 目录结构

```
backend/
├── src/
│   ├── api/routes/     # API 路由
│   ├── db/             # 数据库配置
│   ├── lib/            # 共享模块 (logger)
│   ├── services/       # 业务逻辑
│   └── integrations/   # 外部集成
├── data/               # 数据存储 (gitignore)
│   ├── database.db     # SQLite 数据库
│   └── orgs/           # 组织数据
└── dist/               # 构建输出
```

## 数据存储

### 三层存储架构

| 层 | 内容 | 职责 |
|---|------|------|
| 数据库 | 业务对象 + 关联关系 | 查询、权限、版本追踪 |
| 文件系统 | 配置 + 记忆 + Auth | 持久化、可编辑 |
| Docker/Podman | 镜像 + 容器运行时 | 执行、隔离 |

### 存储路径

```
data/
├── database.db              # SQLite 数据库
└── orgs/{orgSlug}/
    ├── auth.json            # 组织 API Keys
    └── containers/{id}/     # 容器记忆
        ├── AGENTS.md
        ├── memory/
        └── docs/
```

## Docker

### 基础镜像

位于 `images/base/Dockerfile`:

```bash
docker build -t localhost/nexus-base:latest images/base/
```

### 角色镜像

创建角色时自动构建: `nexus-role-{slug}:{version}`

### Socket 配置

默认使用 Docker socket: `/var/run/docker.sock`

如需使用 Podman:
1. 安装 `podman-docker` 包 (提供 docker 命令兼容)
2. 或设置环境变量: `DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`

## 开发规范

参见项目根目录 `AGENTS.md`