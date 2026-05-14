# MVP 需求说明：角色容器管理系统

> 版本 0.1 | 2026-05-13

---

## 1. 概述

### 1.1 背景

基于"多AI角色协作群聊系统"的整体设计，本 MVP 聚焦于**最基础的能力验证**：通过 Docker 运行一个可配置的 AI 角色，并对外提供问答服务。

这是整体系统的基石模块，后续的多角色协作、群聊编排都建立在"单角色容器可靠运行"的基础上。

### 1.2 目标

验证并实现：
- Docker 容器能稳定运行 OpenCode Serve
- 角色配置（提示词、Skills、MCP）可通过文件注入
- 配置修改后容器能正确重启并生效
- 外部可通过 HTTP API 与角色交互

### 1.3 范围边界

| 在范围内 | 不在范围内 |
|---------|-----------|
| 单角色容器管理 | 多角色协作 |
| 配置文件注入与热更新 | 群聊消息路由 |
| 基础问答 API | Handoff 交接协议 |
| 容器生命周期（启动/停止/重启） | 多租户隔离 |
| 依赖安装（Skills、MCP 的依赖） | 记忆管理（rules/） |
| 健康检查 | 成本统计 |
| | 前端界面 |

---

## 2. 核心概念

### 2.1 角色 (Role)

一个 AI 角色由以下要素定义：

```
角色 = 基础镜像 + 配置(opencode.json) + Skills + MCP服务器
```

| 要素 | 说明 | 可变性 |
|------|------|--------|
| 基础镜像 | Node.js + OpenCode CLI | 不可变（升级需重建） |
| opencode.json | Agent 定义、模型、工具权限 | 可修改，重启生效 |
| Skills | 角色专属能力（命令/技能） | 可修改，重启生效 |
| MCP服务器 | 外部工具集成 | 可修改，重启生效 |

### 2.2 角色配置结构

```
/role/
├── opencode.json          # 核心配置（模型、Agent、MCP、工具）
├── prompts/               # 系统提示词
│   └── {agent-name}.txt
├── .opencode/             # Skills 定义
│   └── skills/
│       └── {skill-name}/
│           └── SKILL.md
└── mcp/                   # MCP 配置脚本（如需要）
    └── {mcp-name}.json
```

### 2.3 容器实例

```
容器实例 = 角色镜像 + 环境变量(API Key) + 挂载卷(配置目录)
```

容器启动后通过 OpenCode Serve 暴露 HTTP API（默认端口 4096）。

---

## 3. 功能需求

### 3.1 角色配置管理

#### 3.1.1 配置文件生成

**需求**：系统根据用户输入生成完整的角色配置文件。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 角色名称（如 `copywriter`） |
| description | string | ✅ | 角色描述 |
| prompt | string | ✅ | 系统提示词 |
| model | string | ✅ | 使用的模型（如 `anthropic/claude-sonnet-4-5`） |
| temperature | number | ❌ | 温度参数，默认 0.7 |
| tools | object | ❌ | 工具权限配置 |
| skills | SkillConfig[] | ❌ | Skills 列表 |
| mcpServers | MCPConfig[] | ❌ | MCP 服务器列表 |

**SkillConfig 结构**：

```typescript
interface SkillConfig {
  name: string           // Skill 名称
  description: string   // Skill 描述
  content: string       // SKILL.md 内容
}
```

**MCPConfig 结构**：

```typescript
interface MCPConfig {
  name: string           // MCP 服务器名称
  type: 'local' | 'remote'
  command?: string[]     // local 类型：启动命令
  url?: string           // remote 类型：服务地址
  env?: Record<string, string>  // 环境变量
}
```

**输出**：生成 `/roles/{role-name}/` 目录，包含所有配置文件。

#### 3.1.2 配置更新

**需求**：支持修改已有角色的配置，修改后需重启容器生效。

**流程**：
1. 修改配置文件（opencode.json / prompts/ / .opencode/）
2. 触发容器重启
3. 等待健康检查通过
4. 返回更新结果

---

### 3.2 容器生命周期管理

#### 3.2.1 创建并启动容器

**需求**：根据角色配置启动 Docker 容器。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| roleId | string | ✅ | 角色标识 |
| configPath | string | ✅ | 配置目录路径（宿主机） |
| port | number | ❌ | 暴露端口，默认 4096 |
| env | object | ❌ | 额外环境变量 |

**环境变量注入**：

