# 多 AI 角色协作群聊系统 — 项目设计文档

> 版本 0.1 | 2026-05-11

---

## 1. 系统概述

### 1.1 产品定位

一个以"群聊"为协作界面的多 AI 角色工作平台。人类和 AI 角色在群聊中围绕项目进行协作，AI 基于各自的职能完成工作并交接，最终交付项目成果。

### 1.2 核心理念

- **角色即服务**：每个 AI 角色是独立的 Docker 容器，通过 OpenCode Serve 暴露 API
- **公司实例化**：通用角色模板"被聘请"后，挂载公司/项目信息，成为公司专属 AI 员工
- **文件即记忆**：长期记忆通过文件系统（AGENTS.md + rules/）管理，不依赖 SDK 注入
- **编排层为大脑**：消息路由、工作交接、记忆管理由编排层统一控制

### 1.3 目标用户

- 需要多角色协作完成项目的团队（不限代码项目）
- 希望通过 AI 辅助提升内容、运营、策划等工作效率的公司

---

## 2. 系统架构

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                        前端 (Web)                             │
│              群聊界面 · 角色管理 · 项目管理                      │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼───────────────────────────────────┐
│                     编排层 (Orchestrator)                      │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ 消息路由  │ │ Session  │ │ 记忆管理  │ │ 成本/资源管理 │    │
│  │ Router   │ │ Manager  │ │ Memory   │ │ Metrics      │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ 公司管理  │ │ 项目管理  │ │ 员工管理  │ │ 工作记要      │    │
│  │ Tenant   │ │ Project  │ │ Employee │ │ Journal      │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  数据库 (PostgreSQL)                                  │    │
│  │  群聊消息 · 映射关系 · 工作记要 · 用量统计              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  文件存储                                             │    │
│  │  AGENTS.md · rules/ · context/ · deliverables/        │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────┬────────────┬────────────┬────────────────────────┘
           │            │            │
     ┌─────▼──┐   ┌────▼───┐   ┌───▼────┐
     │ 架构师  │   │ 运营   │   │  文案   │   ... 更多角色
     │:4096   │   │:4096   │   │:4096   │
     │ Docker │   │ Docker │   │ Docker │
     └────────┘   └────────┘   └────────┘
```

### 2.2 组件职责

| 组件 | 职责 |
|------|------|
| **前端** | 群聊 UI、角色/项目管理界面、人类审批入口 |
| **编排层** | 系统大脑，管理所有业务逻辑和 AI 协调 |
| **数据库** | 持久化群聊消息、映射关系、工作记要、统计数据 |
| **文件存储** | AI 的记忆和上下文，容器通过 Volume/挂载访问 |
| **角色容器** | 独立的 OpenCode Serve 实例，只负责 AI 对话 |

---

## 3. 数据模型

### 3.1 核心实体关系

```
Company 1──N Employee  ──┐
    │                    ├──N GroupChat 1──N Message
    └──N Project ────────┘         │
         │                         └──N SessionMapping
         └──N Deliverable
```

### 3.2 角色模板 (RoleTemplate)

```typescript
interface RoleTemplate {
  id: string                  // 'copywriter' | 'architect' | 'ops' | ...
  name: string                // '资深文案'
  version: string             // '1.0.0'
  description: string         // 角色描述
  capabilities: string        // 能力概述
  image: string               // Docker 镜像地址
  config: {                   // OpenCode 配置
    model: string
    agent: AgentConfig
    tools: Record<string, boolean>
    mcp?: Record<string, MCPConfig>
    skills?: string[]
    plugins?: string[]
    commands?: CommandConfig[]
  }
  category: string            // '技术' | '内容' | '运营' | '管理'
  price?: {                   // 如果有市场概念
    type: 'free' | 'paid'
    amount?: number
  }
}
```

### 3.3 公司 (Company)

```typescript
interface Company {
  id: string
  name: string
  industry: string
  description: string
  brandGuidelines?: string    // 品牌规范
  members: CompanyMember[]    // 人类成员
  createdAt: Date
}

