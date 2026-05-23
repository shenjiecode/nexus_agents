# Platform 本地测试指南

## 快速测试流程

### 1. 启动服务

```bash
# 在项目根目录执行

# 1. 启动 Backend (需要先确保 PostgreSQL 运行)
cd platform/backend
# 首次需要启动 PostgreSQL (如果没运行)
docker-compose up -d  # 或 podman-compose up -d
# 启动 Backend 服务
go run cmd/server/main.go

# 2. 启动 Frontend (在另一个终端)
cd platform/frontend
pnpm dev
```

### 2. 访问前端

打开浏览器访问: http://localhost:13208

### 3. 登录/注册账户

- 使用已有账户: `shenjiecode@163.com` / `sjLOVEyy_130507`
- 或注册新账户

### 4. 创建角色

1. 进入「角色」页面
2. 点击「我的角色」标签
3. 点击「创建角色」
4. 填写角色名称和描述

### 5. 配置 API Key

编辑角色目录下的 `.security.yml` 文件：

```bash
# 文件位置: platform/backend/data/roles/{userId}/{roleId}/.security.yml
```

添加 API Key：

```yaml
model_list:
  glm-5:0:
    api_keys:
      - sk-sp-VjFsjc0cKH3lbhH1SnDkqBKkJCjaqWHUV8phwx6qMPBhvpoe
```

### 6. 启动调试容器

1. 进入角色详情页
2. 点击「启动容器」按钮
3. 等待容器状态变为「运行中」

### 7. 与 Agent 对话

1. 在「调试对话」区域输入消息
2. 点击「发送」
3. 等待 Agent 回复

---

## 服务端口汇总

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 13208 | React + Vite |
| Backend | 13207 | Gin API |
| PostgreSQL | 5433 | 业务数据库 |
| Agent 容器 | 4100+ | picoclaw (动态分配) |

---

## WebSocket 通信架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          用户浏览器                              │
│                   ws://localhost:13208/api/...                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                     Vite Proxy (ws: true)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Gin + Gorilla WS)                   │
│                   ws://localhost:13207/api/...                  │
│                                                                 │
│  1. 验证用户 (userId query param)                                │
│  2. 验证角色所有权                                               │
│  3. 查找活跃调试会话                                             │
│  4. 连接容器 pico channel                                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                     WebSocket 代理
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent 容器 (picoclaw)                         │
│                  ws://localhost:{port}/pico/ws                  │
│                                                                 │
│  - 需要 Bearer token 认证 (从 .security.yml 读取)                │
│  - 处理消息，调用 LLM                                            │
│  - 返回响应                                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 消息格式

### 前端发送

```json
{
  "type": "message.send",
  "id": "timestamp-random",
  "payload": {
    "content": "你的消息内容"
  }
}
```

### 容器返回

| 类型 | 说明 |
|------|------|
| `typing.start` | Agent 开始处理 |
| `typing.stop` | Agent 处理完成 |
| `message.create` | Agent 回复消息 |
| `error` | 错误信息 |

---

## 常见问题

### 1. WebSocket 连接失败

**症状**: 调试对话显示「连接中...」或「已断开」

**检查**:
```bash
# 确认容器运行
podman ps --filter name=picoclaw

# 确认 Backend 运行
curl http://localhost:13207/health

# 检查调试会话状态
curl http://localhost:13207/api/roles/{roleId}/debug/status \
  -H "X-User-Id: {userId}"
```

### 2. Agent 返回 401 错误

**原因**: API Key 未配置或无效

**解决**:
检查 `.security.yml` 文件中的 `api_keys` 配置：

```yaml
model_list:
  glm-5:0:
    api_keys:
      - your-valid-api-key
```

### 3. 容器启动失败

**检查**:
```bash
# 确认 picoclaw 镜像存在
podman images | grep picoclaw

# 如果没有，拉取镜像
podman pull sipeed/picoclaw:latest
```

