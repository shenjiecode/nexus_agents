# Matrix Server

独立的 Matrix 消息服务器，基于 Dendrite + Element Web。

## 快速启动

```bash
# 启动所有服务
docker-compose up -d

# 查看状态
docker-compose ps

# 停止
docker-compose down
```

Element Web 界面：http://localhost:8080

## 目录结构

```
matrix/
├── docker-compose.yml     # 容器编排
├── .env                   # 环境变量（从 .env.example 复制）
├── .env.example           # 环境变量模板
├── config/
│   ├── dendrite.yaml      # Dendrite 服务器配置
│   ├── element-config.json # Element Web 客户端配置
│   └── matrix_key.pem     # 签名密钥（首次启动自动生成）
├── data/
│   ├── postgres/          # PostgreSQL 数据
│   ├── media/             # 媒体文件
│   └── jetstream/         # Dendrite 消息队列
└── README.md
```

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| Dendrite | 8008 (HTTP) / 8448 (HTTPS) | Matrix Homeserver |
| PostgreSQL | 5432 | 数据库 |
| Element Web | 8080 | Web 聊天客户端 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `POSTGRES_USER` | dendrite | 数据库用户 |
| `POSTGRES_PASSWORD` | itsasecret | 数据库密码 |
| `POSTGRES_DB` | dendrite | 数据库名 |
| `POSTGRES_PORT` | 5432 | PostgreSQL 端口 |
| `DENDRITE_HTTP_PORT` | 8008 | Dendrite HTTP 端口 |
| `DENDRITE_HTTPS_PORT` | 8448 | Dendrite HTTPS 端口 |
| `ELEMENT_PORT` | 8080 | Element Web 端口 |

修改 `.env` 文件自定义配置。

## 注意事项

- 默认关闭 Federation（`disable_federation: true`），仅本地使用
- 公开注册已关闭，用户注册通过 Backend 的 shared-secret API 自动完成
- `matrix_key.pem` 首次启动由 Dendrite 自动生成，勿删除
- 服务器域名默认 `localhost`，生产环境需修改 `dendrite.yaml` 中的 `server_name`