interface CompanyMember {
  userId: string
  name: string
  role: 'owner' | 'admin' | 'member'
  permissions: string[]       // 可操作范围
}
```

### 3.4 员工 (Employee) — 角色实例化

```typescript
interface Employee {
  id: string
  companyId: string
  roleTemplateId: string
  roleTemplateVersion: string  // 聘请时的版本
  name: string                 // 可自定义，如 '小明文案'
  status: 'active' | 'inactive' | 'archived'
  containerId?: string         // 运行中的 Docker 容器 ID
  containerUrl?: string        // OpenCode Serve 地址
  volumes: {
    rules: string              // rules/ volume 路径
    context: string            // context/ 路径
  }
  hiredAt: Date
  firedAt?: Date
}
```

### 3.5 项目 (Project)

```typescript
interface Project {
  id: string
  companyId: string
  name: string
  description: string
  goals: string[]              // 项目目标
  constraints: string[]        // 约束条件
  status: 'planning' | 'active' | 'completed' | 'archived'
  employeeIds: string[]        // 参与的员工
  basePath: string             // 文件存储根路径
  createdAt: Date
}
```

### 3.6 群聊 (GroupChat)

```typescript
interface GroupChat {
  id: string
  projectId: string
  name: string
  topic?: string               // 当前讨论主题
  participants: Participant[]
  status: 'active' | 'paused' | 'closed'
  createdAt: Date
}

interface Participant {
  type: 'human' | 'ai'
  id: string                   // userId 或 employeeId
  name: string
  role: string                 // 在此群中的角色标签
  sessionId?: string           // AI 的 OpenCode session ID
}
```

### 3.7 消息 (Message)

```typescript
interface Message {
  id: string
  groupId: string
  senderId: string
  senderType: 'human' | 'ai'
  senderName: string
  content: string
  handoff?: {                  // AI 消息特有的交接信息
    nextRole: string
    reason: string
    context?: string
    needHuman: boolean
  }
  deliverableIds?: string[]    // 关联的产出物
  createdAt: Date
}
```

### 3.8 工作记要 (Journal)

```typescript
interface Journal {
  id: string
  projectId: string
  entries: JournalEntry[]
}

interface JournalEntry {
  id: string
  date: Date
  type: 'milestone' | 'decision' | 'issue' | 'handoff'
  title: string
  content: string
  groupId?: string             // 关联的群聊
  senderId?: string            // 触发者
  deliverableIds?: string[]
}
```

---

## 4. 文件系统设计

### 4.1 目录结构

```
/data/
  /role-templates/                          # 角色模板仓库
    /copywriter/
      Dockerfile
      opencode.json
      role/
        capabilities.md
      .opencode/
        agents/
        skills/
        commands/
          save-experience.md
    /architect/
      ...
    /ops/
      ...

  /tenants/                                 # 租户（公司）数据
    /{company-id}/
      company-info.md                       # 公司信息

      /employees/                           # 员工实例
        /{employee-id}/
          AGENTS.md                         # 合并生成（角色能力 + 公司信息 + 项目信息）
          rules/
            _meta.md                        # 经验索引
            exp-001.md                      # 详细经验
          context/                          # 临时任务上下文
            current-task.md

      /projects/                            # 项目
        /{project-id}/
          project.md                        # 项目描述
          journal.md                        # 工作记要
          /groups/
            /{group-id}/
              session-mappings.json         # 角色 → session ID 映射
          /deliverables/                    # 产出物
            /{deliverable-id}/
              ...
          /rules/                           # 项目级共享经验（跨群聊）
            _meta.md
            exp-001.md
```

### 4.2 AGENTS.md 模板

编排层在员工入职时合并生成：

```markdown
# {公司名} — {角色名}

## 公司信息
{从 company-info.md 合并}

## 你的职责
{从角色模板的 capabilities.md 合并}

## 当前参与的项目
{动态列出该员工参与的项目}

## 经验库
当前共有 {N} 条经验记录。根据任务需要，用 Read 工具读取 rules/ 下相关文件。
详见 rules/_meta.md 索引。
```

### 4.3 rules/_meta.md 模板

```markdown
# 经验索引 — {员工名}

## 核心经验
- {从各经验文件提取的关键结论}

## 详细经验文件
| 文件 | 内容 | 适用场景 |
|------|------|---------|
| rules/exp-summer-campaign.md | 夏季推广活动经验 | 做推广活动时 |
| rules/exp-brand-tone.md | 品牌调性偏好 | 写品牌文案时 |
```

### 4.4 context/current-task.md 模板

编排层在每次触发 AI 前写入：

```markdown
# 当前任务

## 群聊: {群名}
## 项目: {项目名}

## 任务说明
{本次需要完成的具体任务}

## 群聊记录
{本次任务相关的群聊消息摘要}

