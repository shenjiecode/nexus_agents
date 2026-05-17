# Nexus Agents 部署问题与改进记录

本文档记录了 Nexus Agents 系统部署过程中遇到的问题、解决方案及改进建议。

---

## 问题 1：SSH 密码认证超时

### 问题描述

使用密码认证连接服务器时，由于需要交互式输入密码，SSH 命令超时：

```
ssh root@8.217.143.228 "mkdir -p /opt/nexus"
# 超时 120000ms
```

**影响**：
- 无法自动化部署
- 每次操作都需要手动输入密码
- 脚本执行中断

### 解决方案

配置 SSH 密钥认证：

```powershell
# 1. 生成 ED25519 密钥
ssh-keygen -t ed25519 -C "nexus-deploy" -f $env:USERPROFILE\.ssh\nexus_server

# 2. 在服务器上添加公钥
ssh root@8.217.143.228 "mkdir -p ~/.ssh && echo 'ssh-ed25519 AAAA... nexus-deploy' >> ~/.ssh/authorized_keys"

# 3. 配置本地 SSH Config
# 编辑 %USERPROFILE%\.ssh\config
Host nexus-server
    HostName 8.217.143.228
    User root
    IdentityFile C:\Users\你的用户名\.ssh\nexus_server
    IdentitiesOnly yes

# 4. 测试连接
ssh nexus-server "echo 'Connected!'"
```

### 改进建议

**短期**：
- [x] 已配置 SSH 密钥认证

**长期**：
- [ ] 创建部署专用账户（非 root）
- [ ] 配置 SSH 证书签名（更安全的密钥管理）
- [ ] 添加 SSH config 到项目文档

---

## 问题 2：Node.js 版本与 pnpm 不兼容

### 问题描述

使用 `node:20-alpine` 镜像时，pnpm 11 报错：

```
warn: This version of pnpm requires at least Node.js v22.13
The current version of Node.js is v20.20.2

Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite
```

**影响**：
- Backend 容器启动失败
- pnpm 无法安装依赖

### 解决方案

升级基础镜像：

```dockerfile
# 错误
FROM node:20-alpine

# 正确
FROM node:22-alpine
```

### 改进建议

**短期**：
- [x] 已使用 Node.js 22

**长期**：
- [ ] 在 package.json 中明确指定 Node.js 版本要求
- [ ] 添加 `.nvmrc` 文件锁定 Node.js 版本
- [ ] CI/CD 中检查 Node.js 版本兼容性

---

## 问题 3：pnpm 构建脚本安全限制

### 问题描述

pnpm 11 默认禁止运行第三方包的构建脚本：

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: cpu-features@0.0.10, esbuild@0.18.20, ...
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

在 Docker 构建中无法交互式批准，导致依赖安装失败。

**影响**：
- Docker 镜像构建失败
- 即使添加 `--ignore-scripts=false` 也报错退出码 1

### 解决方案

**方案 A**：使用 npm 替代 pnpm（已采用）

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

**方案 B**：添加 `.npmrc` 配置（未验证）

```
ignore-scripts=false
```

### 改进建议

**短期**：
- [x] 已使用 npm 替代 pnpm 构建 Docker 镜像

**长期**：
- [ ] 调研 pnpm 在 CI/CD 中的最佳实践
- [ ] 考虑锁定 pnpm 版本为 10.x（支持 Node 20+）
- [ ] 或在 Dockerfile 中预先批准特定包的构建脚本

---

## 问题 4：npm 在 Alpine 容器中运行异常

### 问题描述

在服务器上直接运行容器时，npm 报错：

```
npm error Cannot read properties of null (reading 'matches')
```

**影响**：
- 无法在服务器上实时构建
- 必须本地构建后上传

### 解决方案

**本地构建 Docker 镜像，上传到服务器**：

```powershell
# 1. 本地构建
cd backend
docker build -t nexus-backend:latest .

# 2. 导出镜像
docker save nexus-backend:latest -o nexus-backend.tar

# 3. 上传到服务器
scp nexus-backend.tar nexus-server:/opt/nexus/

# 4. 在服务器上加载镜像
ssh nexus-server "docker load -i /opt/nexus/nexus-backend.tar"
```

### 改进建议

**短期**：
- [x] 已采用本地构建+上传方案

