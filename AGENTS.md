# AGENTS.md

# 技术栈

| 领域 | 选择 |
|------|------|
| 前端 | React + TypeScript，shadcn/ui + Tailwind |
| 小程序/移动端 | Taro |
| 后端 | Go（Gin + GORM + Viper + Zap） |
| AI/ML | Python（FastAPI） |
| 工具/脚本 | TypeScript（Node.js） |
| 格式化 | gofmt（Go）/ ruff（Python）/ Prettier（TS），提交前必须格式化 |
| 测试 | gotests / pytest / Vitest + Playwright |
---

各项目的关键技术记录在 `项目/README.md`（如 `frontend/README.md`）。

---

⚠️ **执行任何操作前，先匹配下方触发词，加载对应规则文件**

---

# 按需加载

| 触发词 | 规则文件 | 核心内容 |
|--------|----------|----------|
| `写代码`、`修Bug`、`重构`、`Debug`、`优化` | behavior.md + verification.md | 思考方式、工作原则、验证流程 |
| `提交`、`commit`、`git`、`push` | conventions.md + review.md + verification.md | Git提交规范、提交前检查、验证流程 |
| `API`、`数据库`、`字段`、`表`、`安全`、`错误码`、`配置`、`日志` | conventions.md | API/DB/安全/错误码/配置/日志规范 |
| `架构`、`模块`、`依赖`、`分层`、`新建项目`、`初始化目录` | architecture.md + frontend.md + backend.md | 架构原则、前后端目录结构 |
| `部署`、`Docker`、`docker-compose`、`容器` | deployment.md + templates.md | 部署规范、Dockerfile模板 |
| `写Dockerfile` | templates.md | Dockerfile模板 |
| `修改规则`、`新增规则`、`删除规则`、`AGENTS.md` | philosophy.md | 规则哲学 |

**规则文件位置**: `docs/rules/`

---
---

# 行为底线

## 先理解，再动手

- 修改前必须阅读相关代码，理解模块职责和调用关系
- 禁止猜测未确认的行为，搜索到确认或读完代码为止

## 最小修改

- 只解决当前任务，禁止顺手重构、升级依赖、改架构、统一风格
- 修复问题时仅修改必要范围，保持兼容

## 验证后结束

- 修改后必须验证：编译、类型检查、相关测试
- 禁止提交构建失败、类型错误或测试失败的代码

## 安全底线

- 禁止硬编码密钥/密码/Token，禁止提交 .env
- 禁止静默吞掉错误、空 catch
- 禁止绕过类型系统（any、@ts-ignore）

## 关键决策询问

**何时需要询问**：

- 用户要求与项目关键技术冲突
- 重要决策需人类确认（架构选择、安全相关、影响范围大的改动）

**如何询问**：

1. 一次问一个问题
2. 提供推荐答案和理由
3. 等待用户确认再继续

---

规则未覆盖的情境，优先遵循项目既有代码风格。
