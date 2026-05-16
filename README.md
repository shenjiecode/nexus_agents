# Nexus Agents

"容器即人" - AI Agent Container Management System

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Platform Layer                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐    │
│  │   Backend   │──▶│  Container  │──▶│    Matrix       │    │
│  │   (Hono)    │   │  Manager    │   │    Service      │    │
│  └─────────────┘   └─────────────┘   └─────────────────┘    │
│         │                 │                    │            │
│         ▼                 ▼                    ▼            │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐    │
│  │  Database   │   │   Docker    │   │ Matrix Homeserver│    │
│  │  (PostgreSQL)│   │  /Podman    │   │   (external)     │    │
│  └─────────────┘   └─────────────┘   └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ create container
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Agent Container                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  opencode serve (always running, port 4096)          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↕                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  agent.ts (Matrix client, native fetch API)          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 雇佣流程

```
用户雇佣角色 → 平台注册 Matrix 账户 → 写入 employees 表
    → 创建容器（注入 MATRIX_* 环境变量）
    → 容器启动：opencode serve + agent
    → 用户邀请 agent 加入房间
    → agent 自动接受邀请
    → 用户发消息 → agent 处理 → 回复
```

## 关键架构决策

### 为什么使用原生 fetch 而非 Matrix SDK？

**问题背景**：初期尝试使用 `matrix-bot-sdk`，但在 Docker 构建时遇到 native 依赖问题：

```
matrix-bot-sdk 依赖 @matrix-org/matrix-sdk-crypto-nodejs (Rust 编译的 native 模块)
    → Docker 容器内安装失败
    → pnpm 还需要手动批准 build-scripts
```

**决策分析**：

| SDK 功能 | 我们是否需要 | 备注 |
|---------|-------------|------|
| E2EE 加密 | ❌ 不需要 | Phase 1 明确不做 |
| 类型安全的 API | ⚠️ 可选 | 简单场景，自己写够用 |
| Rate limiting 处理 | ⚠️ 可选 | 可以自己加 |
| 复杂事件解析 | ❌ 不需要 | 只处理 message + invite |
| 状态管理 | ❌ 不需要 | 简单的 sync loop |

**结论**：SDK 的核心价值是 E2EE，但我们不需要。自己实现更合适。

**实际使用的 API**（共 5 个）：

```
POST /register          - 注册账户
POST /login             - 登录获取 token
GET  /sync              - 长轮询获取事件
PUT  /rooms/.../join    - 接受邀请
PUT  /rooms/.../send    - 发送消息
```

**收益**：

- 依赖：235 packages → 39 packages
- 构建：无 native 依赖问题
- 调试：完全可控，问题易定位

**什么时候该用 SDK**：

- 需要 E2EE 时
- 需要复杂功能时（空间管理、线程、投票等）
- 需要长期维护的大型项目

---
## 技术栈

| 层级 | 技术 |
|------|------|
| Backend | Hono + Drizzle ORM + PostgreSQL |
| Agent Container | Node.js 24 + TypeScript |
| Container Runtime | Docker / Podman |
| Messaging | Matrix (Synapse/Dendrite/Conduit) |

## 项目结构

```
nexus_agents/
├── frontend/          # React 前端
├── backend/           # Hono API 服务
│   ├── src/
│   │   ├── api/       # 路由
│   │   ├── db/        # 数据库
│   │   ├── services/  # 业务逻辑
│   │   └── lib/       # 工具模块
│   └── README.md
├── agent/             # 容器内 Agent
│   ├── src/
│   │   ├── agent.ts       # Matrix 客户端
│   │   ├── serve-client.ts # OpenCode API
│   │   └── config.ts      # 配置
│   └── README.md
├── images/
│   └── base/          # 基础镜像 Dockerfile
└── docs/
    └── rules/         # 开发规范
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCODE_PROVIDER_NAME` | AI Provider | `tencent-coding-plan` |
| `OPENCODE_API_KEY` | API Key | - |
| `MATRIX_HOMESERVER_URL` | Matrix 服务器 | `http://localhost:8008` |
| `DOCKER_HOST` | Docker socket | `/var/run/docker.sock` |

## 开发

```bash
# 安装依赖
pnpm install

# 启动后端
cd backend && pnpm dev

# 启动前端
cd frontend && pnpm dev

# 构建基础镜像
docker build -f images/base/Dockerfile -t nexus-base:latest .
```

## 参见

- [Backend README](backend/README.md) - API 文档、日志规范
- [Agent README](agent/README.md) - 容器架构
- [AGENTS.md](AGENTS.md) - 开发规范