**长期**：
- [ ] 配置 Docker Registry（如 Harbor、阿里云 ACR）
- [ ] 或使用 GitHub Container Registry (ghcr.io)
- [ ] CI/CD 流水线自动构建和推送镜像

---

## 问题 5：Docker 镜像传输效率低

### 问题描述

Docker 镜像 149MB，直接 scp 上传可能中断：

```
scp nexus-backend.tar nexus-server:/opt/nexus/
# Connection reset by 8.217.143.228 port 22
# Couldn't send packet: Broken pipe
```

尝试管道传输也失败：

```
docker save nexus-backend:latest | ssh nexus-server "docker load"
# archive/tar: invalid tar header
```

**影响**：
- 大文件上传不稳定
- 部署时间长

### 解决方案

**方案 A**：重试 scp（最终成功）

```powershell
scp nexus-backend.tar nexus-server:/opt/nexus/nexus-backend.tar
# 重试后成功
```

**方案 B**：使用 gzip 压缩传输（推荐）

```bash
# Linux/macOS
docker save nexus-backend:latest | gzip | ssh nexus-server "gunzip | docker load"
```

**方案 C**：使用 Docker Registry（最佳）

```bash
docker tag nexus-backend:latest registry.example.com/nexus-backend:latest
docker push registry.example.com/nexus-backend:latest
ssh nexus-server "docker pull registry.example.com/nexus-backend:latest"
```

### 改进建议

**短期**：
- [ ] 添加镜像压缩和断点续传脚本

**长期**：
- [ ] 配置私有 Docker Registry
- [ ] 镜像分层优化（减小体积）
- [ ] 使用 BuildKit 加速构建

---

## 问题 6：PostgreSQL 端口冲突

### 问题描述

服务器上 Matrix 的 PostgreSQL 已占用 5432 端口：

```
Error: Bind for 0.0.0.0:5432 failed: port is already allocated
```

**影响**：
- nexus-postgres 容器启动失败

### 解决方案

修改 docker-compose.yml 使用 5433 端口：

```yaml
postgres:
  image: postgres:15-alpine
  ports:
    - "5433:5432"  # 外部端口改为 5433
```

**注意**：容器内部仍使用 5432，DATABASE_URL 使用容器名：

```yaml
DATABASE_URL: postgresql://nexus:xxx@postgres:5432/nexus
```

### 改进建议

**短期**：
- [x] 已改用 5433 端口

**长期**：
- [ ] 使用 Docker 网络隔离（不暴露端口到宿主机）
- [ ] 或使用外部托管数据库（如 RDS）

---

## 问题 7：数据库表不存在

### 问题描述

Backend 启动时报错：

```
PostgresError: relation "employees" does not exist
```

**原因**：
- 新建的 PostgreSQL 数据库没有表结构
- drizzle-kit push 需要运行中的容器执行
- 容器因表不存在而不断重启

### 解决方案

**手动执行 SQL 初始化**：

```powershell
# 1. 创建 SQL 文件
# init-db.sql 包含所有表的 CREATE TABLE 语句

# 2. 上传并执行
scp init-db.sql nexus-server:/opt/nexus/
ssh nexus-server "docker compose exec -T postgres psql -U nexus -d nexus < init-db.sql"
```

**SQL 文件位置**：`deploy/init-db.sql`

### 改进建议

**短期**：
- [x] 已创建 init-db.sql
- [ ] 添加到部署脚本

**长期**：
- [ ] Backend 启动时自动执行 drizzle-kit push
- [ ] 或使用迁移文件（drizzle-kit generate）
- [ ] CI/CD 中管理数据库迁移

---

## 问题 8：前端 API 地址硬编码

### 问题描述

前端代码硬编码了 localhost：

```typescript
// src/hooks/useApi.ts
const API_BASE_URL = 'http://localhost:13207';
```

**影响**：
- 生产环境无法连接后端
- 每次部署需要修改代码

### 解决方案

使用 Vite 环境变量：

```typescript
// src/hooks/useApi.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:13207';
```

```
# .env.development
VITE_API_BASE_URL=http://localhost:13207

# .env.production（空字符串表示使用相对路径，由 Nginx 代理）
VITE_API_BASE_URL=
```

**添加类型声明**：

```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}
```

### 改进建议

