# Entity 统一抽象重构

## 目的

Role 和 Container 有大量重复的文件操作、Skill/MCP 配置逻辑。本重构将这些通用逻辑抽取到统一的 Entity 层，同时保留 Role/Container 各自的薄包装层，便于后续各自扩展。

---

## Role vs Container 核心差异

| 维度 | Role | Container |
|------|------|-----------|
| **数据源** | OSS（单一数据源） | 本地文件系统 |
| **持久化** | 元数据（DB）+ OSS 包 | Docker 容器 + 本地 workspace |
| **运行状态** | 临时调试容器（调试完即销毁） | 可启停、持久运行 |
| **生命周期** | 创建 → 调试 → 上传 OSS → 市场共享 | 创建 → 启动 → 运行 → 停止 → 删除 |
| **配额** | 无限制 | 每用户最多 10 个 |
| **Marketplace** | ✅ `isPublic` 支持公开共享 | ❌ 私有，不进入市场 |
| **导入来源** | 从 OSS 下载 | 从 Role（OSS）导入 |
| **导入后关联** | 无关联（独立实体） | 无关联（独立实体） |
| **Matrix 账户** | ❌ 无 | ✅ 自动配置（如果启用） |

---

## 数据源设计原则

### Role = OSS 模板（单一数据源）

```
创建 Role:
  方式1: 手动创建（空模板）→ 本地 workspace
  方式2: 从市场导入 → OSS 下载 → 本地 workspace

修改 Role workspace:
  本地编辑 → 手动同步到 OSS（固化）

删除 Role:
  删除本地 + 删除 OSS
```

### Container = 独立实体（从 OSS 导入后无关联）

```
创建 Container:
  方式1: 手动创建（空模板）
  方式2: 从 Role 导入 → OSS 下载 → 解压到 Container workspace

导入后:
  Container 与 Role 无关联
  Container 数据完全独立
```

### 导入逻辑（重要）

```go
// Container 创建时从 Role 导入
if roleToImport != nil {
    // 1. 从 OSS 下载 Role 包
    ossPath := fmt.Sprintf("roles/%s/%s/package.zip", role.UserID, role.ID)
    zipData := containerOSSService.DownloadFile(ossPath)
    
    // 2. 解压到 Container workspace
    ExtractZipToDir(zipData, containerWorkspaceDir)
    
    // 3. 导入后无关联 - Container 是独立实体
    // 不记录 roleId，不保持引用关系
}
```

**为什么不从本地文件系统复制？**
- OSS 是单一数据源，保证数据一致性
- 避免 Role 本地文件损坏/删除导致导入失败
- 避免 OSS 和本地不同步问题

---

## 分层结构

```
Handler 层                    Service 层
─────────────────────────────────────────────────────────────────
entity_handler.go            entity_storage.go
├── resolveRole()             ├── 通用函数（接受 baseDir 参数）
├── resolveContainer()        │   ├── GetEntityFiles(basePath)
├── listEntityFiles()         │   ├── GetEntityFile(basePath, filename)
├── getEntityFileContent()    │   ├── SaveEntityFile(basePath, filename, content)
├── saveEntityFileContent()   │   ├── InstallSkillToWorkspace(baseDir, slug, zipData)
├── addSkillToEntity()        │   ├── RemoveSkillFromWorkspace(baseDir, slug)
├── removeSkillFromEntity()   │   ├── UpdateConfigSkills(baseDir, modifier)
├── addMCPToEntity()          │   ├── UpdateConfigMCPs(baseDir, modifier)
├── removeMCPFromEntity()     │   ├── ExtractZipToDir(zipData, destDir)
├── listInstalledSkills()     │   └── ListInstalledSkills(baseDir)
                              │
roles.go                      ├── 实体特定函数（路径计算）
├── ListRoleFiles()           │   ├── GetRoleDir(userID, roleID)
├── UploadRole()              │   ├── ContainerSecurityDir(userID, containerID)
├── DownloadRole()            │   ├── CreateRoleDir()
    └── 调用 entity_handler    │   └── CreateContainerDir()
                              │
container.go                  └── 已废弃的 Role 专用函数（保留向后兼容）
├── GetContainerFiles()           ├── GetRoleFiles() → GetEntityFiles(GetRoleDir())
├── CreateContainer()            ├── GetRoleFile() → GetEntityFile(GetRoleDir())
    └── 从 OSS 导入 Role          └── SaveRoleFile() → SaveEntityFile(GetRoleDir())
```

