# 多 AI 角色协作群聊系统 — 实现方案简要说明

> 版本 0.1 | 2026-05-11

---

## 1. 技术选型

### 1.1 编排层

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行时 | **Node.js (TypeScript)** | OpenCode SDK 是 TS 包，原生集成 |
| Web 框架 | **Hono** 或 **Fastify** | 轻量高性能，适合 API + WebSocket |
| 数据库 | **PostgreSQL** | 关系型数据，适合复杂的实体关系和事务 |
| ORM | **Drizzle ORM** | 类型安全，轻量，与 TS 生态契合 |
| 实时通信 | **WebSocket** | 群聊消息实时推送、AI 回复流式输出 |
| 容器管理 | **Docker API** (dockerode) | Node.js 原生 Docker SDK |
| AI SDK | **@opencode-ai/sdk** | 官方 SDK，类型安全 |

### 1.2 角色容器

| 组件 | 选型 | 理由 |
|------|------|------|
| 基础镜像 | **alpine / node** | 轻量，只装 opencode CLI |
| AI 运行时 | **opencode serve** | 官方无头 HTTP 服务器 |
| 配置 | **opencode.json** + Markdown | 官方配置体系 |

### 1.3 前端

| 组件 | 选型 | 理由 |
|------|------|------|
| 框架 | **Next.js** 或 **Nuxt** | SSR + 良好的实时能力 |
| UI | **shadcn/ui** 或类似 | 快速构建，组件可定制 |
| 状态管理 | **Zustand / Jotai** | 轻量，适合实时消息流 |

### 1.4 基础设施

| 组件 | 选型 |
|------|------|
| 容器编排 | Docker Compose（初期）→ Kubernetes（规模扩大后） |
| 文件存储 | 本地 Volume（初期）→ S3/MinIO（生产） |
| 消息队列 | Redis Streams 或 BullMQ（异步任务处理） |
| 监控 | OpenTelemetry + Grafana |

---

## 2. 分阶段实施路线

### Phase 0: 验证原型（1-2 周）

**目标**：验证 OpenCode SDK + Docker 部署 + 多角色协作的核心可行性

```
最小可运行原型:
  1. 手动启动 2 个 opencode serve 容器（文案 + 运营）
  2. 编写一个 Node.js 脚本通过 SDK 与两个容器交互
  3. 模拟群聊：人类消息 → 架构师回复 → 运营回复
  4. 验证 context/ 文件注入 + AI 读取流程
  5. 验证结构化输出（handoff 协议）
  6. 验证 rules/ 写入 + 新 session 加载
```

**交付物**：
- 可运行的 demo 脚本
- 技术可行性验证报告
- 发现的技术风险和限制

**关键验证点**：
- OpenCode Serve 在 Docker 内是否正常运行
- SDK 的 `session.prompt()` 结构化输出是否可靠
- `instructions` 通配是否在 session 创建时正确加载新文件
- AI 是否能可靠地通过 Read 工具读取 context/ 文件
- `session.summarize()` 的摘要质量如何

### Phase 1: 编排层核心（3-4 周）

**目标**：构建编排层的核心模块，支持单群聊多角色协作

```
核心模块:
  1. Docker 容器管理（启动/停止/健康检查）
  2. OpenCode SDK 封装（session 创建/复用/轮换）
  3. 文件系统管理（AGENTS.md 生成、context/ 写入、rules/ 管理）
  4. 消息路由基础版（@提及 + handoff 解析）
  5. 简单 HTTP API（创建群聊、发送消息、获取消息）
```

**交付物**：
- 编排层后端服务
- 基础 REST API
- 角色模板 Dockerfile（2-3 个角色）
- docker-compose.yml（编排层 + 角色容器）

**不含**：前端 UI（用 API 工具 / CLI 测试）

### Phase 2: 前端与完整交互（3-4 周）

**目标**：构建可用的群聊 UI，完整的用户交互闭环

```
前端:
  1. 群聊界面（类似 Slack/飞书 的聊天 UI）
  2. 消息类型区分（人类/AI/系统/交接）
  3. 审批门 UI（待审批状态、通过/打回按钮）
  4. AI 回复流式显示（WebSocket 推送）
  5. @提及 角色选择器

后端补充:
  1. WebSocket 实时推送
  2. 人类审批门完整逻辑
  3. 工作记要自动维护
  4. 产出物管理
```

**交付物**：
- 可用的 Web 前端
- WebSocket 实时通信
- 完整的群聊运行时

