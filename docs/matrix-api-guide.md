# Matrix Server API 对接指南

> 面向需要基于 Matrix 服务器做二次开发的开发者

## 一、服务器信息

```
Homeserver URL: http://8.217.143.228:8008
Element Web:    http://8.217.143.228:8080  （浏览器聊天客户端）
Server Name:    8.217.143.228              （用户 ID 后缀，如 @alice:8.217.143.228）
```

**重要：我们用的是 Dendrite，不是 Synapse。** 所以 `/_synapse/admin/v1/` 开头的接口大部分不可用。能用的是标准 Matrix Client API（`/_matrix/client/v3/`）。

---

## 二、认证方式

所有需要身份验证的请求，在 HTTP Header 里带上 Access Token：

```
Authorization: Bearer {access_token}
```

### 2.1 登录获取 Token

```bash
curl -X POST http://8.217.143.228:8008/_matrix/client/v3/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "alice",
    "password": "Alice@2026"
  }'
```

返回：

```json
{
  "user_id": "@alice:8.217.143.228",
  "access_token": "QCrjV8SRMJArAGGBfqq2dcT8ZgypTH15NVGKdrArZzc",
  "device_id": "nexus-alice"
}
```

保存 `access_token`，后续所有请求都要用到。

### 2.2 验证 Token 是否有效

```bash
curl http://8.217.143.228:8008/_matrix/client/v3/account/whoami \
  -H "Authorization: Bearer QCrjV8SRMJArAGGBfqq2dcT8ZgypTH15NVGKdrArZzc"
```

返回：

```json
{
  "user_id": "@alice:8.217.143.228",
  "device_id": "nexus-alice"
}
```

---

## 三、可用 API 速查

### ✅ 可用（Client API v3）

| 功能 | 方法 | 路径 | 需要 Token |
|------|------|------|-----------|
| 服务器版本 | GET | `/_matrix/client/versions` | ❌ |
| 登录 | POST | `/_matrix/client/v3/login` | ❌ |
| 我是谁 | GET | `/_matrix/client/v3/account/whoami` | ✅ |
| 同步消息 | GET | `/_matrix/client/v3/sync` | ✅ |
| 创建房间 | POST | `/_matrix/client/v3/createRoom` | ✅ |
| 加入房间 | POST | `/_matrix/client/v3/join/{roomIdOrAlias}` | ✅ |
| 离开房间 | POST | `/_matrix/client/v3/rooms/{roomId}/leave` | ✅ |
| 邀请用户 | POST | `/_matrix/client/v3/rooms/{roomId}/invite` | ✅ |
| 发送消息 | PUT | `/_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}` | ✅ |
| 获取消息 | GET | `/_matrix/client/v3/rooms/{roomId}/messages` | ✅ |
| 房间成员 | GET | `/_matrix/client/v3/rooms/{roomId}/members` | ✅ |
| 房间状态 | GET | `/_matrix/client/v3/rooms/{roomId}/state` | ✅ |
| 用户资料 | GET | `/_matrix/client/v3/profile/{userId}` | ❌ |
| 在线状态 | GET | `/_matrix/client/v3/presence/{userId}/status` | ✅ |
| 设置状态 | PUT | `/_matrix/client/v3/presence/{userId}/status` | ✅ |
| 能力查询 | GET | `/_matrix/client/v3/capabilities` | ✅ |
| 注册 Nonce | GET | `/_synapse/admin/v1/register` | ❌ |
| 注册用户 | POST | `/_synapse/admin/v1/register` | ❌（需 HMAC 签名，见下文） |

### ❌ 不可用

| 路径 | 原因 |
|------|------|
| `/_synapse/admin/v1/users/*` | Synapse 专有，Dendrite 不支持 |
| `/_synapse/admin/v1/rooms/*` | Synapse 专有，Dendrite 不支持 |
| `/_synapse/admin/v1/deactivate/*` | Synapse 专有，Dendrite 不支持 |
| `/_matrix/federation/v1/*` | 联邦已关闭 |
| `/_matrix/client/v3/media/config` | Dendrite 未实现此端点 |
| `/.well-known/matrix/client` | 未配置 |

---

## 四、常用操作示例

### 4.1 创建房间

```bash
TOKEN="你的access_token"

curl -X POST http://8.217.143.228:8008/_matrix/client/v3/createRoom \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试房间",
    "visibility": "private",
    "preset": "private_chat",
    "invite": ["@bob:8.217.143.228"]
  }'
```

返回 `room_id`，如 `!XxxYyy:8.217.143.228`。

### 4.2 发送消息

```bash
TXN_ID="msg-$(date +%s)"  # 事务ID，任意唯一字符串即可

curl -X PUT "http://8.217.143.228:8008/_matrix/client/v3/rooms/{ROOM_ID}/send/m.room.message/$TXN_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "msgtype": "m.text",
    "body": "Hello from API!"
  }'
```

