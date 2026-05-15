# Nexus Agent

Container entry process for Nexus Agents - "容器即人" architecture.

## 当前架构 (已简化)

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

**消息流程**：

```
用户邀请 agent → sync 检测 invite → 自动 join
用户发消息 → sync 检测 message → handleMessage
    → createSession / sendMessage (opencode)
    → 回复到 Matrix 房间
```

## 架构决策：为什么使用原生 fetch 而非 Matrix SDK？

### 问题背景

初期尝试使用 `matrix-bot-sdk`，但在 Docker 构建时遇到 native 依赖问题：

```
matrix-bot-sdk 依赖 @matrix-org/matrix-sdk-crypto-nodejs
    → Rust 编译的 native 模块
    → Docker 容器内安装失败
    → Cannot find module '@matrix-org/matrix-sdk-crypto-nodejs-linux-x64-gnu'
    → pnpm 还需要手动批准 build-scripts
```

### 分析

| SDK 功能 | 我们是否需要 | 备注 |
|---------|-------------|------|
| E2EE 加密 | ❌ 不需要 | Phase 1 明确不做 |
| 类型安全的 API | ⚠️ 可选 | 简单场景，自己写够用 |
| Rate limiting 处理 | ⚠️ 可选 | 可以自己加 |
| 复杂事件解析 | ❌ 不需要 | 只处理 message + invite |
| 状态管理 | ❌ 不需要 | 简单的 sync loop |

**结论**：SDK 的核心价值是 E2EE，但我们不需要。自己实现更合适。

### 实际使用的 Matrix API

```
GET  /sync                    - 长轮询获取事件 (invite + message)
POST /rooms/{roomId}/join     - 接受邀请
PUT  /rooms/{roomId}/send/... - 发送消息
PUT  /rooms/{roomId}/typing/... - 打字指示器
```

共 4 个 API，足够实现完整的 bot 功能。

### 收益

| 指标 | SDK | 原生 fetch |
|------|-----|-----------|
| 依赖数量 | 235 packages | 39 packages |
| 构建 | 需处理 native 模块 | 无问题 |
| 调试 | SDK 封装多层 | 完全可控 |

### 什么时候该用 SDK？

- 需要 E2EE 时（加密消息）
- 需要复杂功能时（空间管理、线程、投票等）
- 需要长期维护的大型项目

我们的场景是"轻量级 bot"，自己实现更合适。

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MATRIX_HOMESERVER_URL` | Matrix 服务器地址 | - |
| `MATRIX_ACCESS_TOKEN` | 访问令牌 | - |
| `MATRIX_USER_ID` | 用户 ID (如 @bot:server.com) | - |
| `OPENCODE_BASE_URL` | OpenCode API 地址 | `http://localhost:4096` |
| `AGENTS_FILE` | AGENTS.md 路径 | `/workspace/AGENTS.md` |

## 文件结构

```
agent/
├── src/
│   ├── agent.ts         # Matrix 客户端 (原生 fetch)
│   ├── serve-client.ts  # OpenCode API 客户端
│   ├── config.ts        # 配置加载
│   ├── types.ts         # 类型定义
│   ├── logger.ts        # 日志模块
│   └── test-serve.ts    # 测试脚本
└── package.json
```

## 核心实现

### agent.ts

```typescript
// Matrix API helpers (原生 fetch)
const matrixGet = async (path, params?) => { ... }
const matrixPut = async (path, body) => { ... }
const matrixPost = async (path, body?) => { ... }

// 邀请处理 - 自动接受
async function handleInvite(roomId, event) { ... }
async function joinRoom(roomId) { ... }

// 消息处理 - 转发到 opencode
async function handleMessage(roomId, event) { ... }

// 同步循环
async function syncLoop() {
  while (true) {
    const data = await matrixGet('/sync', { timeout: '30000', since: nextBatch });
    // 处理 invite + message
  }
}
```

### serve-client.ts

```typescript
// OpenCode API (passwordless mode for container)
export async function createSession(systemPrompt?) { ... }
export async function sendMessage(sessionId, content) { ... }
export async function healthCheck() { ... }
```

## 测试

```bash
# 容器内测试 opencode 通信
docker exec <container> npx tsx /app/test-serve.ts
```

---

## 已移除的模块 (架构简化)

以下模块已删除，不再使用：

- `process-manager.ts` - opencode serve 现在常驻运行
- `proxy-loader.ts` - AGENTS.md 通过 session systemPrompt 注入
- `matrix-client.ts` (旧版) - 合并到 agent.ts