# Nexus Agents 部署指南

## 服务器信息

- IP: `8.217.143.228`
- 用户: `root`
- Matrix 已部署在 `/opt/matrix/`

## 目录结构

服务器部署目录：`/opt/nexus/`

```
/opt/nexus/
├── docker-compose.yml     # 服务编排
├── nginx.conf             # Nginx 配置
├── deploy.sh              # 部署脚本
├── data/
│   └── postgres/          # 数据库数据
├── backend/               # Backend 源码（复制）
└── frontend/
│   └── dist/              # 前端构建产物
```

## 服务组成

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| PostgreSQL | nexus-postgres | 5432 | 业务数据库 |
| Backend | nexus-backend | 13207 | API 服务 |
| Frontend | nexus-frontend | 13208 | Web 界面 |

## 部署步骤

### 1. 本地准备

```bash
# 在本地项目根目录
cd frontend && pnpm install && pnpm build
cd backend && pnpm install
```

### 2. 上传到服务器

```bash
# 创建目录
ssh root@8.217.143.228 "mkdir -p /opt/nexus"

# 上传文件
scp -r deploy/* root@8.217.143.228:/opt/nexus/
scp -r backend root@8.217.143.228:/opt/nexus/
scp -r frontend/dist root@8.217.143.228:/opt/nexus/frontend/
```

### 3. 服务器部署

```bash
ssh root@8.217.143.228

cd /opt/nexus
chmod +x deploy.sh
./deploy.sh
```

### 4. 验证

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f backend
```

## 访问地址

- Frontend: http://8.217.143.228:13208
- Backend API: http://8.217.143.228:13207
- Matrix Element: http://8.217.143.228:8080

## 配置说明

### Backend 环境变量

关键配置（在 docker-compose.yml 中）：

| 变量 | 值 | 说明 |
|------|-----|------|
| DATABASE_URL | postgresql://nexus:xxx@postgres:5432/nexus | 业务数据库 |
| MATRIX_HOMESERVER_URL | http://8.217.143.228:8008 | Matrix 服务器 |
| MATRIX_REGISTRATION_SECRET | nexus_matrix_secret_xK9mP2vL7qR4wY6j | 注册密钥 |
| DOCKER_HOST | /var/run/docker.sock | Docker socket |

### Nginx 配置

- `/api` 路径代理到 Backend `13207`
- 其他路径返回静态文件
- SPA 路由支持（fallback 到 index.html）

## 常用命令

```bash
# 启动
docker compose up -d

# 停止
docker compose down

# 重启 Backend
docker compose restart backend

# 查看日志
docker compose logs -f backend

# 重建 Backend
docker compose up -d --build backend
```

## 防火墙

需要开放的端口：

| 端口 | 服务 | 说明 |
|------|------|------|
| 8080 | Element Web | Matrix 客户端 |
| 8008 | Dendrite | Matrix API |
| 13207 | Backend | 业务 API |
| 13208 | Frontend | Web 界面 |

```bash
# 开放端口
iptables -I INPUT -p tcp --dport 13207 -j ACCEPT
iptables -I INPUT -p tcp --dport 13208 -j ACCEPT
```

## 故障排除

### Backend 无法连接数据库

```bash
# 检查 PostgreSQL 状态
docker compose logs postgres

# 检查网络
docker compose exec backend ping postgres
```

### Frontend 502 错误

```bash
# 检查 Backend 是否运行
docker compose ps backend

# 检查 Nginx 配置
docker compose exec frontend cat /etc/nginx/conf.d/default.conf
```

### Backend 无法连接 Docker

```bash
# 检查 Docker socket
ls -la /var/run/docker.sock

# 确保 backend 容器挂载了 socket
docker compose config | grep docker.sock
```

## 更新部署

### 更新 Frontend

```bash
# 本地重新构建
cd frontend && pnpm build

# 上传新版本
scp -r dist/* root@8.217.143.228:/opt/nexus/frontend/dist/

# 刷新 Nginx 缓存（如有）
docker compose exec frontend nginx -s reload
```

### 更新 Backend

```bash
# 上传新代码
scp -r ../backend root@8.217.143.228:/opt/nexus/backend/

# 重建容器
docker compose up -d --build backend
```

## 注意事项

1. **数据库密码**：生产环境请修改 `POSTGRES_PASSWORD`
2. **API Key**：上传前替换 `OPENCODE_API_KEY` 为真实值
3. **Docker Socket**：Backend 需要 Docker socket 权限来创建 Agent 容器
4. **备份**：定期备份 `data/postgres` 目录