### 4.3 获取房间历史消息

```bash
curl "http://8.217.143.228:8008/_matrix/client/v3/rooms/{ROOM_ID}/messages?dir=b&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### 4.4 邀请用户进房间

```bash
curl -X POST "http://8.217.143.228:8008/_matrix/client/v3/rooms/{ROOM_ID}/invite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "@charlie:8.217.143.228"}'
```

### 4.5 同步（长轮询获取新消息）

```bash
# 首次同步（不带 since，获取全量）
curl "http://8.217.143.228:8008/_matrix/client/v3/sync?timeout=0" \
  -H "Authorization: Bearer $TOKEN"

# 增量同步（带 since，长轮询 30 秒）
curl "http://8.217.143.228:8008/_matrix/client/v3/sync?since={next_batch}&timeout=30000" \
  -H "Authorization: Bearer $TOKEN"
```

返回中的 `next_batch` 用于下次请求的 `since` 参数。`rooms.join.{roomId}.timeline.events` 是新消息。

---

## 五、注册新用户

服务器关闭了开放注册。新用户只能通过 Shared Secret + HMAC 签名的方式注册。

**不是** POST 一个 JSON 带 admin token 就行，而是三步握手：

### Step 1: 获取 Nonce

```bash
curl http://8.217.143.228:8008/_synapse/admin/v1/register
# → {"nonce": "随机字符串"}
```

### Step 2: 计算 HMAC-SHA1

```python
import hmac, hashlib

SECRET = "nexus_matrix_secret_xK9mP2vL7qR4wY6j"
NONCE = "拿到的nonce"
USERNAME = "新用户名"
PASSWORD = "新密码"
ADMIN = "notadmin"  # 管理员用 "admin"

mac = hmac.new(
    SECRET.encode(),
    f"{NONCE}\x00{USERNAME}\x00{PASSWORD}\x00{ADMIN}".encode(),
    hashlib.sha1
).hexdigest()
```

### Step 3: 提交注册

```bash
curl -X POST http://8.217.143.228:8008/_synapse/admin/v1/register \
  -H "Content-Type: application/json" \
  -d "{
    \"nonce\": \"拿到的nonce\",
    \"username\": \"新用户名\",
    \"password\": \"新密码\",
    \"displayname\": \"显示名\",
    \"admin\": false,
    \"mac\": \"计算出的hmac\"
  }"
```

返回：

```json
{
  "user_id": "@新用户名:8.217.143.228",
  "access_token": "新用户的token",
  "device_id": "shared_secret_registration"
}
```

> ⚠️ Registration Secret 是核心凭据，请勿泄露。

---

## 六、可用测试账号

可以直接用这些账号登录测试：

| 账号 | 密码 | Access Token |
|------|------|-------------|
| alice | Alice@2026 | `QCrjV8SRMJArAGGBfqq2dcT8ZgypTH15NVGKdrArZzc` |
| bob | Bob@2026 | `PU80soeveBjEQatqKf2f20WMlLc5puWMIWnuAQqN5F8` |
| charlie | Charlie@2026 | `kGFAsLvddoA2bPcen7AFNEao7IlT1GX7ArLp5D4qDRI` |
| diana | Diana@2026 | `iN-9ZO1lYNG-aYgHWJp-n3J5HIemQnbV27MkfLjltbs` |
| eve | Eve@2026 | `GNfDKiNLfkDNAvCCd8Guk6ZUFXsh7TiIxWb4hJIlBgM` |
| frank | Frank@2026 | `Nt1l-IhNv_tIOJPdbcDaAtybZQVqY_Bw6SSLwYzSdWA` |
| grace | Grace@2026 | `Gzc7VdA0XV020ZXqrVUU231yKbVKKc3CT-kqBFqq09Q` |
| henry | Henry@2026 | `tY9nROKwYTzdLIoPYZgC6_L1glJgEDmrt2YXtQt-e24` |

---

## 七、注意事项

1. **Dendrite ≠ Synapse**：网上大部分 Matrix 教程是 Synapse 的，`/_synapse/admin/v1/users`、`/_synapse/admin/v1/rooms` 等管理接口在 Dendrite 上不可用
2. **联邦已关闭**：不能与其他 Matrix 服务器通信，仅限本服务器内用户
3. **E2EE 未启用**：房间消息都是明文，不需要处理加密事件
4. **速率限制**：接口调用过于频繁会触发限流（20 次 / 500ms），批量操作请加延迟
5. **Token 有效期**：除非主动登出（`POST /_matrix/client/v3/logout`）或改密码，否则永久有效

## 八、参考文档

- [Matrix Client-Server API Spec (v1.12)](https://spec.matrix.org/v1.12/client-server-api/)
- [Dendrite GitHub](https://github.com/element-hq/dendrite)
- [Element Web](http://8.217.143.228:8080) — 浏览器端调试可用
