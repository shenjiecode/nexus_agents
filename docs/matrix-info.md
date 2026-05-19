# Matrix 服务信息

> 最后更新：2026-05-18

## 一、服务器

| 项目 | 值 |
|------|-----|
| Homeserver | `http://8.217.143.228:8008` |
| Element Web | `http://8.217.143.228:8080` |
| Server Name | `8.217.143.228`（用户 ID 后缀：`@xxx:8.217.143.228`） |
| 软件 | Dendrite (Monolith) |
| 协议版本 | r0.0.1 ~ v1.2 |
| 数据库 | PostgreSQL 15 |
| 部署方式 | Docker Compose（`/opt/matrix/`） |

### 当前配置

| 配置项 | 状态 |
|--------|------|
| 联邦（Federation） | ❌ 关闭，仅内部使用 |
| 开放注册 | ❌ 关闭，仅通过 Shared Secret 注册 |
| E2EE | ❌ 未启用（Element 侧已关闭） |
| Presence | ❌ 关闭（计划开启） |
| 聊天历史保留 | 7 天（计划改为 30 天） |
| 媒体上传限制 | 10MB |
| 速率限制 | 20 次 / 500ms 冷却 |

---

## 二、管理凭据

### 注册密钥（最高权限）

用于通过 HMAC-SHA1 签名创建任意 Matrix 用户。

```
Registration Secret: nexus_matrix_secret_xK9mP2vL7qR4wY6j
```

> ⚠️ 此密钥等价于 Matrix 服务器的 root 权限。泄露后任何人都能创建用户。

### 管理账号

Dendrite 没有传统 admin API，管理账号与普通账号权限相同，仅用于日常操作。

| 项目 | 值 |
|------|-----|
| User ID | `@test-admin:8.217.143.228` |
| 密码 | `TestAdmin2024!` |
| Access Token | `T7XKlcLnMGYQjKPL__tiIdS4yH8uXlC7rDfqpCgjHl8` |

---

## 三、账号列表

### 测试账号（8 个）

| Username | 密码 | User ID | Access Token | Device ID |
|----------|------|---------|-------------|-----------|
| alice | Alice@2026 | `@alice:8.217.143.228` | `QCrjV8SRMJArAGGBfqq2dcT8ZgypTH15NVGKdrArZzc` | nexus-alice |
| bob | Bob@2026 | `@bob:8.217.143.228` | `PU80soeveBjEQatqKf2f20WMlLc5puWMIWnuAQqN5F8` | nexus-bob |
| charlie | Charlie@2026 | `@charlie:8.217.143.228` | `kGFAsLvddoA2bPcen7AFNEao7IlT1GX7ArLp5D4qDRI` | nexus-charlie |
| diana | Diana@2026 | `@diana:8.217.143.228` | `iN-9ZO1lYNG-aYgHWJp-n3J5HIemQnbV27MkfLjltbs` | nexus-diana |
| eve | Eve@2026 | `@eve:8.217.143.228` | `GNfDKiNLfkDNAvCCd8Guk6ZUFXsh7TiIxWb4hJIlBgM` | nexus-eve |
| frank | Frank@2026 | `@frank:8.217.143.228` | `Nt1l-IhNv_tIOJPdbcDaAtybZQVqY_Bw6SSLwYzSdWA` | nexus-frank |
| grace | Grace@2026 | `@grace:8.217.143.228` | `Gzc7VdA0XV020ZXqrVUU231yKbVKKc3CT-kqBFqq09Q` | nexus-grace |
| henry | Henry@2026 | `@henry:8.217.143.228` | `tY9nROKwYTzdLIoPYZgC6_L1glJgEDmrt2YXtQt-e24` | nexus-henry |

### PoC 残留账号（2 个，已停用）

| Username | User ID | 说明 |
|----------|---------|------|
| picoclaw-test | `@picoclaw-test:8.217.143.228` | PicoClaw PoC 测试用户，容器已清理，处于离线状态 |
| test-admin | `@test-admin:8.217.143.228` | 管理用途 |

---

## 四、当前房间

| 房间 ID | 类型 | 成员 | 说明 |
|---------|------|------|------|
| `!Nv5LJuNmt6ysLx12:8.217.143.228` | DM | frank, eve | Frank ↔ Eve 私聊 |

---

## 五、LLM Provider 映射

用于 PicoClaw / Agent 容器调用大模型。

| OpenCode Provider | 实际 API Endpoint | 环境变量名 |
|-------------------|-------------------|-----------|
| `tencent-coding-plan` | `https://api.lkeap.cloud.tencent.com/coding/v3` | `TENCENT_CODING_PLAN_API_KEY` |
| `zai-coding-plan` | `https://api.z.ai/api/coding/paas/v4` | `ZHIPU_API_KEY` |

当前使用的 API Key：`sk-sp-VjFsjc0cKH3lbhH1SnDkqBKkJCjaqWHUV8phwx6qMPBhvpoe`（对应 `tencent-coding-plan`）

可用模型：glm-5, minimax-m2.5, kimi-k2.5, hunyuan-turbos, hunyuan-t1, hunyuan-2.0-instruct, hunyuan-2.0-thinking

---

## 六、计划变更

- [ ] 开启 Presence（`enable_inbound: true`, `enable_outbound: true`）
- [ ] 聊天历史保留改为 30 天（`purge_age: 720h`）
- [ ] 清理 PoC 残留账号（需操作 Dendrite PostgreSQL）

---

## 七、部署信息

### 目录结构（服务器 `8.217.143.228`）

```
/opt/matrix/
├── docker-compose.yml
├── .env
├── config/
│   ├── dendrite.yaml
│   ├── element-config.json
│   └── matrix_key.pem          # 签名密钥，勿删除
└── data/
    ├── postgres/                # 数据库数据
    ├── media/                   # 媒体文件
    └── jetstream/               # 消息队列
```

### 端口

| 端口 | 服务 | 用途 |
|------|------|------|
| 8008 | Dendrite HTTP | Matrix API |
| 8448 | Dendrite HTTPS | Matrix Federation（当前未启用） |
| 8080 | Element Web | Web 聊天界面 |
| 5432 | PostgreSQL | 数据库（容器内部） |

### 常用命令

```bash
# 启动
cd /opt/matrix && ./start.sh

# 停止
cd /opt/matrix && ./stop.sh

# 查看日志
docker-compose logs -f dendrite

# 重启
./stop.sh && ./start.sh
```