## 相关上下文
{指向其他文件的引用，如工作记要、之前的产出等}
```

---

## 5. 编排层设计

### 5.1 模块划分

```
orchestrator/
  /core
    router.ts          # 消息路由决策
    handoff.ts         # 工作交接协议
    session-manager.ts # Session 生命周期管理
  /services
    company.ts         # 公司管理
    employee.ts        # 员工（容器）管理
    project.ts         # 项目管理
    group.ts           # 群聊管理
    journal.ts         # 工作记要
    memory.ts          # 记忆文件读写
    metrics.ts         # 成本统计
  /integrations
    opencode.ts        # OpenCode SDK 封装
    docker.ts          # Docker API 封装
  /api
    routes/            # HTTP API
    ws/                # WebSocket（实时消息）
```

### 5.2 消息路由 (Router)

路由决策的三种模式：

```typescript
type RouteMode =
  | { type: 'mention', targetRoleId: string }       // 人类 @指定
  | { type: 'handoff', from: string, to: string }   // AI 交接
  | { type: 'flow', step: number }                   // 预定义流程
```

路由逻辑：

```
收到新消息
  ├── 人类发送 + @提及 → 直接路由到被提及的角色
  ├── 人类发送 + 无提及 → 按预定义流程的当前步骤路由
  ├── AI 发送 + 含 handoff → 解析 handoff.next，路由到目标角色
  ├── AI 发送 + need_human=true → 暂停，通知人类审批
  └── AI 发送 + 无 handoff → 广播到群内所有人
```

### 5.3 Session 管理 (SessionManager)

```typescript
class SessionManager {
  // 活跃 session 映射: (groupId, employeeId) → sessionId
  private activeSessions: Map<string, string>

  // 获取或创建 session
  async getOrCreate(groupId: string, employee: Employee): Promise<string>

  // 轮换过长的 session
  async rotateIfNeeded(groupId: string, employee: Employee): Promise<string>

  // 关闭群聊的所有 session
  async closeAll(groupId: string): Promise<void>
}
```

### 5.4 记忆管理 (MemoryManager)

```typescript
class MemoryManager {
  // 员工入职：生成 AGENTS.md
  async initializeEmployee(employee: Employee, company: Company): Promise<void>

  // 任务前：写入 context/current-task.md
  async writeTaskContext(
    employee: Employee,
    group: GroupChat,
    task: string,
    chatHistory: Message[]
  ): Promise<void>

  // 触发 AI 保存经验
  async triggerSaveExperience(
    employee: Employee,
    sessionId: string
  ): Promise<void>

  // Session 轮换前：保存重要上下文到文件
  async persistSessionContext(
    employee: Employee,
    sessionId: string
  ): Promise<void>

  // 项目级经验同步（员工的 rules/ → 项目的 rules/）
  async syncProjectExperiences(
    employee: Employee,
    project: Project
  ): Promise<void>
}
```

---

## 6. 角色容器设计

### 6.1 Docker 镜像结构

```
/opencode/
  opencode.json               # Agent 配置 + instructions 通配
  role/
    capabilities.md           # 角色能力描述
  prompts/
    {agent-name}.txt          # 角色系统提示词
  .opencode/
    agents/                   # 自定义 agent
    skills/                   # 技能定义
    commands/
      save-experience.md      # 保存经验命令
    plugins/                  # 插件
  mcp/                        # MCP 工具脚本（如有）
```

### 6.2 opencode.json 示例（文案角色）

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "default_agent": "copywriter",
  "instructions": [
    "role/capabilities.md",
    "company/*.md",
    "rules/_meta.md",
    "context/*.md"
  ],
  "agent": {
    "copywriter": {
      "mode": "primary",
      "description": "资深文案，擅长品牌文案、社交媒体内容、营销策划",
      "prompt": "{file:./prompts/copywriter.txt}",
      "temperature": 0.7,
      "tools": {
        "write": true,
        "edit": true,
        "bash": false
      }
    }
  },
  "compaction": {
    "auto": true,
    "reserved": 10000
  },
  "server": {
    "port": 4096,
    "hostname": "0.0.0.0"
  }
}
```

### 6.3 save-experience 命令

```markdown
---
description: 将当前工作中的重要经验写入记忆库
template: |
  回顾本次工作，将值得保留的经验写入记忆：
  1. 评估是否有值得记录的新经验或教训
  2. 如果有，写入 rules/{简短英文描述}.md，格式：
     - 场景：什么情况下适用
     - 发现：关键结论
     - 建议：具体做法
     - 避免：需要避免的错误
  3. 更新 rules/_meta.md 的索引表
  4. 如果没有值得特别记录的经验，回复"无新经验需要记录"。
---
```

