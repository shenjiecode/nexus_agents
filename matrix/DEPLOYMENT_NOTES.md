# Matrix 部署问题与改进记录

本文档记录了 Matrix 服务部署过程中遇到的问题、解决方案及改进建议。

---

## 迁移记录：Dendrite → Synapse

### 背景

团队反馈 Dendrite Admin API 极其有限（仅支持 evacuateUser、purgeRoom、resetPassword 等少数操作），无法满足用户管理、房间管理、媒体管理等运维需求。Synapse Admin API 提供上百个端点，覆盖完整的运维场景。

### 变更内容

| 组件 | 旧方案 | 新方案 |
|------|--------|--------|
| Homeserver | Dendrite (`matrixdotorg/dendrite-monolith:latest`) | Synapse (`matrixdotorg/synapse:latest`) |
| Admin UI | 无 | Ketesa (`ghcr.io/etkecc/ketesa:latest`) |
| Web 客户端 | Element Web（保持不变） | Element Web（保持不变） |
| 数据库 | PostgreSQL (dendrite) | PostgreSQL (synapse) |

### 影响范围

- **agent/src/**: 无影响 — 使用标准 Matrix Client-Server API
- **platform/backend/**: 无影响 — 仅引用 `MATRIX_HOMESERVER_URL` 环境变量
- **matrix/**: 完全重写（docker-compose.yml, 配置模板, 启动脚本）

### 新增能力

- 完整的用户管理（CRUD、封禁、重置密码）
- 房间管理（查询、删除、封禁、成员管理）
- 媒体管理（隔离、删除、清理缓存）
- 注册令牌（一次性/多次使用）
- Ketesa Web 管理界面

---

## 历史问题

### 问题 1：配置文件硬编码

**已解决** — 使用模板 + envsubst 方案。迁移到 Synapse 后继续沿用此模式（`homeserver.yaml.template`）。

### 问题 2：签名密钥生成

**已解决** — Synapse 官方镜像内置 `generate` 命令，自动生成签名密钥和日志配置。

### 问题 3：Element Web 端口权限

**已解决** — Element Web 镜像以非 root 运行但监听 80 端口（内部），外部映射到 8080。

### 问题 4：一键部署

**已解决** — `start.sh` 整合：加载 .env → 验证 → 生成配置 → 生成密钥 → 启动 → 创建管理员。

---

## 参考链接

- [Synapse 官方文档](https://element-hq.github.io/synapse/latest/)
- [Synapse Admin API](https://element-hq.github.io/synapse/latest/usage/administration/admin_api/)
- [Ketesa (Synapse Admin UI)](https://github.com/etkecc/synapse-admin)
- [Element Web](https://github.com/element-hq/element-web)
- [Matrix 协议规范](https://spec.matrix.org/)
