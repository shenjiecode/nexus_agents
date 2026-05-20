# Matrix Server

独立的 Matrix 消息服务器，基于 Synapse + Ketesa Admin + Element Web。

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                      用户浏览器                          │
└───────┬─────────────────┬──────────────────┬───────────┘
        │                 │                  │
        ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Element Web │  │ Ketesa Admin │  │   Synapse API    │
│    :8010     │  │    :8011     │  │     :8008        │
│  Web 聊天    │  │  管理界面    │  │  Homeserver      │
└──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
       │                 │                    │
       └─────────────────┼────────────────────┘
                         │  Client API + Admin API
                         ▼
                ┌──────────────────┐
                │     Synapse      │
                │  (matrix-synapse)│
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │   PostgreSQL     │
                │     :5432        │
                └──────────────────┘
```

### 服务组成

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| Synapse | matrix-synapse | 8008 (HTTP) / 8448 (HTTPS) | Matrix Homeserver，处理消息、用户认证、房间管理 |
| Ketesa | matrix-ketesa | 8011 → 8080 | Synapse 管理 UI，提供用户/房间/媒体的 Web 管理界面 |
| Element Web | matrix-element-web | 8010 → 80 | Web 聊天客户端，给用户使用 |
| PostgreSQL | matrix-postgres | 5432 | Synapse 数据库 |

### 权限模型

Synapse 的权限分为两层：

```
Server CLI (docker exec)  ← 最高权限，物理访问服务器
    ↓
Server Admin (admin=true) ← 可管理所有用户（包括其他 admin）
    ↓
普通用户                  ← 只能操作自己的数据
```

- **没有**比 Server Admin 更高的 API token 或 super-admin
- Admin 账户间互为备份 — 建议**至少保留 2 个 admin 账户**
- 如果丢失所有 admin 密码，可通过服务器 CLI 重置
- 所有 Admin API 调用需要在请求头携带 admin 用户的 access token：`Authorization: Bearer <token>`

### Admin 账户管理

| 操作 | 方式 |
|------|------|
| 创建 admin | `docker exec matrix-synapse register_new_matrix_user -c /data/homeserver.yaml -u <user> -p <pass> -a http://localhost:8008` |
| 重置 admin 密码 | 用另一个 admin 通过 Ketesa UI，或 `docker exec` CLI |
| 提升/降级 admin | Admin API: `PUT /_synapse/admin/v1/users/<user_id>/admin` |
| 禁用 admin | 用另一个 admin 通过 Ketesa UI 或 Admin API |
| 获取 access token | `POST /_matrix/client/v3/login` 用 admin 账户登录 |

---

## 快速部署

### 1. 配置环境变量

```bash
cd matrix
cp .env.example .env
nano .env  # 编辑配置
```

**必须修改的配置项**：

| 变量 | 说明 | 示例 |
|------|------|------|
| `MATRIX_SERVER_NAME` | 服务器域名或IP | `8.217.143.228` |
| `POSTGRES_PASSWORD` | 数据库密码 | 生成强密码 |
| `REGISTRATION_SHARED_SECRET` | 注册密钥 | `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | 管理员密码 | 设置强密码 |

### 2. 启动服务

```bash
chmod +x start.sh
./start.sh
```

`start.sh` 会自动：
1. 验证 `.env` 必填变量
2. 从模板生成 `homeserver.yaml`、`ketesa-config.json`、`element-config.json`
3. 首次运行时生成 Synapse 签名密钥
4. 启动所有容器
5. 等待 Synapse 健康检查通过
6. 创建 admin 用户（幂等，已存在则跳过）

### 3. 验证

| 服务 | 地址 | 验证方式 |
|------|------|----------|
| Synapse API | `http://{SERVER}:8008/health` | 返回 `OK` |
| Element Web | `http://{SERVER}:8010` | 浏览器打开显示登录页 |
| Ketesa Admin | `http://{SERVER}:8011` | 浏览器打开，用 admin 账户登录 |

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MATRIX_SERVER_NAME` | 服务器域名/IP（必须） | - |
| `POSTGRES_USER` | 数据库用户 | `synapse` |
| `POSTGRES_PASSWORD` | 数据库密码（必须） | - |
| `POSTGRES_DB` | 数据库名 | `synapse` |
| `POSTGRES_PORT` | PostgreSQL 端口 | `5432` |
| `SYNAPSE_HTTP_PORT` | Synapse HTTP 端口 | `8008` |
| `SYNAPSE_HTTPS_PORT` | Synapse HTTPS 端口 | `8448` |
| `ELEMENT_PORT` | Element Web 端口 | `8010` |
| `KETESA_PORT` | Ketesa Admin 端口 | `8011` |
| `REGISTRATION_SHARED_SECRET` | 注册密钥（必须） | - |
| `ADMIN_USERNAME` | 初始管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 初始管理员密码（必须） | - |

---

## 目录结构

```
matrix/
├── start.sh                         # 启动脚本（自动生成配置 + 创建管理员）
├── stop.sh                          # 停止脚本
├── docker-compose.yml               # 容器编排
├── .env                             # 环境变量（编辑此文件）
├── .env.example                     # 环境变量模板
├── config/
│   ├── homeserver.yaml.template     # Synapse 配置模板
│   ├── homeserver.yaml              # 生成的配置（勿手动编辑）
│   ├── ketesa-config.json.template  # Ketesa 配置模板
│   ├── ketesa-config.json           # 生成的配置（勿手动编辑）
│   ├── element-config.json.template # Element 配置模板
│   ├── element-config.json          # 生成的配置（勿手动编辑）
│   ├── *.signing.key                # 签名密钥（首次启动自动生成）
│   └── log.config                   # 日志配置（首次启动自动生成）
├── data/
│   ├── postgres/                    # PostgreSQL 数据
│   └── media_store/                 # 媒体文件
├── README.md                        # 本文档
└── DEPLOYMENT_NOTES.md              # 部署问题记录
```

---

## 常用命令

```bash
./start.sh                          # 启动（生成配置 + 创建 admin + 启动容器）
./stop.sh                           # 停止
docker compose logs -f synapse      # 查看 Synapse 日志
docker compose logs -f              # 查看所有日志
./stop.sh && ./start.sh             # 重启
```

### Admin 操作

```bash
# 创建新 admin 用户
docker exec matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml -u <username> -p <password> -a http://localhost:8008