### 4. config.json 格式错误

**症状**: 容器日志显示 `syntax error`

**解决**:
确保 JSON 格式正确（不要有转义引号）：

```json
{
  "version": 3,
  "session": { "dimensions": ["chat"] },
  ...
}
```

错误示例（转义引号）:
```json
{ "dimensions": [\"chat\"] }  // ❌ 错误
```

---

## API 测试命令

### 登录

```bash
curl -X POST http://localhost:13207/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"shenjiecode@163.com","password":"sjLOVEyy_130507"}'
```

### 获取我的角色

```bash
curl http://localhost:13207/api/roles/mine \
  -H "X-User-Id: {userId}"
```

### 启动调试容器

```bash
curl -X POST http://localhost:13207/api/roles/{roleId}/debug/start \
  -H "X-User-Id: {userId}"
```

### 检查调试状态

```bash
curl http://localhost:13207/api/roles/{roleId}/debug/status \
  -H "X-User-Id: {userId}"
```

### 停止调试容器

```bash
curl -X POST http://localhost:13207/api/roles/{roleId}/debug/stop \
  -H "X-User-Id: {userId}"
```

---

## 完整测试脚本

```bash
#!/bin/bash
# 保存为 test-platform.sh

# 用户信息 (登录后获取)
USER_ID="6875bbc8-62cf-4e78-9feb-256f14e2eb5b"
ROLE_ID="role_a3384fff-7e01-4498-a628-9c4650df2271"

# 1. 检查 Backend
echo "=== 检查 Backend ==="
curl -s http://localhost:13207/health && echo " ✓"

# 2. 检查 Frontend
echo "=== 检查 Frontend ==="
curl -s http://localhost:13208 > /dev/null && echo " ✓"

# 3. 检查容器状态
echo "=== 检查调试容器 ==="
podman ps --filter name=picoclaw

# 4. 测试 WebSocket (需要 Node.js + ws 包)
echo "=== 测试 WebSocket ==="
cd platform/frontend
node -e '
const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:13207/api/roles/'$ROLE_ID'/debug/ws?userId='$USER_ID'");
ws.on("open", () => { console.log("Connected ✓"); ws.send(JSON.stringify({type:"message.send",payload:{content:"测试"}})); });
ws.on("message", (d) => { console.log("Response:", JSON.parse(d).type); ws.close(); });
'
```

---

## 关键配置文件

| 文件 | 位置 | 说明 |
|------|------|------|
| Backend .env | `platform/backend/.env` | 数据库、OSS、SMTP配置 |
| config.json | `data/roles/{userId}/{roleId}/` | 角色配置 (picoclaw) |
| .security.yml | `data/roles/{userId}/{roleId}/` | API Key、token配置 |
| vite.config.ts | `platform/frontend/` | 前端代理配置 |

---

## 测试成功标志

1. ✅ Backend 返回 `{"success":true}`
2. ✅ Frontend 页面正常渲染
3. ✅ 容器状态显示 `running`
4. ✅ WebSocket 状态显示 `已连接`
5. ✅ Agent 返回有意义的内容（不是错误）

---

## ⚠️ 重要提示：pico channel 配置

创建新角色后，`.security.yml` 文件**必须包含** pico channel 的 token 配置，否则 WebSocket 连接会失败。

### 正确配置示例

```yaml
channel_list:
  pico:
    settings:
      token: cc67070d7c7c73dcf0da7c19e3051555  # 随机32位token

model_list:
  tx/glm-5:0:
    api_keys:
      - your-api-key
```

### 错误配置示例（缺少 channel_list）

```yaml
# ❌ 错误 - 缺少 channel_list
model_list:
  tx/glm-5:0:
    api_keys:
      - your-api-key
```

**后果**: 容器启动时显示 "No channels enabled"，WebSocket 无法连接。

### 生成 token

```bash
# 生成随机32位token
openssl rand -hex 16
```

### 角色创建逻辑已修复