```yaml
# 必需环境变量
ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}  # AI 模型密钥

# OpenCode Serve 配置
OPENCODE_SERVER_PORT: 4096
OPENCODE_SERVER_HOSTNAME: 0.0.0.0
OPENCODE_SERVER_PASSWORD: ${随机生成或用户指定}
```

**挂载配置**：

```yaml
volumes:
  - ${configPath}/opencode.json:/app/opencode.json:ro
  - ${configPath}/prompts:/app/prompts:ro
  - ${configPath}/.opencode:/app/.opencode:ro
  - ${configPath}/mcp:/app/mcp:ro
```

**输出**：

```typescript
interface ContainerInfo {
  id: string              // 容器 ID
  name: string            // 容器名称
  status: 'running' | 'stopped' | 'error'
  url: string             // API 地址
  port: number
  createdAt: Date
}
```

#### 3.2.2 停止容器

**需求**：停止运行中的容器，保留配置和数据。

**流程**：
1. 发送停止信号
2. 等待容器停止（超时 30s）
3. 超时则强制终止

#### 3.2.3 重启容器

**需求**：重启容器以加载新配置。

**场景**：
- 配置文件修改后
- 容器异常后恢复
- 手动触发

**流程**：
1. 停止容器
2. 启动容器
3. 健康检查
4. 返回结果

#### 3.2.4 删除容器

**需求**：删除容器实例（不删除配置）。

---

### 3.3 依赖安装

#### 3.3.1 Skills 依赖

**需求**：Skills 可能依赖外部包（npm/pip），需要在构建镜像时安装。

**方案**：

```dockerfile
# Dockerfile 中预装常见依赖
RUN npm install -g \
    typescript \
    ts-node \
    @anthropic-ai/sdk

# 或者在容器启动时按需安装
# 通过 opencode.json 的 plugins 字段声明
```

**处理策略**：
- 基础镜像预装常用依赖
- 特殊依赖在 Dockerfile 中声明
- 运行时检查依赖，缺失则报错

#### 3.3.2 MCP 依赖

**需求**：MCP 服务器可能需要特定的运行时环境。

**常见 MCP 依赖**：

| MCP 类型 | 依赖 | 处理方式 |
|---------|------|---------|
| npm 包 MCP | Node.js | 基础镜像已包含 |
| Python MCP | Python + pip | 需在 Dockerfile 安装 |
| 二进制 MCP | 对应二进制 | 需在 Dockerfile 安装 |

**方案**：
- 基础镜像预装 Node.js
- Python MCP 通过扩展镜像支持
- 提供依赖检查接口

---

### 3.4 健康检查

#### 3.4.1 容器启动检查

**需求**：容器启动后确认 OpenCode Serve 正常运行。

**检查方式**：

```typescript
async function healthCheck(url: string, timeout = 30000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`${url}/health`)
      if (response.ok) return true
    } catch {
      // 继续等待
    }
    await sleep(1000)
  }
  return false
}
```

**检查内容**：
- HTTP 服务响应
- OpenCode 版本信息
- 基础模型连通性（可选）

#### 3.4.2 运行时监控

**需求**：定期检查容器健康状态。

**指标**：
- 容器状态（running/stopped）
- API 响应时间
- 内存使用率（可选）

---

### 3.5 问答 API

#### 3.5.1 创建会话

**需求**：为问答创建 OpenCode Session。

```
POST /api/roles/{roleId}/sessions

Request:
{
  "title": "可选标题"
}

Response:
{
  "sessionId": "sess_xxx",
  "roleId": "role_xxx",
  "createdAt": "2026-05-13T10:00:00Z"
}
```

#### 3.5.2 发送消息

**需求**：向角色发送消息并获取回复。

```
POST /api/roles/{roleId}/sessions/{sessionId}/messages

Request:
{
  "content": "请帮我写一段产品介绍",
  "stream": true  // 是否流式返回
}

Response (非流式):
{
  "messageId": "msg_xxx",
  "content": "好的，这是为您准备的产品介绍...",
  "createdAt": "2026-05-13T10:01:00Z"
}

Response (流式):
data: {"type": "text", "text": "好的"}
data: {"type": "text", "text": "，这是"}
data: {"type": "done"}
```

#### 3.5.3 获取历史消息

