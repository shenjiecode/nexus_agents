# 部署规范

- **Monorepo**：所有代码在一个仓库，各部分可独立运行，容器编排一键启动
- **隔离构建**：每个服务有独立 Dockerfile，构建上下文限定在自己目录。模板见 `templates.md`
- **健康检查**：每个后端服务提供 `/health` 接口
- **回滚**：每次部署前打 git tag（`MAJOR.MINOR.PATCH`），回滚：`git checkout v1.0.0 && compose build && compose up -d`
- **部署流程**：`git pull → git tag → compose build → compose up -d → curl /health`
