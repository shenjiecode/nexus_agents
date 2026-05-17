# Matrix Server

独立的 Matrix 消息服务器，基于 Dendrite + Element Web。

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

### 2. 启动服务

```bash
chmod +x start.sh
./start.sh
```

### 3. 验证

- Element Web: `http://{MATRIX_SERVER_NAME}:8080`
- Dendrite API: `http://{MATRIX_SERVER_NAME}:8008`

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MATRIX_SERVER_NAME` | 服务器域名/IP（必须） | - |
| `POSTGRES_USER` | 数据库用户 | `dendrite` |
| `POSTGRES_PASSWORD` | 数据库密码（必须） | - |
| `POSTGRES_DB` | 数据库名 | `dendrite` |
| `POSTGRES_PORT` | PostgreSQL 端口 | `5432` |
| `DENDRITE_HTTP_PORT` | Dendrite HTTP 端口 | `8008` |
| `DENDRITE_HTTPS_PORT` | Dendrite HTTPS 端口 | `8448` |
| `ELEMENT_PORT` | Element Web 端口 | `8080` |
| `REGISTRATION_SHARED_SECRET` | 注册密钥（必须） | - |
| `DISABLE_FEDERATION` | 禁用联邦 | `true` |

## 目录结构

```
matrix/
├── start.sh                    # 启动脚本（自动生成配置）
├── stop.sh                     # 停止脚本
├── docker-compose.yml          # 容器编排
├── .env                        # 环境变量（编辑此文件）
├── .env.example                # 环境变量模板
├── config/
│   ├── dendrite.yaml.template  # Dendrite 配置模板
│   ├── dendrite.yaml           # 生成的配置（勿编辑）
│   ├── element-config.json.template  # Element 配置模板
│   ├── element-config.json     # 生成的配置（勿编辑）
│   └── matrix_key.pem          # 签名密钥（首次启动自动生成）
└── data/
    ├── postgres/               # PostgreSQL 数据
    ├── media/                  # 媒体文件
    └── jetstream/              # Dendrite 消息队列
```

## 常用命令

```bash
# 启动
./start.sh

# 停止
./stop.sh

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f dendrite

# 重启
./stop.sh && ./start.sh
```

## 与 Backend 集成

启动成功后，将以下配置添加到 Backend 的 `.env`：

```env
MATRIX_HOMESERVER_URL=http://{MATRIX_SERVER_NAME}:8008
MATRIX_REGISTRATION_SECRET={REGISTRATION_SHARED_SECRET}
```

## 生产环境建议

1. **反向代理**：使用 Nginx/Caddy 添加 HTTPS
2. **防火墙**：开放 8008/8080 端口
3. **备份**：定期备份 `data/postgres` 和 `config/matrix_key.pem`
4. **监控**：配置日志收集和告警

## 故障排除

### 端口被占用

```bash
# 检查端口占用
netstat -tlnp | grep 8008
netstat -tlnp | grep 8080
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 状态
docker-compose logs matrix-postgres
```

### Dendrite 启动失败

```bash
# 查看详细日志
docker-compose logs dendrite
```

## 注意事项

- `matrix_key.pem` 首次启动自动生成，**勿删除**
- 修改 `.env` 后需要重新运行 `./start.sh`
- Federation 默认关闭，仅内部使用
