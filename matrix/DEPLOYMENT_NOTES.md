# Matrix 部署问题与改进记录

本文档记录了 Matrix 服务部署过程中遇到的问题、解决方案及改进建议。

---

## 问题 1：配置文件硬编码

### 问题描述

`dendrite.yaml` 和 `element-config.json` 中的关键配置项（如 `server_name`、数据库密码、`base_url`）是硬编码的，无法从 `.env` 统一管理。

**影响**：
- 生产部署需要手动修改多处配置
- 容易遗漏或配置不一致
- 无法通过环境变量快速切换环境

### 解决方案

1. 创建模板文件 `dendrite.yaml.template` 和 `element-config.json.template`，使用 `${VAR}` 占位符
2. 编写 `start.sh` 启动脚本，使用 `envsubst` 动态替换变量
3. 启动时自动生成最终配置文件

### 改进建议

**短期**：已实现模板 + 启动脚本方案

**长期**：
- [ ] 考虑使用 Helm Chart 或 Docker Compose 的 `envsubst` 功能
- [ ] 添加配置验证脚本，启动前检查必要变量是否设置
- [ ] 将 `matrix_key.pem` 也纳入自动化生成流程

---

## 问题 2：Matrix 签名密钥生成困难

### 问题描述

Dendrite 首次启动需要 `matrix_key.pem` 签名密钥文件，但：

1. Dendrite 新版本（0.15.x）移除了 `--generate-keys` 参数
2. 服务器 OpenSSL 版本可能太旧，不支持 `ed25519` 算法
3. 官方文档未提供替代方案

**影响**：
- 首次部署容易失败
- 需要额外的生成步骤

### 解决方案

**方案 A**：在支持 ed25519 的环境（本地开发机）生成密钥，复制到服务器

**方案 B**：使用 Docker 容器内的工具生成（但新版 Dendrite 镜像不包含生成工具）

### 改进建议

**短期**：
- [ ] 在项目仓库中预置一个开发用的密钥文件（仅用于开发环境）
- [ ] 在 `start.sh` 中检测密钥是否存在，不存在时提示用户手动生成

**长期**：
- [ ] 编写跨平台的密钥生成脚本（Python/Go）
- [ ] 或预构建一个专门用于生成密钥的 Docker 镜像

---

## 问题 3：Element Web 端口权限问题

### 问题描述

Element Web 最新镜像（`vectorim/element-web:latest`）默认以非 root 用户运行，无法绑定 80 端口：

```
nginx: [emerg] bind() to 0.0.0.0:80 failed (13: Permission denied)
```

**影响**：
- 使用最新镜像时服务启动失败
- 本地开发环境可能正常（镜像版本可能不同），服务器环境失败

### 解决方案

**方案 A**：使用稳定版本 `v1.11.58`（推荐，已采用）

**方案 B**：添加 `cap_add: NET_BIND_SERVICE` 权限（需要容器运行时支持）

**方案 C**：修改端口映射为非特权端口（如 8080），但 Element Web 镜像内部固定监听 80

### 改进建议

- [ ] 在 `docker-compose.yml` 中固定 Element Web 版本，避免 `latest` 带来的不可控变更
- [ ] 添加版本兼容性说明文档
- [ ] 定期测试新版本兼容性

---

## 问题 4：缺少一键部署能力

### 问题描述

原始部署流程需要多个手动步骤：
1. 复制 .env.example 到 .env
2. 修改配置
3. 生成密钥
4. 运行 docker-compose

**影响**：
- 部署流程复杂，容易出错
- 新用户上手成本高

### 解决方案

已创建 `start.sh` 启动脚本，整合以下步骤：
- 加载 .env
- 验证必要变量
- 生成配置文件
- 检查密钥文件
- 启动服务

### 改进建议

- [ ] 添加 `install.sh` 完整部署脚本：从零开始一键部署
- [ ] 支持交互式配置向导
- [ ] 添加健康检查和自动回滚

---

## 问题 5：重启策略未明确文档化

### 问题描述

虽然 `docker-compose.yml` 配置了 `restart: unless-stopped`，但缺少文档说明：

**影响**：
- 用户不清楚服务的自启动行为
- 可能误以为需要手动配置 systemd 服务

### 解决方案

在 README.md 中明确说明重启策略

### 改进建议

- [ ] 添加运维手册，说明常见运维场景（重启、升级、备份等）
- [ ] 提供监控和告警配置建议

---

## 改进优先级

| 优先级 | 问题 | 行动项 |
|--------|------|--------|
| P0 | 配置硬编码 | ✅ 已解决（模板方案） |
| P0 | Element Web 版本 | ✅ 已解决（固定版本） |
| P1 | 密钥生成 | 添加密钥检测和提示 |
| P1 | 一键部署 | 完善 start.sh |
| P2 | 文档完善 | 运维手册 |
| P2 | 监控告警 | 提供配置建议 |

---

## 文件清单

本次改进新增/修改的文件：

```
matrix/
├── start.sh                      # 启动脚本（新增）
├── stop.sh                       # 停止脚本（新增）
├── docker-compose.yml            # 更新：固定 Element Web 版本
├── .env.example                  # 更新：完善变量说明
├── .env.production               # 新增：生产环境配置模板
├── config/
│   ├── dendrite.yaml.template    # 新增：配置模板
│   └── element-config.json.template  # 新增：配置模板
├── README.md                     # 更新：完整部署文档
└── DEPLOYMENT_NOTES.md           # 本文档（新增）
```

---

## 参考链接

- [Dendrite 官方文档](https://matrix-org.github.io/dendrite/)
- [Element Web releases](https://github.com/vector-im/element-web/releases)
- [Matrix 协议规范](https://spec.matrix.org/)
