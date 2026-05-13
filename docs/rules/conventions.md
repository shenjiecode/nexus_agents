# 项目约定

段落索引：API 规范 → 数据库规范 → 安全规范 → 错误码 → 配置管理 → 日志规范 → 提交规范

---

# API 规范

- 全项目保持**一种**风格（RPC 或 REST），不混用。默认 RPC：`POST /模块/动作`
- 统一响应：`{ "code": 0, "message": "success", "data": {} }`
- 输入必须校验，敏感接口必须鉴权
- 分页：`?page=1&pageSize=20`，`data` 内返回 `{ "list": [], "total": 100, "page": 1, "pageSize": 20 }`

---

# 数据库规范

- 表名 snake_case 复数（`users`、`order_items`），字段名 snake_case（`user_name`）
- 关联表两实体下划线连接（`user_roles`），布尔字段 `is_`/`has_` 开头
- 主键统一 `id` BIGINT AUTO_INCREMENT，不用 UUID（除非明确需要）
- **禁止物理外键**，逻辑关联通过字段命名体现
- 推荐 `created_at` 和 `updated_at`，关联表等无状态表可省略
- 字段类型选最精确的（状态 TINYINT、金额 DECIMAL），字段过多时考虑拆分
- Schema 变更前：确认影响范围，提供回滚方案

---

# 安全规范

- 所有入参服务端校验，ORM 参数化查询，禁止拼接 SQL
- 认证方案由项目决定，密码必须哈希存储（禁止明文）
- 禁止在日志、URL、API 响应中暴露密码/Token/手机号

---

# 错误码

纯数字 5 位，AABBB（AA=业务域，BBB=域内编号）。按业务域分配段，新业务域按 10 倍递增，集中定义，新增时先查现有。

---

# 配置管理

- 环境变量全大写下划线，加模块前缀（DB_/REDIS_/JWT_/APP_/LOG_）
- 敏感配置只在 `.env`，不提交 git，提交 `.env.example`
- 加载顺序：环境变量 > .env > 代码默认值

| 语言 | 加载方式 |
|------|----------|
| Go | Viper |
| Python | pydantic-settings / python-dotenv |
| TypeScript | dotenv |
| 前端（Vite） | VITE_ 前缀 |

---

# 日志规范

- 结构化 JSON，至少包含：时间（ISO 8601）、级别、模块、消息
- 级别：ERROR（影响功能）、WARN（可恢复异常）、INFO（关键业务）、DEBUG（仅开发）
- 禁止记录敏感信息，生产默认 INFO

---

# 提交规范

- Conventional Commits：`type(scope): 描述`
- type：feat / fix / refactor / docs / test / chore / perf / style
- 使用中文描述 commit message
- 按功能分开提交，禁止一把梭（除非只有一个功能）
- 每次提交是原子变更，不混合功能+重构+��复
