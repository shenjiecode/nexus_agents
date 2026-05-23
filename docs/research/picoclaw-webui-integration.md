# PicoClaw WebUI 集成研究

> 研究日期：2026-05-21
> 状态：暂缓实现

## 一、PicoClaw 镜像变体

### 官方 Dockerfile 变体

| 变体 | Docker Hub | 基础镜像 | 包含内容 | 大小 |
|------|------------|----------|----------|------|
| **base** (默认) | ✅ `sipeed/picoclaw:latest` | Alpine | 仅 picoclaw 二进制 | ~15 MB |
| **launcher** | ✅ `sipeed/picoclaw:launcher` | Alpine | picoclaw + launcher + launcher-tui | ~25 MB |
| **full** | ❌ 无预构建 | node:24-alpine | + Node.js, npm, Python3, uv, git, curl | 需自行构建 |
| **heavy** | ❌ 无预构建 | node:24-alpine | + Chromium, Playwright, agent-browser | 需自行构建 |

### 关键发现

1. **`full` 和 `heavy` 变体只存在于 GitHub 源码**，Docker Hub 没有预构建镜像
2. **社区反馈**：base 镜像缺少 python/node 导致很多 skill 无法运行 ([Issue #1228](https://github.com/sipeed/picoclaw/issues/1228))
3. **官方添加 Dockerfile.full** (2026-02-16, commit `ce3fc4b`) 用于 MCP 工具支持
4. **官方合并 Dockerfile.heavy** (2026-03-21, PR #1861) 用于浏览器自动化

### 当前项目实现

- `container_pool.go:109` 硬编码 `sipeed/picoclaw:latest`
- `variant` 参数存在但**未影响镜像选择**
- 测试文件期望 `sipeed/picoclaw:full` 但实现未跟进

---

## 二、WebUI (Launcher) 认证机制

### ⚠️ 重要变化：Token 登录已废弃

**GitHub PR #2608** (2026-04-21) 完全改用密码认证：

```
refactor(web): switch dashboard auth from tokens to passwords

Unsupported auth paths: URL token login (`?token=...`),
PICOCLAW_LAUNCHER_TOKEN, and Authorization: Bearer dashboard auth
are no longer supported.
```

| 特性 | 旧版 (Token) | 新版 (密码) |
|------|-------------|-------------|
| URL 参数登录 | `?token=xxx` | ❌ **已废弃** |
| 环境变量 | `PICOCLAW_LAUNCHER_TOKEN` | ❌ **已废弃/忽略** |
| Bearer 认证 | `Authorization: Bearer xxx` | ❌ **已废弃** |
| 认证方式 | Token | **密码** |
| Session 有效期 | 7 天 | **31 天** |

**文档滞后**：`docs.picoclaw.io` 仍描述 Token 登录可用，但代码已废弃。

### 版本兼容性

- `v0.2.6` 及之前 → ✅ Token 登录可用
- `nightly` / 未来版本 → ❌ 仅支持密码认证

---

## 三、跨域 iframe 集成可行性

### CORS 现状

| 项目 | 状态 |
|------|------|
| `Access-Control-Allow-Origin` | ❌ **未设置**，无配置选项 |
| `X-Frame-Options` | ❌ 未设置（好事，不阻止 iframe） |
| Cookie `SameSite` | 硬编码 `Lax`，不可配置 |
| Launcher CORS 中间件 | **不存在** |

### `-public` 标志作用

- **仅改变绑定地址**：`127.0.0.1` → `0.0.0.0`
- **不解决 CORS**：无任何 CORS headers 被设置
- **用途**：让 LAN 设备可访问

### 跨域 Cookie 问题

```
前端: http://8.217.143.228:13208
Launcher: http://8.217.143.228:4100 (动态端口)

= 不同端口 = 不同源 = 浏览器阻止跨站 Cookie
```

`SameSite=Lax` 允许：
- ✅ 顶层导航（新窗口/新标签页）
- ❌ 跨站 iframe 子资源请求

---

## 四、可选方案

### 方案 A：Backend 反向代理（完整方案）

```
前端 iframe → Backend 代理 → 容器 Launcher
     同源           同源
```

**优点**：
- iframe 同源，无跨域问题
- 完全在 UI 框架内
- 可注入自动登录

**缺点**：
- 实现复杂（代理 + 密码注入）
- 需改动 Backend 和容器启动逻辑

**改动点**：
- `container_pool.go`: 暴露 18800 端口，生成 `launcher-config.json`
- `router.go`: 新增 `/api/proxy/launcher/:roleId/*`
- 新增 `launcher_proxy.go`: 权限检查、自动登录、请求转发
- `RoleDebug.tsx`: 添加 iframe modal

---

### 方案 D：新窗口打开（最简单）

```tsx
const openLauncher = () => {
  const launcherUrl = `http://${serverIP}:${role.launcherPort}`;
  window.open(launcherUrl, '_blank');
};
```

**优点**：
- 无跨域 Cookie 问题（顶层导航允许 Lax）
- Token/密码认证都正常工作
- 无需改 Backend

**缺点**：
- 用户离开我们的 UI
- 需手动输入密码登录

---

### 方案 C：Nginx 同域代理

在前端 Nginx 层代理 Launcher，让两者同域同端口：

```
location /launcher/ {
  proxy_pass http://container-ip:18800/;
}
```

**优点**：
- 同源，无跨域问题

**缺点**：
- 需要动态 Nginx 配置（容器 IP 动态）
- 或需要固定的容器网络模式

---

## 五、结论与建议

### 核心障碍

1. **Token 登录已废弃** — 必须适配密码认证
2. **Launcher 无 CORS 支持** — iframe 跨域无法直接解决
3. **Cookie SameSite=Lax 硬编码** — 跨站 iframe 不发送 Cookie

### 建议优先级

| 优先级 | 方案 | 说明 |
|--------|------|------|
| 🥇 | **方案 D：新窗口打开** | 最简单，马上能用 |
| 🥈 | 方案 A：Backend 代理 | 最完整，需要编码 |
| 🥉 | 方案 C：Nginx 代理 | 需动态配置，复杂 |

### 暂缓原因

- 调试功能非核心需求
- Token 认证在新版本已废弃，需等待密码认证方案稳定
- 跨域问题需要 Backend 改动，投入较大

---

## 六、参考资料

- [PicoClaw 官方文档](https://docs.picoclaw.io)
- [Token 认证登录文档](https://docs.picoclaw.io/docs/configuration/token_authentication/)（已过时）
- [CLI 参数文档](https://docs.picoclaw.io/docs/configuration/cli-parameters/)
- [Dockerfile.full](https://github.com/sipeed/picoclaw/blob/main/docker/Dockerfile.full)
- [Dockerfile.heavy](https://github.com/sipeed/picoclaw/blob/main/docker/Dockerfile.heavy)
- [PR #2608: 密码认证](https://github.com/sipeed/picoclaw/commit/71c877a67fa69c3b)
