# Nexus Agents Frontend

Role Container Management System - 前端管理界面

## 技术栈

- **框架**: React 18 + TypeScript
- **构建**: Vite
- **样式**: Tailwind CSS (赛博主题)
- **路由**: React Router v6
- **包管理**: pnpm

## 启动

```bash
# 安装依赖 (在项目根目录)
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 预览生产构建
pnpm preview
```

## 端口

- 默认端口: `13208`
- API 代理: `/api` → `http://localhost:13207`

## 设计主题

### 赛博风格 (Cyberpunk)

| 元素 | 配色 |
|------|------|
| 背景 | 深色渐变 `#0A0A0F` → `#1E1E2E` |
| 主色调 | 霓虹青 `#00D9FF` |
| 次色调 | 霓虹紫 `#8B5CF6` |
| 文字 | 白色 `#FFFFFF` / 灰色 `#94A3B8` |
| 错误色 | 红色 `#EF4444` |

### 字体

| 用途 | 字体 |
|------|------|
| 标题 | Space Grotesk |
| 正文 | Inter |
| 技术数据 | JetBrains Mono |

### 视觉元素

- 网格背景 + 扫描线动画
- 霓虹发光边框
- 状态脉冲指示灯
- Hover 浮起 + 光晕增强

## 目录结构

```
frontend/
├── src/
│   ├── components/    # 可复用组件
│   │   ├── CyberCard.tsx
│   │   ├── CyberButton.tsx
│   │   ├── CyberModal.tsx
│   │   ├── StatusDot.tsx
│   │   └── Sidebar.tsx
│   ├── pages/         # 页面组件
│   │   ├── Dashboard.tsx
│   │   ├── Organizations.tsx
│   │   ├── OrganizationDetail.tsx
│   │   ├── Roles.tsx
│   │   └── Containers.tsx
│   ├── hooks/         # 自定义 hooks
│   │   └── useApi.ts
│   ├── types/         # TypeScript 类型
│   ├── App.tsx        # 主应用
│   ├── main.tsx       # 入口
│   └── index.css      # 全局样式
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 组件规范

### CyberCard

发光卡片容器:

```tsx
<CyberCard glowColor="cyan">
  {content}
</CyberCard>
```

### CyberButton

霓虹按钮:

```tsx
<CyberButton variant="primary" onClick={handleClick}>
  Create
</CyberButton>

// variant: primary | secondary | danger | ghost
```

### StatusDot

状态指示灯:

```tsx
<StatusDot status="running" pulse />
// status: running | stopped | error | unknown
```

## API 集成

### useApi Hook

```tsx
const { data, loading, error, refetch } = useApi('/api/organizations');

if (loading) return <Skeleton />;
if (error) return <Error message={error} />;
return <OrganizationList data={data} />;
```

### API 响应格式

所有 API 返回统一格式:

```typescript
// 成功
{ success: true, data: [...] }

// 错误
{ success: false, error: "message" }
```

## 页面说明

### Dashboard

- 系统统计 (组织数、角色数、运行容器)
- 快捷操作卡片
- 最近活动

### Organizations

- 组织列表表格
- 创建组织弹窗
- 点击进入详情页

### OrganizationDetail

- 组织基本信息
- 容器列表
- Auth.json 管理
- 雇佣新容器

### Roles

- 角色网格布局
- 版本历史展示
- 创建角色弹窗

### Containers

- 容器状态表格
- 启/停/删除操作
- 组织筛选器

## 开发规范

参见项目根目录 `AGENTS.md`

### 样式约定

- 使用 Tailwind utility classes
- 赛博主题色通过 CSS 变量定义
- 禁止内联 style (除动态值外)

### 状态管理

- 使用 useState + useApi
- 暂无全局状态管理 (页面级状态)

### 错误处理

- API 错误显示 toast 提示
- Loading 显示 skeleton
- 空数据显示 placeholder