```
GET /api/roles/{roleId}/sessions/{sessionId}/messages

Response:
{
  "messages": [
    {
      "id": "msg_xxx",
      "role": "user",
      "content": "请帮我写一段产品介绍",
      "createdAt": "2026-05-13T10:00:00Z"
    },
    {
      "id": "msg_yyy",
      "role": "assistant",
      "content": "好的，这是为您准备的产品介绍...",
      "createdAt": "2026-05-13T10:01:00Z"
    }
  ]
}
```

#### 3.5.4 关闭会话

```
DELETE /api/roles/{roleId}/sessions/{sessionId}
```

---

### 3.6 容器访问

#### 3.6.1 直接 API 访问

**需求**：容器启动后，外部可直接访问 OpenCode Serve API。

**访问方式**：
```
http://localhost:{port}/
```

**认证**：
- Basic Auth：用户名 `opencode`，密码为启动时设置的值
- 或无认证（仅开发环境）

#### 3.6.2 代理访问（可选）

**需求**：通过编排层代理请求，统一入口。

```
POST /api/roles/{roleId}/proxy/*

将请求转发到对应容器的 OpenCode Serve
```

---

## 4. 技术设计

### 4.1 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     管理服务 (Node.js)                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ 配置管理器   │ │ 容器管理器   │ │ 问答服务         │   │
│  │ ConfigMgr  │ │ ContainerMgr│ │ QAService       │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Docker API (dockerode)                          │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │   角色容器 (Docker)        │
              │  ┌─────────────────────┐  │
              │  │ OpenCode Serve      │  │
              │  │ :4096              │  │
              │  └─────────────────────┘  │
              │  挂载: opencode.json      │
              │        prompts/           │
              │        .opencode/        │
              └───────────────────────────┘
```

### 4.2 目录结构

```
/roles/
  /{role-id}/
    opencode.json
    prompts/
      {agent-name}.txt
    .opencode/
      skills/
        {skill}/
          SKILL.md
    mcp/
      {mcp-name}.json

/containers/
  /{container-id}/
    logs/
    state.json
```

### 4.3 API 设计总览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/roles | 创建角色配置 |
| GET | /api/roles/{id} | 获取角色配置 |
| PUT | /api/roles/{id} | 更新角色配置 |
| DELETE | /api/roles/{id} | 删除角色配置 |
| POST | /api/roles/{id}/containers | 启动容器 |
| GET | /api/roles/{id}/containers | 获取容器列表 |
| POST | /api/containers/{id}/restart | 重启容器 |
| POST | /api/containers/{id}/stop | 停止容器 |
| DELETE | /api/containers/{id} | 删除容器 |
| POST | /api/roles/{id}/sessions | 创建会话 |
| POST | /api/roles/{id}/sessions/{sid}/messages | 发送消息 |
| GET | /api/roles/{id}/sessions/{sid}/messages | 获取历史 |
| DELETE | /api/roles/{id}/sessions/{sid} | 关闭会话 |

---

## 5. 数据模型

### 5.1 角色配置 (RoleConfig)

```typescript
interface RoleConfig {
  id: string
  name: string
  description: string
  
  // Agent 配置
  agent: {
    name: string
    prompt: string           // 提示词内容或文件路径
    model: string            // 模型 ID
    temperature?: number
    maxTokens?: number
    tools?: {
      read?: boolean
      write?: boolean
      edit?: boolean
      bash?: boolean
    }
  }
  
  // Skills 配置
  skills?: {
    name: string
    description: string
    instructions: string     // SKILL.md 内容
  }[]
  
  // MCP 配置
  mcpServers?: {
    name: string
    type: 'local' | 'remote'
    command?: string[]       // local 类型
    url?: string             // remote 类型
    env?: Record<string, string>
  }[]
  
  // 元数据
  createdAt: Date
  updatedAt: Date
}
```

### 5.2 容器实例 (ContainerInstance)

```typescript
interface ContainerInstance {
  id: string
  roleId: string
  containerId: string        // Docker 容器 ID
  
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  
  // 网络配置
  port: number
  url: string
  password: string
  
  // 状态信息
  healthStatus: 'healthy' | 'unhealthy' | 'unknown'
  lastHealthCheck: Date
  
  // 时间戳
  createdAt: Date
  startedAt?: Date
  stoppedAt?: Date
  
  // 错误信息
  errorMessage?: string
}
```

### 5.3 会话 (Session)

```typescript
interface Session {
  id: string
  roleId: string
  containerId: string
  opencodeSessionId: string  // OpenCode SDK 的 session ID
  
