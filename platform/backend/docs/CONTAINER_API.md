# 容器 API 文档

本文档说明如何使用 Nexus Agents 平台的容器相关 API 接口。

## 基础信息

- **Base URL**: `http://<server>:13208/api`
- **认证方式**: Bearer Token (登录后获取)
- **内容类型**: `application/json`

## 目录

1. [容器管理](#容器管理)
2. [文件操作](#文件操作)
3. [文件索引搜索](#文件索引搜索)
4. [技能管理](#技能管理)
5. [MCP 管理](#mcp-管理)
6. [调试接口](#调试接口)

---

## 容器管理

### 1. 获取容器列表

```
GET /api/containers
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "0c34b38a-08a2-4b05-b08b-0f169c6ce764",
      "name": "E2ETestContainer",
      "description": "测试容器",
      "variant": "base",
      "containerId": "docker-container-id",
      "port": 4101,
      "sshPort": 5101,
      "status": "running",
      "image": "sipeed/picoclaw:latest",
      "createdAt": "2026-06-02T19:14:04+08:00",
      "updatedAt": "2026-06-02T19:14:04+08:00"
    }
  ]
}
```

### 2. 获取容器详情

```
GET /api/containers/:id
```

**路径参数**:
- `id`: 容器 UUID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "0c34b38a-08a2-4b05-b08b-0f169c6ce764",
    "userId": "daed77e7-0692-4e46-aa6a-2ec583a9d511",
    "name": "E2ETestContainer",
    "description": "测试容器",
    "variant": "base",
    "containerId": "docker-container-id",
    "port": 4101,
    "sshPort": 5101,
    "status": "running",
    "image": "sipeed/picoclaw:latest",
    "matrixUserId": "@agent-0c34b38a-08a:8.217.143.228",
    "matrixHomeserver": "http://8.217.143.228:8008",
    "createdAt": "2026-06-02T19:14:04+08:00",
    "updatedAt": "2026-06-02T19:14:04+08:00"
  }
}
```

### 3. 创建容器

```
POST /api/containers
```

**请求体**:
```json
{
  "name": "我的容器",
  "description": "容器描述",
  "variant": "base",
  "roleId": "可选，从角色导入"
}
```

**字段说明**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 容器名称，最多64字符 |
| description | string | 否 | 容器描述 |
| variant | string | 否 | 变体类型，默认 "base" |
| roleId | string | 否 | 从角色导入的 ID |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "新容器UUID",
    "name": "我的容器",
    "status": "running",
    "port": 4102,
    "sshPort": 5102,
    "matrixUserId": "@agent-xxx:server"
  }
}
```

### 4. 启动容器

```
POST /api/containers/:id/start
```

### 5. 停止容器

```
POST /api/containers/:id/stop
```

### 6. 删除容器

```
DELETE /api/containers/:id
```

---

## 文件操作

### 1. 获取文件列表

```
GET /api/containers/:id/files
```

**路径参数**:
- `id`: 容器 UUID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "path": "/root/.picoclaw/workspace",
    "files": [
      {
        "name": "config.json",
        "path": "config.json",
        "isDir": false,
        "size": 2048,
        "modTime": "2026-06-02T19:14:04+08:00"
      },
      {
        "name": "workspace",
        "path": "workspace",
        "isDir": true,
        "modTime": "2026-06-02T19:14:04+08:00"
      }
    ]
  }
}
```

### 2. 读取文件内容

```
GET /api/containers/:id/files/*path
```

**路径参数**:
- `id`: 容器 UUID
- `path`: 文件路径（相对于容器工作目录）

**示例**:
```
GET /api/containers/0c34b38a-xxx/files/config.json
GET /api/containers/0c34b38a-xxx/files/workspace/data.txt
```

**响应**:
- 成功：返回文件内容（文本或 JSON）
- 失败：`{"success": false, "error": "File not found"}`

### 3. 保存文件内容

```
PUT /api/containers/:id/files/*path
```

**请求体**: 文件内容（raw body）

**示例**:
```bash
curl -X PUT "http://server:13208/api/containers/xxx/files/config.json" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

---

## 文件索引搜索

容器内的 Agent 会通过 `file-manager` skill 自动维护 `file-index.json` 文件，记录所有处理的文件信息。

### 搜索文件索引

```
GET /api/containers/:id/file-index
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| status | string | - | 筛选状态：active, deleted |
| type | string | - | 筛选文件类型：document, image, archive, other |
| tag | string | - | 筛选标签（支持前缀匹配，如 project:xxx） |
| search | string | - | 搜索文件名或描述 |
| page | int | 1 | 页码 |
| pageSize | int | 20 | 每页数量（最大100） |
| sortBy | string | created_at | 排序字段：created_at, updated_at, filename |
| sortDir | string | desc | 排序方向：asc, desc |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "file-uuid",
        "name": "report.pdf",
        "local_path": "workspace/output/report.pdf",
        "type": "document",
        "mime_type": "application/pdf",
        "tags": ["project:nexus_agents", "report"],
        "oss_key": "agents/workspace-123/output/report.pdf",
        "oss_url": "https://bucket.oss.com/agents/workspace-123/output/report.pdf?sign=xxx",
        "status": "active",
        "size": 102400,
        "description": "月度财务报告",
        "created_at": "2026-06-02T10:00:00+08:00",
        "updated_at": "2026-06-02T10:05:00+08:00"
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

**重要字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| `oss_key` | string\|null | OSS 存储路径，未上传时为 `null` |
| `oss_url` | string | **预签名下载 URL**（1小时有效），仅当 `oss_key` 不为空时返回 |
| `local_path` | string | 文件在容器内的本地路径（相对于工作目录） |
| `status` | string | 文件状态：`active`（正常）或 `deleted`（已废弃） |
| `type` | string | 文件类型：document、image、archive、other |
| `tags` | string[] | 标签数组，通常包含 `project:<项目名>` |

**注意**: `oss_url` 是预签名 URL，有效期为 1 小时，可直接用于下载文件。

---

## 技能管理

### 1. 获取已安装技能列表

```
GET /api/containers/:id/installed-skills
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "slug": "oss-skill",
      "name": "OSS存储技能",
      "path": "/workspace/skills/oss-skill"
    }
  ]
}
```

### 2. 添加技能到容器

```
POST /api/containers/:id/skills/:skillId
```

**路径参数**:
- `id`: 容器 UUID
- `skillId`: 技能 ID

**说明**: 将技能从 Skill 市场复制到容器的 `workspace/skills/` 目录。

### 3. 从容器移除技能

```
DELETE /api/containers/:id/skills/:skillId
```

---

## MCP 管理

### 1. 添加 MCP 到容器

```
POST /api/containers/:id/mcps/:mcpId
```

**说明**: 将 MCP 配置添加到容器的 `config.json` 中。

### 2. 从容器移除 MCP

```
DELETE /api/containers/:id/mcps/:mcpId
```

---

## 调试接口

### 1. 获取调试状态

```
GET /api/containers/:id/debug/status
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "0c34b38a-xxx",
    "name": "E2ETestContainer",
    "containerId": "docker-id",
    "containerPort": 4101,
    "containerStatus": "running",
    "debugActive": true
  }
}
```

### 2. WebSocket 调试连接

```
GET /api/containers/:id/debug/ws
```

**认证方式**:
- Header: `X-User-Id: <userId>`
- 或 Query: `?userId=<userId>`

**说明**: 建立 WebSocket 连接，直接与容器内的 Agent 通信。支持双向消息传递。

**JavaScript 示例**:
```javascript
const ws = new WebSocket(`ws://server:13208/api/containers/${containerId}/debug/ws?userId=${userId}`);

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "chat",
    content: "你好"
  }));
};

ws.onmessage = (event) => {
  console.log("收到消息:", JSON.parse(event.data));
};
```

---

## 错误响应格式

所有错误响应遵循统一格式：

```json
{
  "success": false,
  "error": "错误描述"
}
```

**常见错误码**:
| HTTP 状态码 | 说明 |
|------------|------|
| 400 | 请求参数错误 |
| 401 | 未认证（需要登录） |
| 403 | 无权限（非容器所有者） |
| 404 | 容器或文件不存在 |
| 500 | 服务器内部错误 |

---

## 使用示例

### cURL 示例

```bash
# 获取容器列表
curl -H "Authorization: Bearer <token>" \
  http://server:13208/api/containers

# 获取文件列表
curl -H "Authorization: Bearer <token>" \
  http://server:13208/api/containers/xxx/files

# 读取配置文件
curl -H "Authorization: Bearer <token>" \
  http://server:13208/api/containers/xxx/files/config.json

# 搜索文件索引
curl -H "Authorization: Bearer <token>" \
  "http://server:13208/api/containers/xxx/file-index?search=report&type=document&page=1&pageSize=10"
```

### Python 示例

```python
import requests

BASE_URL = "http://server:13208/api"
TOKEN = "your-token"

headers = {"Authorization": f"Bearer {TOKEN}"}

# 获取容器列表
response = requests.get(f"{BASE_URL}/containers", headers=headers)
containers = response.json()["data"]

# 获取文件列表
container_id = containers[0]["id"]
response = requests.get(f"{BASE_URL}/containers/{container_id}/files", headers=headers)
files = response.json()["data"]["files"]

# 搜索文件索引
params = {"search": "report", "type": "document", "page": 1, "pageSize": 10}
response = requests.get(f"{BASE_URL}/containers/{container_id}/file-index", 
                        headers=headers, params=params)
index = response.json()["data"]
```

---

## 注意事项

1. **权限控制**: 所有接口只允许容器所有者访问
2. **容器配额**: 每个用户最多创建 10 个容器
3. **文件大小限制**: 上传文件最大 100MB
4. **WebSocket 超时**: 调试 WebSocket 连接空闲 60 秒后会自动断开，客户端需实现心跳保活