---

## 7. 群聊运行时流程

### 7.1 创建群聊

```
1. 人类选择项目 + 参与角色
2. 编排层为每个 AI 角色创建 session
3. 为每个角色写入初始 context（项目描述、参与人员、目标）
4. 人类发第一条消息，启动协作
```

### 7.2 消息处理主循环

```
┌──────────────────────────────────────────────────┐
│ 收到消息                                          │
│                                                  │
│  判断发送者                                        │
│  ├── 人类消息                                      │
│  │   ├── 有 @提及 → 路由到指定角色                   │
│  │   └── 无提及 → 按流程/路由 AI 决定               │
│  │                                                │
│  └── AI 消息                                      │
│      ├── 解析 handoff → 路由到下一个角色             │
│      ├── need_human=true → 暂停，通知人类           │
│      └── 无 handoff → 广播到群                     │
│                                                  │
│  路由到角色时:                                      │
│  1. 更新 context/current-task.md                  │
│  2. 获取该角色的活跃 session                        │
│  3. session.prompt() 触发 AI                      │
│  4. 等待 AI 回复（监听 SSE 事件）                    │
│  5. 解析回复（结构化输出）                           │
│  6. 写入群聊消息                                    │
│  7. 更新工作记要                                    │
│  8. 继续路由循环                                    │
└──────────────────────────────────────────────────┘
```

### 7.3 人类审批门

```
AI 回复含 need_human=true
  → 编排层将 AI 的回复展示在群聊
  → 标记为"待审批"状态
  → 通知人类（WebSocket 推送）
  → 等待人类操作:
      ├── 通过 → 继续流程（按 handoff 路由）
      ├── 打回 → 带反馈重新触发该角色
      └── 重定向 → @其他角色接管
```

### 7.4 群聊结束

```
1. 人类明确结束 / 任务完成
2. 编排层触发每个 AI 角色的 save-experience
3. 更新工作记要（添加项目总结）
4. 将产出物移至 deliverables/
5. 同步员工经验到项目级 rules/
6. 关闭所有 session
7. 可选: 停止容器（节省资源）
```

---

## 8. 员工生命周期

### 8.1 入职流程

```
1. 选择角色模板 + 公司
2. 生成 AGENTS.md（合并角色能力 + 公司信息）
3. 创建 Docker Volume（rules/）
4. 启动容器（挂载 AGENTS.md + company/ + rules/ volume）
5. 记录 Employee 实例
6. 等待健康检查通过
```

### 8.2 升级流程

```
1. 角色模板发布新版本
2. 通知公司"有升级可用"
3. 公司确认升级:
   a. 触发 AI 保存当前经验
   b. 停止旧容器
   c. 用新镜像 + 旧 Volume 启动新容器
   d. 健康检查通过
   e. 更新 Employee 记录
```

### 8.3 离职流程

```
1. 触发保存经验
2. 将 rules/ 内容归档到公司知识库
3. 关闭所有活跃 session
4. 停止容器
5. 标记 Employee 为 archived
6. 保留 Volume（可恢复）
```

---

## 9. 安全与权限

### 9.1 权限模型

| 角色 | 创建群聊 | 审批 | 管理员工 | 管理公司 |
|------|---------|------|---------|---------|
| owner | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ❌ |
| member | ✅ | ✅(自己的群) | ❌ | ❌ |

### 9.2 隔离

- 公司间数据完全隔离（不同的文件目录、数据库行级隔离）
- AI 容器间网络隔离（只能被编排层访问）
- OpenCode Serve 启用 Basic Auth

### 9.3 数据安全

- API Key 通过环境变量注入，不持久化到文件
- 产出物按公司隔离存储
- AI 只能读写自己挂载的文件目录

---

## 10. 可扩展性

### 10.1 角色市场（远期）

- 角色模板可发布到公共市场
- 公司可以浏览、试用、购买
- 类似插件市场的模型

### 10.2 自定义角色

- 公司可以基于现有模板组合/修改
- 添加自定义 skills、MCP 服务器
- 调整 prompt 和工具权限

### 10.3 跨公司协作（远期）

- 两个公司可以组建联合群聊
- 各自的 AI 员工在同一个群里协作
- 数据按公司隔离，只共享必要上下文