  title?: string
  status: 'active' | 'closed'
  
  createdAt: Date
  closedAt?: Date
}
```

---

## 6. 接口详细设计

### 6.1 创建角色配置

```
POST /api/roles

Request Body:
{
  "name": "copywriter",
  "description": "资深文案，擅长品牌文案、社交媒体内容",
  "agent": {
    "name": "copywriter",
    "prompt": "你是一位资深文案...",
    "model": "anthropic/claude-sonnet-4-5",
    "temperature": 0.7,
    "tools": {
      "read": true,
      "write": true,
      "edit": true,
      "bash": false
    }
  },
  "skills": [
    {
      "name": "write-post",
      "description": "撰写社交媒体帖子",
      "instructions": "根据用户需求撰写..."
    }
  ],
  "mcpServers": [
    {
      "name": "filesystem",
      "type": "local",
      "command": ["npx", "-y", "@anthropic-ai/mcp-server-filesystem", "/data"]
    }
  ]
}

Response: 201 Created
{
  "id": "role_xxx",
  "name": "copywriter",
  "description": "资深文案...",
  "createdAt": "2026-05-13T10:00:00Z"
}
```

### 6.2 启动容器

```
POST /api/roles/{roleId}/containers

Request Body:
{
  "port": 4096,
  "env": {
    "CUSTOM_VAR": "value"
  }
}

Response: 201 Created
{
  "id": "container_xxx",
  "roleId": "role_xxx",
  "containerId": "docker_xxx",
  "status": "starting",
  "url": "http://localhost:4096",
  "port": 4096,
  "createdAt": "2026-05-13T10:00:00Z"
}
```

**异步流程**：
1. 立即返回容器创建信息（status: starting）
2. 后台启动容器并等待健康检查
3. 健康检查通过后更新 status 为 running
4. 客户端可通过 GET 接口轮询状态

### 6.3 重启容器

```
POST /api/containers/{containerId}/restart

Response: 200 OK
{
  "id": "container_xxx",
  "status": "running",
  "healthStatus": "healthy",
  "startedAt": "2026-05-13T10:05:00Z"
}
```

**流程**：
1. 停止容器
2. 重新读取最新配置
3. 启动容器
4. 健康检查
5. 返回结果

### 6.4 发送消息（问答）

```
POST /api/roles/{roleId}/sessions/{sessionId}/messages

Request Body:
{
  "content": "请帮我写一段咖啡品牌的产品介绍",
  "stream": false
}

Response: 200 OK
{
  "id": "msg_xxx",
  "role": "assistant",
  "content": "好的，这是为您准备的咖啡品牌产品介绍：\n\n**晨光咖啡** — 每一天的美好开始...",
  "createdAt": "2026-05-13T10:10:00Z"
}
```

**流式响应**：
```
POST /api/roles/{roleId}/sessions/{sessionId}/messages
Accept: text/event-stream

Request Body:
{
  "content": "请帮我写一段咖啡品牌的产品介绍",
  "stream": true
}

Response: 200 OK
Content-Type: text/event-stream