# 创建普通用户
docker exec matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml -u <username> -p <password> http://localhost:8008

# 重置用户密码（通过 Admin API）
curl -X POST http://localhost:8008/_synapse/admin/v1/reset_password/@user:SERVER \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'Content-Type: application/json' \
  -d '{"new_password": "newpass", "logout_devices": true}'
```

---

## 与 Backend 集成

启动成功后，将以下配置添加到 Backend 的 `.env`：

```env
MATRIX_HOMESERVER_URL=http://{MATRIX_SERVER_NAME}:8008
MATRIX_REGISTRATION_SECRET={REGISTRATION_SHARED_SECRET}
```

Backend 通过 `REGISTRATION_SHARED_SECRET` 调用 Synapse 的共享密钥注册 API（`/_synapse/admin/v1/register`）为 Agent 创建 Matrix 账户。

---

## 管理功能

通过 Ketesa Admin UI (`http://{MATRIX_SERVER_NAME}:8011`) 可以：

| 功能 | 说明 |
|------|------|
| 用户管理 | 创建/编辑/禁用用户、重置密码、设置/取消管理员、查看设备 |
| 房间管理 | 查看/删除房间、管理成员、封禁房间、查看消息 |
| 媒体管理 | 查看/隔离/删除媒体文件、清理缓存 |
| 注册令牌 | 创建一次性或多次使用的注册令牌 |

---

## 生产环境建议

1. **HTTPS**：使用 Nginx/Caddy 反向代理添加 TLS
2. **Admin API 保护**：通过 nginx 限制 `/_synapse/admin/` 路径仅内网访问
3. **多 Admin**：至少 2 个 admin 账户互为备份
4. **备份**：定期备份 `data/postgres` 和 `config/*.signing.key`
5. **SSH 加固**：生产环境使用密钥认证替代密码
6. **监控**：配置 Synapse 日志收集和告警

---

## 故障排除

### Synapse 启动失败

```bash
docker compose logs synapse
```

常见原因：
- PostgreSQL 未就绪：等待 health check 通过
- 配置错误：检查 `config/homeserver.yaml` 中的数据库连接
- 权限错误：`chown -R 991:991 config/`（Synapse 容器内 uid 991）
- 日志路径错误：`log.config` 中 filename 应为 `/data/homeserver.log`

### Element Web 无法启动 (Permission denied on port 80)

Element Web 最新镜像以非 root 运行，无法绑定 80 端口。已在 `docker-compose.yml` 中添加 `user: "0:0"` 解决。

### 重新生成签名密钥

```bash
rm config/*.signing.key
./start.sh  # 会自动重新生成
```

### 端口被占用

```bash
netstat -tlnp | grep 8008
netstat -tlnp | grep 8010
netstat -tlnp | grep 8011
```

---

## 注意事项

- `*.signing.key` 首次启动自动生成，**勿删除**（否则所有用户需要重新验证）
- 修改 `.env` 后需要重新运行 `./start.sh`
- Federation 默认关闭，仅内部使用
- Ketesa Admin 通过 Synapse Admin API 管理，需要 admin 账户的 access token
- Agent 容器使用标准 Matrix Client-Server API，与 Dendrite/Synapse 无关
