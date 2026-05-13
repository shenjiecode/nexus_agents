# 验证流程

代码写完后必须验证，不能只靠 LSP。

---

## 代码编辑后必做（轻量）

**每次编辑后都要执行：**

1. LSP 诊断确保无错误
2. 重新读取修改的文件，确认无多余/重复代码

---

## 按改动类型验证（按需）

**仅当改动较大或不确定时执行：**

### 后端改动（API、逻辑）

```bash
# 启动服务
docker-compose up -d
cd backend && go run cmd/server/main.go
```

验证 API：
```bash
curl -X POST http://localhost:8080/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

### 前端改动（逻辑、页面）

```bash
# 启动后端
docker-compose up -d
cd backend && go run cmd/server/main.go

# 启动前端（另一个终端）
cd frontend && npm run dev
```

使用 Playwright 验证页面：
- 检查页面能否正常加载
- 检查关键元素是否存在
- 检查控制台是否有错误

### 样式改动

使用 Playwright 截图验证：
- 检查布局是否正确
- 检查元素显示是否符合预期

### 重构改动

启动服务验证功能不变：
- 原有功能正常工作
- 无新增错误

---

## 提交前必做（完整）

**提交前必须执行 review.md 检查清单：**

- [ ] 只修改了必要的文件，未动无关模块
- [ ] 类型检查、测试通过
- [ ] 无硬编码密钥、异常被吞、未完成 TODO、调试代码
- [ ] 新增代码遵循项目已有模式
- [ ] 错误已显式处理，无空 catch
- [ ] 涉及数据库：Schema 可回滚，字段命名符合规范
- [ ] 涉及 API：参数校验完整，错误返回统一

最终三问：
- 这次修改真的必要吗？
- 是否有更简单的方案？
- 半年后的我能看懂吗？

---

## 服务启动与清理规范

### 启动前检查

```bash
# 检查服务是否已运行
docker ps | grep mysql  # 检查数据库
lsof -i :8080          # 检查后端
lsof -i :5173          # 检查前端默认端口
```

### 按需启动服务

**只启动未运行的服务，记录实际端口：**

```bash
# 数据库（如果未运行）
if ! docker ps | grep -q mysql; then
  docker-compose up -d
  echo "Started: docker-compose"
fi

# 后端（如果未运行）
if ! lsof -i :8080 > /dev/null 2>&1; then
  cd backend && go run cmd/server/main.go &
  BACKEND_PID=$!
  echo "Started: backend (PID: $BACKEND_PID, Port: 8080)"
fi

# 前端（如果未运行）
# 注意：Vite 可能使用 5173/5174/5175 等端口
if ! lsof -i :5173 > /dev/null 2>&1; then
  cd frontend && npm run dev 2>&1 | tee /tmp/frontend.log &
  FRONTEND_PID=$!
  # 等待启动并获取实际端口
  sleep 3
  FRONTEND_PORT=$(grep -oP 'Local:\s+http://localhost:\K\d+' /tmp/frontend.log || echo "5173")
  echo "Started: frontend (PID: $FRONTEND_PID, Port: $FRONTEND_PORT)"
fi
```

### 记录启动状态

**创建临时文件记录自己启动的服务：**

```bash
# 记录自己启动的服务（用于清理）
echo "" > /tmp/opc-services-started.txt
[ -n "$BACKEND_PID" ] && echo "backend:$BACKEND_PID" >> /tmp/opc-services-started.txt
[ -n "$FRONTEND_PID" ] && echo "frontend:$FRONTEND_PID:$FRONTEND_PORT" >> /tmp/opc-services-started.txt
```

### 清理时只清理自己启动的

```bash
# 读取并清理自己启动的服务
if [ -f /tmp/opc-services-started.txt ]; then
  while IFS=: read -r service pid port; do
    case $service in
      backend)
        kill $pid 2>/dev/null && echo "Stopped: backend (PID: $pid)"
        ;;
      frontend)
        kill $pid 2>/dev/null && echo "Stopped: frontend (PID: $pid, Port: $port)"
        ;;
    esac
  done < /tmp/opc-services-started.txt
  rm /tmp/opc-services-started.txt
fi

# 注意：不清理 docker，除非是自己启动的
# 如果需要清理 docker，启动时应该记录
echo "Cleanup complete. Existing services untouched."
```

### tmux 方式（推荐用于复杂验证）

```bash
# 创建会话（仅在需要时）
tmux has-session -t opc-dev 2>/dev/null || tmux new-session -d -s opc-dev

# 启动服务到 tmux 窗口
tmux list-windows -t opc-dev | grep -q backend || {
  tmux new-window -t opc-dev -n backend
  tmux send-keys -t opc-dev:backend "cd backend && go run cmd/server/main.go" Enter
}

tmux list-windows -t opc-dev | grep -q frontend || {
  tmux new-window -t opc-dev -n frontend
  tmux send-keys -t opc-dev:frontend "cd frontend && npm run dev" Enter
  sleep 3
  # 获取实际端口
  tmux capture-pane -t opc-dev:frontend -p | grep -oP 'Local:\s+http://localhost:\K\d+'
}

# 清理时只关闭自己创建的窗口/会话
tmux kill-window -t opc-dev:backend 2>/dev/null
tmux kill-window -t opc-dev:frontend 2>/dev/null
# 如果会话是空的了，关闭会话
tmux list-windows -t opc-dev | wc -l | grep -q '^1$' && tmux kill-session -t opc-dev
```

---

## Playwright 验证示例

**注意：使用实际获取的前端端口**

```bash
# 先获取实际端口
FRONTEND_PORT=$(lsof -i :5173 -i :5174 -i :5175 | grep LISTEN | head -1 | awk '{print $9}' | cut -d: -f2)
echo "Frontend running on port: $FRONTEND_PORT"
```

```typescript
```typescript
// 截图验证（使用动态端口）
await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 5173}`);
await page.screenshot({ path: '.screenshots/screenshot.png' });
await expect(page.locator('h1')).toBeVisible();

// 检查控制台无错误
const errors: string[] = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
// ... 操作后检查 errors 数组
```