data: {"type": "text", "text": "好的"}
data: {"type": "text", "text": "，这是"}
data: {"type": "text", "text": "为您准备的..."}
data: {"type": "done", "messageId": "msg_xxx"}
```

---

## 7. 错误处理

### 7.1 错误码定义

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| ROLE_NOT_FOUND | 角色不存在 | 404 |
| ROLE_ALREADY_EXISTS | 角色名称已存在 | 409 |
| CONTAINER_NOT_FOUND | 容器不存在 | 404 |
| CONTAINER_ERROR | 容器启动/运行错误 | 500 |
| CONTAINER_TIMEOUT | 容器健康检查超时 | 504 |
| SESSION_NOT_FOUND | 会话不存在 | 404 |
| INVALID_CONFIG | 配置格式错误 | 400 |
| DEPENDENCY_ERROR | 依赖安装失败 | 500 |
| API_KEY_MISSING | 缺少 API Key | 400 |

### 7.2 错误响应格式

```json
{
  "error": {
    "code": "CONTAINER_TIMEOUT",
    "message": "容器健康检查超时，OpenCode Serve 未能正常启动",
    "details": {
      "containerId": "docker_xxx",
      "timeout": 30000,
      "logs": "..."
    }
  }
}
```

---

## 8. 非功能需求

### 8.1 性能要求

| 指标 | 要求 |
|------|------|
| 容器启动时间 | < 30s（不含镜像拉取） |
| 健康检查超时 | 30s |
| API 响应时间 | < 200ms（不含 AI 推理） |
| 并发问答请求 | >= 10 个同时进行 |

### 8.2 可靠性要求

| 指标 | 要求 |
|------|------|
| 容器重启成功率 | >= 99% |
| 配置更新生效时间 | < 60s |
| API 可用性 | >= 99.5% |

### 8.3 安全要求

- API Key 通过环境变量注入，不落盘
- 容器间网络隔离（可选）
- 支持请求认证（后续扩展）

---

## 9. 测试验收标准

### 9.1 功能测试

| 测试项 | 验收标准 |
|--------|---------|
| 创建角色配置 | 配置文件正确生成，可通过 API 读取 |
| 启动容器 | 容器状态为 running，健康检查通过 |
| 配置修改后重启 | 新配置生效，问答行为符合预期 |
| 问答功能 | 能正常创建会话、发送消息、获取回复 |
| 流式响应 | SSE 正常推送，内容完整 |
| 错误处理 | 异常情况返回正确错误码和信息 |

### 9.2 边界测试

| 测试项 | 验收标准 |
|--------|---------|
| 无效配置 | 返回 INVALID_CONFIG 错误 |
| 重复端口 | 返回错误或自动分配其他端口 |
| 容器异常退出 | 自动检测并更新状态 |
| 依赖缺失 | 返回 DEPENDENCY_ERROR 错误 |

---

## 10. 实施计划

### 10.1 阶段划分

| 阶段 | 内容 | 预计工时 |
|------|------|---------|
| 阶段 1 | 基础镜像 + 配置生成 | 2-3 天 |
| 阶段 2 | 容器管理（启动/停止/重启） | 2-3 天 |
| 阶段 3 | 问答 API + Session 管理 | 2-3 天 |
| 阶段 4 | 测试 + 文档 | 1-2 天 |

### 10.2 交付物

```
/
├── /images
│   └── /opencode-role
│       ├── Dockerfile
│       └── entrypoint.sh
├── /src
│   ├── /services
│   │   ├── config-manager.ts
│   │   ├── container-manager.ts
│   │   └── qa-service.ts
│   ├── /api
│   │   ├── roles.ts
│   │   ├── containers.ts
│   │   └── sessions.ts
│   └── index.ts
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 附录 A：opencode.json 示例

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "default_agent": "copywriter",
  "agent": {
    "copywriter": {
      "mode": "primary",
      "description": "资深文案，擅长品牌文案、社交媒体内容",
      "prompt": "{file:./prompts/copywriter.txt}",
      "temperature": 0.7,
      "tools": {
        "read": true,
        "write": true,
        "edit": true,
        "bash": false
      }
    }
  },
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@anthropic-ai/mcp-server-filesystem", "/data"]
    }
  },
  "server": {
    "port": 4096,
    "hostname": "0.0.0.0"
  }
}
```

---

## 附录 B：Dockerfile 示例

```dockerfile
FROM node:20-alpine

# 安装 OpenCode CLI
RUN npm install -g @anthropic-ai/opencode-cli

# 安装常用依赖
RUN npm install -g \
    typescript \
    ts-node

# 创建工作目录
WORKDIR /app

# 复制配置（运行时挂载覆盖）
COPY opencode.json ./
COPY prompts/ ./prompts/
COPY .opencode/ ./.opencode/

# 暴露端口
EXPOSE 4096

# 启动 OpenCode Serve
CMD ["opencode", "serve", "--port", "4096", "--hostname", "0.0.0.0"]
```

---

## 附录 C：快速开始示例

```bash
# 1. 创建角色配置
curl -X POST http://localhost:3000/api/roles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "copywriter",
    "description": "资深文案",
    "agent": {
      "name": "copywriter",
      "prompt": "你是一位资深文案...",
      "model": "anthropic/claude-sonnet-4-5"
    }
  }'

# 2. 启动容器
curl -X POST http://localhost:3000/api/roles/role_xxx/containers

# 3. 创建会话
curl -X POST http://localhost:3000/api/roles/role_xxx/sessions

# 4. 发送消息
curl -X POST http://localhost:3000/api/roles/role_xxx/sessions/sess_xxx/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "请帮我写一段产品介绍"
  }'
```
