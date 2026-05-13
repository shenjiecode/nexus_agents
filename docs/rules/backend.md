# 后端规范

---

# Go

```txt
├── cmd/
│   ├── server/        # 主应用入口
│   └── worker/        # 定时任务/后台任务
├── internal/
│   ├── handler/       # HTTP 处理器
│   ├── service/       # 业务逻辑
│   ├── repository/    # 数据访问
│   ├── model/         # 数据模型
│   ├── middleware/
│   └── config/        # 配置加载
├── api/v1/            # 路由定义
└── pkg/utils/
```

分层：`handler → service → repository`，不跨层调用。不忽略 error，用 `fmt.Errorf("context: %w", err)` 包装。禁止 panic 用于业务逻辑。

---

# Python (FastAPI)

```txt
├── pyproject.toml
├── src/myapp/
│   ├── api/v1/        # 路由
│   ├── core/          # 配置
│   ├── models/        # 数据库模型
│   ├── schemas/       # Pydantic 校验
│   ├── services/      # 业务逻辑
│   └── crud/          # 数据访问
└── tests/
```

分层：`路由 → Service → CRUD`。Type hints 必须，Pydantic 做校验，ruff 格式化。

---

# TypeScript (Node.js 后端)

```txt
├── src/
│   ├── features/      # 按业务模块
│   ├── middleware/
│   ├── utils/
│   ├── app.ts
│   └── server.ts
└── tests/
```

strict 模式，禁止 any 和 @ts-ignore。pnpm + Prettier。
