# 前端规范

---

# 目录结构（React）

```txt
src/
├── components/       # 可复用基础组件
├── features/         # 按业务领域组织
├── hooks/            # 全局共享 Hooks
├── pages/            # 页面组件（对应路由）
├── store/            # 全局状态管理
└── utils/            # 工具函数
```

共置原则：组件的样式、类型、测试放在同一文件夹内。

---

# 目录结构（Taro）

```txt
├── config/           # Taro 编译配置
├── src/
│   ├── pages/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── store/
├── package.json
└── project.config.json
```

---

# 领域特有约束

- 错误提示面向用户，不暴露技术细节；加载态和空态必须有合理展示