### Phase 3: 多租户与管理（2-3 周）

**目标**：支持公司管理、多项目、员工生命周期

```
功能:
  1. 公司注册/管理
  2. 人类成员与权限
  3. 角色市场/聘请流程
  4. 员工入职/升级/离职
  5. 项目管理（1:N 群聊）
  6. 成本统计（Token 用量追踪）
  7. 容器自动休眠/唤醒
```

**交付物**：
- 完整的多租户系统
- 管理后台
- 成本仪表盘

### Phase 4: 优化与扩展（持续）

```
优化:
  1. 消息路由智能化（路由 AI 辅助决策）
  2. 记忆管理优化（自动归类、经验去重）
  3. 并发优化（同一员工多群聊并行）
  4. 错误恢复（AI 回复异常时的重试/降级）
  5. 容器编排迁移到 K8s

扩展:
  1. 角色市场（公共角色模板发布）
  2. 自定义角色构建器
  3. 跨公司协作
  4. 更多 AI 模型支持
```

---

## 3. 关键模块实现要点

### 3.1 OpenCode 集成层

```typescript
// integrations/opencode.ts — 核心封装

class OpenCodeClient {
  private client: SDKClient

  constructor(baseUrl: string, password?: string) {
    this.client = createOpencodeClient({
      baseUrl,
      headers: password
        ? { Authorization: `Basic ${btoa(`opencode:${password}`)}` }
        : undefined
    })
  }

  // 创建群聊专属 session
  async createGroupSession(title: string): Promise<string> {
    const session = await this.client.session.create({
      body: { title }
    })
    return session.data.id
  }

  // 发送任务并获取结构化回复
  async sendTask(
    sessionId: string,
    instruction: string
  ): Promise<TaskResult> {
    const result = await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: instruction }],
        format: {
          type: "json_schema",
          schema: HANDOFF_SCHEMA
        }
      }
    })
    return this.parseTaskResult(result)
  }

  // 触发保存经验
  async saveExperience(sessionId: string): Promise<void> {
    await this.client.session.command({
      path: { id: sessionId },
      body: { command: "save-experience" }
    })
  }

  // Session 轮换
  async rotateSession(oldSessionId: string, title: string): Promise<string> {
    // 1. 让 AI 保存经验
    await this.saveExperience(oldSessionId)
    // 2. 生成摘要
    await this.client.session.summarize({
      path: { id: oldSessionId },
      body: { providerID: "anthropic", modelID: "claude-haiku-4-5" }
    })
    // 3. 新建 session
    const newSession = await this.client.session.create({
      body: { title: `${title}-continued` }
    })
    // 4. 删除旧 session
    await this.client.session.delete({
      path: { id: oldSessionId }
    })
    return newSession.data.id
  }
}
```

### 3.2 Docker 容器管理

```typescript
// integrations/docker.ts — 容器生命周期

class ContainerManager {
  // 入职：启动员工容器
  async hireEmployee(
    roleTemplate: RoleTemplate,
    company: Company,
    employee: Employee
  ): Promise<string> {
    const container = await docker.createContainer({
      Image: roleTemplate.image,
      Hostname: `${employee.id}`,
      Env: [
        `OPENCODE_SERVER_PASSWORD=${generatePassword()}`,
        `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`
      ],
      HostConfig: {
        Binds: [
          `${employee.volumes.rules}:/app/rules`,
          `${employee.volumes.context}:/app/context`,
          `${agbasePath}:/app/AGENTS.md:ro`,
          `${companyInfoPath}:/app/company/info.md:ro`
        ],
        RestartPolicy: { Name: 'unless-stopped' },
        Memory: 512 * 1024 * 1024  // 512MB 限制
      }
    })
    await container.start()
    return container.id
  }

  // 健康检查
  async waitForHealthy(
    containerUrl: string,
    timeoutMs = 30000
  ): Promise<boolean> {
    const client = createOpencodeClient({ baseUrl: containerUrl })
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        await client.global.health()
        return true
      } catch {
        await sleep(1000)
      }
    }
    return false
  }

  // 升级：替换镜像保留 Volume
  async upgradeEmployee(employee: Employee, newImage: string): Promise<void> {
    // 1. 保存经验
    // 2. 停止旧容器
    // 3. 用新镜像 + 旧 Volume 启动
    // 4. 健康检查
  }
}
```

### 3.3 消息路由