**2026-05-21 更新**: 后端代码已修改，创建新角色时会自动生成 pico channel token。

- 新建角色：后端自动生成完整的 `.security.yml`（包含 pico token）
- 已有角色：如果缺少 channel_list，需要手动添加或重启后端后重新创建角色

---

## 故障排查

### 问题: WebSocket 显示 "已断开"

**检查步骤**:

```bash
# 1. 检查容器状态
podman ps --filter name=picoclaw

# 2. 检查容器日志
podman logs <container-name> | grep -i channel

# 如果显示 "No channels enabled"，说明 .security.yml 缺少 pico 配置

# 3. 检查容器内的 .security.yml
podman exec <container-name> cat /root/.picoclaw/.security.yml

# 确认包含 channel_list.pico.settings.token
```

### 问题: 容器启动失败

**检查**: 镜像是否存在

```bash
podman images | grep picoclaw

# 如果没有，拉取镜像
podman pull sipeed/picoclaw:latest
```

### 问题: API Key 无效

**症状**: Agent 返回 401 错误

**解决**: 检查 `.security.yml` 中的 API Key 是否正确

```yaml
model_list:
  tx/glm-5:0:
    api_keys:
      - sk-sp-xxxxxxxx  # 替换为有效的 API Key
```

---

## 生产环境部署

### GitHub Workflow 自动部署

项目配置了 GitHub Actions 自动部署流程：

1. **触发条件**: 推送到 `deploy` 分支
   - Frontend: 监听 `platform/frontend/**` 变更
   - Backend: 监听 `platform/backend/**` 变更

2. **部署流程**:
   ```
   GitHub Push (deploy branch)
           ↓
       ┌─────────────┬─────────────┐
       ↓             ↓
   Frontend    Backend
   Workflow    Workflow
       ↓             ↓
     Build      Build (Go)
       ↓             ↓
     SCP ──────→ SCP
     to server  to server
       ↓             ↓
   nginx reload   systemd restart
                       ↓
                health check
   ```

3. **服务器信息**:
   - IP: `8.217.143.228`
   - Backend 目录: `/opt/nexus/backend/`
   - Frontend 目录: `/opt/nexus/frontend/`
   - 数据目录: `/data/roles/`

4. **手动触发**: GitHub Actions 页面点击 `workflow_dispatch`

### 部署后验证

```bash
# SSH 到服务器
ssh root@8.217.143.228

# 检查后端服务状态
systemctl status nexus-backend

# 检查容器运行状态
docker ps --filter name=picoclaw

# 查看后端日志
journalctl -u nexus-backend -f
```

---

## 测试经验总结

### 已验证的功能流程

| 功能 | 状态 | 备注 |
|------|------|------|
| 用户登录 | ✅ | 邮箱密码登录正常 |
| 创建角色 | ✅ | 自动生成 pico token |
| 配置 API Key | ✅ | 通过 .security.yml 配置 |
| 启动容器 | ✅ | 使用 sipeed/picoclaw:latest 镜像 |
| WebSocket 连接 | ✅ | 状态显示"已连接" |
| Agent 对话 | ✅ | 正常返回回复 |
| GitHub 自动部署 | ✅ | 推送后自动部署 |

### 常见问题

1. **WebSocket 500 错误**: `.security.yml` 缺少 `channel_list.pico.settings.token`
2. **容器日志 "No channels enabled"**: 同上，需要添加 pico channel 配置
3. **YAML 格式错误**: 确保使用 2 空格缩进，不要用 tab

### 本地 vs 生产环境差异

| 项目 | 本地 | 生产 |
|------|------|------|
| 后端启动 | `go run cmd/server/main.go` | systemd 服务 |
| 前端构建 | `pnpm dev` | Nginx 静态服务 |
| 数据目录 | `platform/backend/data/roles/` | `/data/roles/` |
| WebSocket 代理 | Vite proxy (`ws: true`) | Nginx proxy |