---

## 设计原则

### 1. Handler 层

- `entity_handler.go`：通用实现（私有函数，接受 `entityResolver` 回调）
- `roles.go`：Role 特有逻辑（上传/下载 OSS、marketplace）
- `container.go`：Container 特有逻辑（从 OSS 导入 Role）

### 2. Service 层

- `entity_storage.go`：通用文件操作函数（接受 `baseDir` 参数）
- `ExtractZipToDir`：解压 ZIP 包到目标目录（用于从 OSS 导入）

### 3. 语义保持

- 路由层不变（`/api/roles/:id/files` 和 `//api/containers/:id/files`）
- Handler 层各自入口（`ListRoleFiles` vs `GetContainerFiles`）
- 内部实现复用 entity 层

---

## 后续扩展

当 Role 或 Container 需要各自特有的逻辑时：

```go
// roles.go - Role 特有逻辑（上传到 OSS）
func UploadRole(c *gin.Context) {
    // 验证所有权
    // 接收文件
    // 上传到 OSS: roles/{userID}/{roleID}/package.zip
}

// container.go - Container 特有逻辑（从 OSS 导入）
func CreateContainer(c *gin.Context) {
    // 如果指定 roleId
    // 从 OSS 下载: roles/{role.UserID}/{roleID}/package.zip
    // 解压到 Container workspace
    // 导入后无关联
}
```

---

## Role 文件上传策略

### 上传白名单（只上传这些文件）
```
config.json           # picoclaw 配置（脱敏后上传）
.security.yml         # 敏感配置（token/api_key 替换为占位符）
workspace/AGENT.md    # Agent 定义
workspace/SOUL.md     # 人格定义
workspace/USER.md     # 用户信息
workspace/skills/      # 已安装技能（递归上传）
```

### 上传黑名单（运行时文件，不上传）
```
logs/                 # 运行时日志
workspace/memory/     # 运行时记忆（用户私有数据）
workspace/sessions/   # 运行时会话
workspace/state/      # 运行时状态
workspace/cron/       # 运行时任务
workspace/heartbeat.log  # 心跳日志
workspace/HEARTBEAT.md   # 心跳文件
```

### 敏感信息处理
```yaml
# 原始 .security.yml
channel_list:
    pico:
        settings:
            token: d96a4f75c00bfd229290b5bcd8fc08b2
model_list:
    tx/glm-5:0:
        api_keys:
            - sk-xxxxxxxx

# 上传时替换为占位符
channel_list:
    pico:
        settings:
            token: ${PICO_TOKEN}
model_list:
    tx/glm-5:0:
        api_keys:
            - ${API_KEY}
```

### 同步状态

| 状态 | modifiedAt | uploadedAt | 视觉 | 说明 |
|------|------------|------------|------|------|
| 未上传 | null | null | 灰色时钟图标 | 从未上传到 OSS |
| 已同步 | 有值 | 有值 | 绿色勾图标 | OSS 与本地同步 |
| 有新改动 | 有值 | 有值 | 黄色警告图标 | modified > uploaded，提示用户上传 |

### 数据库字段
```go
type Role struct {
    // ...
    ModifiedAt *time.Time `json:"modifiedAt"`  // 本地修改时间
    UploadedAt *time.Time `json:"uploadedAt"`  // OSS 上传时间
}
```

### 用户操作流程
```
编辑文件 → 自动保存本地 → modifiedAt 更新 → 显示"有新改动"
    ↓
用户点击"上传到 OSS" → 打包过滤+脱敏 → 上传 OSS → uploadedAt 更新 → 显示"已同步"
```
