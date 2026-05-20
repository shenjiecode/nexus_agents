# Matrix 服务技术指南

本文档面向开发者（同事/AI），说明如何使用 Matrix 消息服务进行开发和集成。

---

## 服务概览

| 服务 | 端口 | 用途 | 访问地址 |
|------|------|------|----------|
| **Synapse API** | 8008 | Matrix Homeserver 核心API | `http://8.217.143.228:8008` |
| **Element Web** | 8010 | Web 聊天客户端（用户界面） | `http://8.217.143.228:8010` |
| **Ketesa Admin** | 8011 | 管理后台（用户/房间管理） | `http://8.217.143.228:8011` |

**当前状态**：已部署，CORS 完全开放，可直接从任意前端调用。

---

## 快速开始

### 1. 测试服务连通性

```bash
# 健康检查
curl http://8.217.143.228:8008/health
# 返回: OK

# 获取支持的 API 版本
curl http://8.217.143.228:8008/_matrix/client/versions | jq '.versions[-1]'
# 返回: "v1.12"
```

### 2. 用户登录

```bash
# 登录获取 access_token
curl -X POST http://8.217.143.228:8008/_matrix/client/v3/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "your_username",
    "password": "your_password"
  }'

# 返回示例：
# {
#   "user_id": "@username:8.217.143.228",
#   "access_token": "syt_...",
#   "device_id": "DEVICEID"
# }
```

### 3. 浏览器前端调用

```javascript
// 直接调用 Matrix API（无需代理）
fetch('http://8.217.143.228:8008/_matrix/client/versions', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(data => console.log('Matrix版本:', data.versions))
```

---

## CORS 配置

**配置模式**：完全开放（反射任意来源）

```nginx
map $http_origin $cors_origin {
    default $http_origin;  # 反射请求的 Origin
}
```

**支持的特性**：
- ✅ 任意来源（localhost、生产域名、第三方应用）
- ✅ 凭据模式（`credentials: include`）
- ✅ OPTIONS 预检请求自动处理
- ✅ 所有 Matrix API 端点

**验证 CORS**：

```bash
curl -I -X OPTIONS http://8.217.143.228:8008/_matrix/client/versions \
  -H "Origin: http://your-app.com"

# 预期返回：
# HTTP/1.1 204 No Content
# Access-Control-Allow-Origin: http://your-app.com
# Access-Control-Allow-Credentials: true
```

---

## 核心 API 端点

### Client-Server API (用户操作)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/_matrix/client/versions` | GET | 获取支持的版本 |
| `/_matrix/client/v3/login` | GET/POST | 登录流程 |
| `/_matrix/client/v3/logout` | POST | 登出 |
| `/_matrix/client/v3/account/whoami` | GET | 获取当前用户信息 |
| `/_matrix/client/v3/sync` | GET | 同步消息和房间状态 |
| `/_matrix/client/v3/rooms/{roomId}/send/m.room.message` | PUT | 发送消息 |
| `/_matrix/client/v3/rooms/{roomId}/join` | POST | 加入房间 |
| `/_matrix/client/v3/createRoom` | POST | 创建房间 |

### Admin API (管理员操作)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/_synapse/admin/v1/users` | GET | 列出所有用户 |
| `/_synapse/admin/v1/users/{userId}` | GET | 获取用户详情 |
| `/_synapse/admin/v1/users/{userId}/admin` | PUT | 设置用户管理员状态 |
| `/_synapse/admin/v1/reset_password/{userId}` | POST | 重置用户密码 |
| `/_synapse/admin/v1/rooms` | GET | 列出所有房间 |
| `/_synapse/admin/v1/rooms/{roomId}` | DELETE | 删除房间 |

---

## 使用示例

### 示例1：用户登录并获取信息