**短期**：
- [x] 已使用环境变量

**长期**：
- [ ] 添加更多环境变量（如 API 超时时间）
- [ ] 文档化所有环境变量

---

## 部署架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Server: 8.217.143.228                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐     ┌─────────────────┐              │
│  │  nexus-frontend │     │  nexus-backend  │              │
│  │  nginx:alpine   │────▶│  nexus-backend  │              │
│  │  :13208         │     │  :13207         │              │
│  └─────────────────┘     └────────┬────────┘              │
│                                    │                        │
│                          ┌─────────┴─────────┐             │
│                          ▼                   ▼             │
│                   ┌─────────────┐    ┌─────────────┐       │
│                   │nexus-postgres│    │matrix-postgres│    │
│                   │:5433        │    │:5432         │       │
│                   └─────────────┘    └─────────────┘       │
│                                                             │
│  ┌─────────────────┐     ┌─────────────────┐              │
│  │ matrix-dendrite │◀───▶│ matrix-element  │              │
│  │ :8008          │     │ :8080           │              │
│  └─────────────────┘     └─────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 完整部署命令参考

### 本地准备

```powershell
# 构建 Backend Docker 镜像
cd backend
docker build -t nexus-backend:latest .

# 构建 Frontend
cd ../frontend
pnpm install
pnpm build

# 导出 Backend 镜像
docker save nexus-backend:latest -o ../deploy/nexus-backend.tar
```

### 上传到服务器

```powershell
# 上传所有文件
scp -r deploy/* nexus-server:/opt/nexus/
scp -r backend/Dockerfile nexus-server:/opt/nexus/backend/
scp -r frontend/dist/* nexus-server:/opt/nexus/frontend/dist/
scp nexus-backend.tar nexus-server:/opt/nexus/
```

### 服务器部署

```bash
# 加载 Docker 镜像
docker load -i /opt/nexus/nexus-backend.tar

# 初始化数据库
docker compose -f /opt/nexus/docker-compose.yml exec -T postgres psql -U nexus -d nexus < /opt/nexus/init-db.sql

# 启动服务
docker compose -f /opt/nexus/docker-compose.yml up -d

# 检查状态
docker compose -f /opt/nexus/docker-compose.yml ps
docker compose -f /opt/nexus/docker-compose.yml logs -f backend
```

### 验证

```bash
# 测试 Backend API
curl http://localhost:13207/api/organizations

# 测试 Frontend
curl http://localhost:13208/

# 测试 API 代理
curl http://localhost:13208/api/organizations
```

---

## 文件清单

本次部署新增的文件：

```
项目根目录/
├── backend/
│   ├── Dockerfile              # Backend Docker 镜像构建文件
│   ├── .dockerignore           # Docker 构建忽略文件
│   ├── .env.example            # 环境变量模板（已更新）
│   ├── .env.production         # 生产环境配置
│   └── .npmrc                  # npm 配置（可选）
│
├── frontend/
│   ├── .env.development        # 开发环境变量
│   ├── .env.production         # 生产环境变量
│   └── src/vite-env.d.ts       # Vite 类型声明
│
├── deploy/
│   ├── docker-compose.yml      # 服务编排配置
│   ├── nginx.conf              # Nginx 配置
│   ├── init-db.sql             # 数据库初始化脚本
│   ├── deploy.sh               # 部署脚本
│   └── README.md               # 部署文档
│
└── .ssh/
    └── config                  # SSH 配置（添加 nexus-server）
```

---

## 后续优化建议

### 优先级 P0（必须）

- [ ] 配置 HTTPS（Let's Encrypt 或云服务商证书）
- [ ] 设置数据库自动备份
- [ ] 添加日志收集和告警

### 优先级 P1（推荐）

- [ ] 配置私有 Docker Registry
- [ ] CI/CD 自动化部署
- [ ] 添加健康检查端点

### 优先级 P2（可选）

- [ ] 使用外部托管数据库
- [ ] 配置 CDN 加速前端
- [ ] 添加监控面板（如 Grafana）

---

## 参考链接

- [pnpm 官方文档](https://pnpm.io/)
- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)
- [Drizzle ORM 迁移](https://orm.drizzle.team/docs/migrations)
- [Vite 环境变量](https://vitejs.dev/guide/env-and-mode.html)