```typescript
// core/router.ts — 消息路由决策

class MessageRouter {
  determineRoute(
    message: Message,
    group: GroupChat,
    flowConfig?: FlowConfig
  ): RouteResult {
    // 人类 @提及
    if (message.senderType === 'human' && message.mention) {
      return {
        type: 'direct',
        targetEmployeeId: this.resolveMention(message.mention, group),
        instruction: `请查看 context/current-task.md，${message.mention}需要你处理以下事项：${message.content}`
      }
    }

    // AI handoff
    if (message.senderType === 'ai' && message.handoff) {
      if (message.handoff.needHuman) {
        return { type: 'human_approval', message }
      }
      return {
        type: 'handoff',
        targetEmployeeId: this.resolveRole(message.handoff.nextRole, group),
        instruction: `上一位同事交接给你：${message.handoff.context}`
      }
    }

    // 流程驱动
    if (flowConfig) {
      return this.routeByFlow(flowConfig, group)
    }

    return { type: 'broadcast', message }
  }
}
```

### 3.4 Handoff 结构化输出 Schema

```typescript
// core/handoff.ts — 交接协议

const HANDOFF_SCHEMA = {
  type: "object",
  properties: {
    response: {
      type: "string",
      description: "你在群聊中的回复内容"
    },
    deliverables: {
      type: "array",
      items: { type: "string" },
      description: "本次工作产出的文件路径列表"
    },
    handoff: {
      type: "object",
      properties: {
        next: {
          type: "string",
          description: "建议下一个接手的角色名（群里存在的角色）"
        },
        reason: {
          type: "string",
          description: "交接原因"
        },
        context: {
          type: "string",
          description: "给下一个角色的补充信息"
        }
      },
      required: ["next", "reason"]
    },
    need_human: {
      type: "boolean",
      description: "是否需要人类审批后才能继续"
    },
    human_note: {
      type: "string",
      description: "给人类审批者的说明"
    }
  },
  required: ["response", "handoff"]
}
```

---

## 4. 部署方案

### 4.1 开发环境

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  orchestrator:
    build: ./orchestrator
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/askai
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: askai
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  # 角色容器（由编排层动态管理，此处仅做开发参考）
  copywriter-dev:
    build: ./role-templates/copywriter
    profiles:
      - dev
    ports:
      - "4096:4096"
    environment:
      - OPENCODE_SERVER_PASSWORD=dev
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

volumes:
  pgdata:
```

### 4.2 生产环境

```
                    ┌─────────────────────┐
                    │   Load Balancer      │
                    │   (Nginx / Caddy)    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Orchestrator ×N    │
                    │   (无状态，可水平扩展) │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
     │  PostgreSQL    │ │  Redis       │ │  MinIO/S3    │
     │  (数据)        │ │  (队列/缓存)  │ │  (文件存储)   │
     └───────────────┘ └──────────────┘ └──────────────┘

     角色容器（按需启动/停止）
     ┌────────┐ ┌────────┐ ┌────────┐
     │ 文案-A  │ │ 运营-A  │ │ 架构-B │  ...
     └────────┘ └────────┘ └────────┘
```

---

## 5. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| OpenCode Serve 不稳定 | 低 | 高 | Phase 0 充分验证；健康检查 + 自动重启 |
| 结构化输出不可靠 | 中 | 高 | 重试机制 + 降级为自由文本解析 |
| AI 不遵循 handoff 协议 | 中 | 中 | Prompt 工程 + few-shot 示例 + 多次重试 |
| Token 成本过高 | 中 | 中 | rules/_meta.md 索引 + 按需加载 + 小模型做摘要 |
| Docker 容器管理复杂度 | 中 | 中 | 限制并发数 + 自动休眠 + 编排层集中管理 |
| 非代码场景 AI 效果差 | 中 | 中 | 精心设计角色 prompt + 定制 skills/commands |
| 多角色串行延迟高 | 中 | 低 | 并行任务同时触发 + 流式回复 |

---

## 6. 开发优先级建议

**先做这些**（决定项目成败）：
1. Phase 0 的技术验证
2. Handoff 协议设计 + 结构化输出可靠性测试
3. 文件注入机制验证（context/ 写入 → AI 读取 → 产出）

**后做这些**（可渐进完善）：
1. 角色市场 / 购买流程
2. 多租户权限体系
3. 成本统计仪表盘
4. 容器自动休眠/唤醒
5. K8s 迁移