```bash
# 1. 登录
TOKEN=$(curl -s -X POST http://8.217.143.228:8008/_matrix/client/v3/login \
  -H "Content-Type: application/json" \
  -d '{"type":"m.login.password","user":"testuser","password":"testpass123"}' \
  | jq -r '.access_token')

# 2. 获取用户信息
curl -s http://8.217.143.228:8008/_matrix/client/v3/account/whoami \
  -H "Authorization: Bearer $TOKEN" | jq .

# 返回：
# {
#   "user_id": "@testuser:8.217.143.228",
#   "is_guest": false,
#   "device_id": "..."
# }
```

### 示例2：创建房间并发送消息

```bash
# 1. 创建房间
ROOM_ID=$(curl -s -X POST http://8.217.143.228:8008/_matrix/client/v3/createRoom \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试房间","preset":"private_chat"}' \
  | jq -r '.room_id')

# 2. 发送消息
curl -X PUT "http://8.217.143.228:8008/_matrix/client/v3/rooms/$ROOM_ID/send/m.room.message/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"msgtype":"m.text","body":"Hello World!"}'
```

### 示例3：同步消息（轮询模式）

```bash
# 长轮询获取新消息（每次调用返回新事件）
curl -s "http://8.217.143.228:8008/_matrix/client/v3/sync?since=$NEXT_BATCH" \
  -H "Authorization: Bearer $TOKEN" | jq '.rooms.join'
```

---

## 测试账户

| 用户 | 密码 | 用途 |
|------|------|------|
| `testuser` | `testpass123` | 测试账号，可自由使用 |

---

## 与 Backend 集成

Backend 通过共享密钥注册 Matrix 账户：

```env
# Backend .env 配置
MATRIX_HOMESERVER_URL=http://8.217.143.228:8008
MATRIX_REGISTRATION_SECRET=<从服务器获取>
```

注册新用户的 Admin API：

```bash
curl -X POST http://8.217.143.228:8008/_synapse/admin/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "agent_001",
    "password": "generated_password",
    "mac": "<HMAC签名>"
  }'
```

---

## Web 界面使用

### Element Web (8010)

用户聊天界面，访问 `http://8.217.143.228:8010`：

1. 点击"登录"
2. 服务器地址：`8.217.143.228:8008`
3. 输入用户名和密码
4. 开始聊天

### Ketesa Admin (8011)

管理后台，访问 `http://8.217.143.228:8011`：

1. 使用 admin 账户登录
2. 管理用户：创建/禁用/重置密码
3. 管理房间：查看/删除/封禁
4. 管理媒体：清理缓存/删除文件

---

## 常见问题

### Q: CORS 报错怎么办？

当前配置已完全开放，任意来源都可以访问。如果仍有问题：

```bash
# 检查 nginx 配置
ssh root@8.217.143.228 "cat /etc/nginx/conf.d/matrix.conf | head -20"

# 测试 OPTIONS 请求
curl -I -X OPTIONS http://8.217.143.228:8008/health \
  -H "Origin: http://your-origin.com"
```

### Q: 如何创建新用户？

**方式1：Ketesa Admin UI**
- 登录 `http://8.217.143.228:8011`
- Users → Add User

**方式2：服务器 CLI**
```bash
ssh root@8.217.143.228
docker exec matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml -u newuser -p newpass http://localhost:8008
```

**方式3：Backend 程序注册**
- 使用 `MATRIX_REGISTRATION_SECRET` 调用 Admin API

### Q: 如何获取 admin access_token？

```bash
curl -X POST http://8.217.143.228:8008/_matrix/client/v3/login \
  -H "Content-Type: application/json" \
  -d '{"type":"m.login.password","user":"admin","password":"<admin密码>"}' \
  | jq -r '.access_token'
```

---

## API 版本支持

当前 Synapse 版本支持：

- Matrix Client-Server API: v1.12
- 支持 r0.x 和 v1.x 所有版本
- 支持 E2EE（端到端加密）
- 支持空间（Spaces）
- 支持线程（Threading）

---

## 联系与支持

- **服务器位置**：`8.217.143.228`
- **项目代码**：`matrix/` 目录
- **配置文件**：`matrix/config/`
- **日志查看**：`ssh root@8.217.143.228 && docker logs matrix-synapse`