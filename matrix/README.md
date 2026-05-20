# Matrix Server

独立的 Matrix 消息服务器，基于 Synapse + Ketesa Admin + Element Web。

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

### 3. 验证

- Element Web: `http://{MATRIX_SERVER_NAME}:8080`
- Ketesa Admin: `http://{MATRIX_SERVER_NAME}:8081`
- Synapse API: `http://{MATRIX_SERVER_NAME}:8008`

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
| `ELEMENT_PORT` | Element Web 端口 | `8080` |
| `KETESA_PORT` | Ketesa Admin 端口 | `8081` |
| `REGISTRATION_SHARED_SECRET` | 注册密钥（必须） | - |
| `ADMIN_USERNAME` | 初始管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 初始管理员密码（必须） | - |

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
│   ├── homeserver.yaml              # 生成的配置（勿编辑）
│   ├── ketesa-config.json.template  # Ketesa 配置模板
│   ├── ketesa-config.json           # 生成的配置（勿编辑）
│   ├── element-config.json.template # Element 配置模板
│   ├── element-config.json          # 生成的配置（勿编辑）
│   ├── matrix_key.pem               # 签名密钥（首次启动自动生成）
│   └── log.config                   # 日志配置（首次启动自动生成）
└── data/
    ├── postgres/                    # PostgreSQL 数据
    └── media_store/                 # 媒体文件
```

## 常用命令

```bash
# 启动
./start.sh

# 停止
./stop.sh

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f synapse

# 重启
./stop.sh && ./start.sh
```

## 与 Backend 集成

启动成功后，将以下配置添加到 Backend 的 `.env`：

```env
MATRIX_HOMESERVER_URL=http://{MATRIX_SERVER_NAME}:8008
MATRIX_REGISTRATION_SECRET={REGISTRATION_SHARED_SECRET}
```

## 管理功能

通过 Ketesa Admin UI (`http://{MATRIX_SERVER_NAME}:8081`) 可以：

- **用户管理**：创建/编辑/禁用用户、重置密码、设置管理员
- **房间管理**：查看/删除房间、管理成员
- **媒体管理**：查看/隔离/删除媒体文件
- **注册令牌**：创建一次性或多次使用的注册令牌

使用 `start.sh` 中配置的管理员账户登录。

## 生产环境建议

1. **反向代理**：使用 Nginx/Caddy 添加 HTTPS
2. **防火墙**：开放 8008/8080/8081 端口
3. **备份**：定期备份 `data/postgres` 和 `config/matrix_key.pem`
4. **监控**：配置日志收集和告警

## 故障排除

### Synapse 启动失败

```bash
docker compose logs synapse
```

常见原因：
- PostgreSQL 未就绪：等待 health check 通过
- 配置错误：检查 `config/homeserver.yaml` 中的数据库连接

### 端口被占用

```bash
netstat -tlnp | grep 8008
netstat -tlnp | grep 8080
```

### 重新生成签名密钥

```bash
rm config/matrix_key.pem
./start.sh  # 会自动重新生成
```

## 注意事项

- `matrix_key.pem` 首次启动自动生成，**勿删除**（除非接受重建）
- 修改 `.env` 后需要重新运行 `./start.sh`
- Federation 默认关闭，仅内部使用
- Ketesa Admin 通过 Synapse Admin API 管理，需要管理员账户登录
