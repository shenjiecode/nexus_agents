# Dockerfile 模板

---

# Go 后端

```dockerfile
# 构建阶段
FROM golang:1.24 AS builder
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

# 运行阶段
FROM alpine:3.20
COPY --from=builder /server /server
CMD ["/server"]
```

---

# React 前端

```dockerfile
# 构建阶段
FROM node:24 AS builder
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install
COPY frontend/ .
RUN pnpm build

# 运行阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
```
