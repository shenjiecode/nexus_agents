# Skills & MCP Management Features

## TL;DR

> **Quick Summary**: Implement backend persistence (PostgreSQL + OSS), wire existing Skills/MCP frontend pages to real APIs, and extend ConfigPanel with skills/mcp tabs for role configuration with auto-sync.
> 
> **Deliverables**:
> - Backend Skills CRUD API with PostgreSQL + OSS storage
> - Backend MCPs CRUD API with PostgreSQL + OSS storage
> - Skills.tsx wired to real backend API (replacing mock data)
> - Mcps.tsx wired to real backend API (replacing mock data)
> - ConfigPanel extended with Skills & MCP tabs
> - Auto-sync of skills/mcp references to role config.json
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1,2 → Task 7,8 → Task 11,12 → Task 15,16,17

---

## Context

### Original Request
User requested 7 features: (1) Skills/MCP dual-tab pages like Roles, (2) upload/delete/edit in "My" tab, (3) Skills as folders with SKILL.md, (4) MCP as JSON config, (5) Skills edit = file tree, MCP edit = JSON editor, (6) role ConfigPanel skills/mcp tabs, (7) fix missing container management menu.

### Interview Summary
**Key Discussions**:
- Frontend dual-tab UI already exists in Skills.tsx/Mcps.tsx — no new UI needed
- Backend currently returns mock data — need real database + OSS integration
- Skills format: SKILL.md main file + attachments (md/py/js/ts)
- MCP format: standard mcp-server protocol JSON
- Storage: PostgreSQL metadata + OSS files (ZIP for skills, JSON for MCPs)
- Role config: auto-sync skills/mcp references into config.json
- Container management page already exists in deploy branch

**Research Findings**:
- Skills.tsx line 74: `activeTab = 'public' | 'my'` — dual-tab already exists but uses `nexus_org` identity
- Mcps.tsx line 74: same pattern as Skills
- Roles.tsx line 68: `activeTab = 'marketplace' | 'my'` — uses `nexus_user` identity
- marketplace.go: mock skills/mcps data with `mockSkills`/`mockMCPs` arrays
- ConfigPanel.tsx line 174: `activeTab = 'agent' | 'channel'` — needs skills/mcp tabs
- OSS service already exists in `service/oss.go` for Roles marketplace

### Metis Review
**Identified Gaps** (addressed):
- Frontend dual-tab already exists → scope reframed to "wire existing UI"
- MCP picoclaw format unspecified → confirmed: standard mcp-server protocol
- Auto-sync mechanism unclear → confirmed: auto-sync on config save
- Skills/MCP storage strategy → confirmed: DB metadata + OSS files

---

## Work Objectives

### Core Objective
Implement backend persistence, OSS storage, and role configuration integration for Skills/MCP marketplace, wiring existing frontend dual-tab UI to real APIs.

### Concrete Deliverables
- `platform/backend/internal/model/skill.go` — Skill GORM model
- `platform/backend/internal/model/mcp.go` — MCP GORM model
- `platform/backend/internal/handler/skills.go` — Skills CRUD handlers
- `platform/backend/internal/handler/mcps.go` — MCPs CRUD handlers
- `platform/backend/internal/handler/skills_test.go` — TDD tests
- `platform/backend/internal/handler/mcps_test.go` — TDD tests
- Updated `Skills.tsx` wired to real API with nexus_user
- Updated `Mcps.tsx` wired to real API with nexus_user
- Updated `ConfigPanel.tsx` with skills/mcp tabs
- Updated `router.go` with skills/mcps routes

### Definition of Done
- [ ] `curl http://localhost:13207/api/skills` returns real data from database
- [ ] `curl -H "X-User-Id: {userId}" http://localhost:13207/api/skills/mine` returns user's skills
- [ ] Skills upload to OSS works via Presigned URL
- [ ] MCPs CRUD works via real API endpoints
- [ ] Frontend Skills page shows marketplace + my skills with real data
- [ ] Frontend MCPs page shows marketplace + my mcps with real data
- [ ] ConfigPanel has skills/mcp tabs that can add/remove items
- [ ] Adding skill/mcp to role updates config.json automatically
- [ ] All backend tests pass: `cd platform/backend && go test ./...`

### Must Have
- Skills CRUD API with PostgreSQL + OSS
- MCPs CRUD API with PostgreSQL + OSS
- Frontend Skills.tsx/Mcps.tsx wired to real API
- ConfigPanel skills/mcp tabs
- Auto-sync to role config.json
- TDD: tests written before implementation

### Must NOT Have (Guardrails)
- NO modifying existing Roles API behavior
- NO container config format breaking changes
- NO inline skill editor UI (upload ZIP only in V1)
- NO skill versioning
- NO marketplace curation/approval workflow
- NO bulk import/export
- NO MCP config validation at upload time
- NO changing authentication pattern (X-User-Id header)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Go gotests pattern in backend)
- **Automated tests**: TDD
- **Framework**: Go testing + gotests
- **If TDD**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend API**: Use Bash (curl) - Send requests, assert status + response fields
- **Frontend UI**: Use Playwright - Navigate, interact, assert DOM, screenshot
- **Database**: Use Bash (psql/direct query) - Verify table schema and data

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 6 parallel tasks):
├── Task 1: Skill GORM model + auto-migration [quick]
├── Task 2: MCP GORM model + auto-migration [quick]
├── Task 3: Frontend types update (Skill/MCP with userId) [quick]
├── Task 4: Skills handler TDD RED (failing tests) [quick]
├── Task 5: MCPs handler TDD RED (failing tests) [quick]
└── Task 6: Router update (add skill/mcp route stubs) [quick]

Wave 2 (Backend Implementation - 4 parallel tasks):
├── Task 7: Skills CRUD handlers GREEN (make tests pass) [unspecified-high]
├── Task 8: MCPs CRUD handlers GREEN (make tests pass) [unspecified-high]
├── Task 9: Skills OSS upload/download integration [unspecified-high]
└── Task 10: MCPs OSS upload/download integration [unspecified-high]

Wave 3 (Frontend Integration - 4 parallel tasks):
├── Task 11: Skills.tsx wire to real API + nexus_user [visual-engineering]
├── Task 12: Mcps.tsx wire to real API + nexus_user [visual-engineering]
├── Task 13: Skills edit modal (file tree viewer) [visual-engineering]
└── Task 14: MCPs edit modal (JSON editor) [visual-engineering]

Wave 4 (ConfigPanel Extension - 3 parallel tasks):
├── Task 15: ConfigPanel Skills tab UI [visual-engineering]
├── Task 16: ConfigPanel MCP tab UI [visual-engineering]
└── Task 17: Backend auto-sync skills/mcp to role config.json [deep]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high + playwright)
└── Task F4: Scope fidelity check (deep)
→ Get user okay →

Wave E2E (After user okay — sequential deploy pipeline):
├── Task E1: 本地服务启动验证 (unspecified-high)
├── Task E2: 本地 Playwright E2E 测试 (unspecified-high + playwright)
├── Task E3: Deploy 分支提交触发 GitHub Workflow (unspecified-high)
├── Task E4: 线上 Playwright E2E 测试 (unspecified-high + playwright)
└── Task E5: 线上日志/数据验证 (unspecified-high)

Critical Path: Task 1,2 → Task 7,8 → Task 11,12 → Task 15,16,17 → F1-F4 → user okay → E1→E2→E3→E4→E5
Parallel Speedup: ~65% faster than sequential (implementation waves)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | - | 4, 7 |
| 2 | - | 5, 8 |
| 3 | - | 11, 12, 13, 14 |
| 4 | 1 | 7 |
| 5 | 2 | 8 |
| 6 | - | 7, 8, 9, 10 |
| 7 | 4, 6 | 9, 11 |
| 8 | 5, 6 | 10, 12 |
| 9 | 7 | 11, 13, 15 |
| 10 | 8 | 12, 14, 16 |
| 11 | 3, 7, 9 | 15 |
| 12 | 3, 8, 10 | 16 |
| 13 | 3, 9 | 15 |
| 14 | 3, 10 | 16 |
| 15 | 11, 13 | 17 |
| 16 | 12, 14 | 17 |
| 17 | 15, 16 | F1-F4 |
| E1 | F1-F4 user okay | E2 |
| E2 | E1 | E3 |
| E3 | E2 | E4 |
| E4 | E3 | E5 |
| E5 | E4 | - |

### Agent Dispatch Summary

- **Wave 1**: **6** - T1,T2,T3 → `quick`, T4,T5,T6 → `quick`
- **Wave 2**: **4** - T7,T8,T9,T10 → `unspecified-high`
- **Wave 3**: **4** - T11,T12,T13,T14 → `visual-engineering`
- **Wave 4**: **3** - T15,T16 → `visual-engineering`, T17 → `deep`
- **FINAL**: **4** - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`
- **E2E**: **5** (sequential) - E1,E2,E3,E4,E5 → `unspecified-high` + `playwright` (E2,E4)

**服务器连接**: `ssh root@8.217.143.228` 用于 E5 日志验证
---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> FORMAT: Task labels use bare numbers: 1. 2. 3. — NOT T1. Task 1. Phase 1:

#WX|- [x] 1. Skill GORM model + auto-migration

  **What to do**:
  - Create `model/skill.go` with Skill struct (ID, UserId, Name, Slug, Description, Category, StorageKey, Size, IsPublic, CreatedAt, UpdatedAt)
  - Follow `model/role.go` pattern (UUID, BeforeCreate hook)
  - Add auto-migration in `cmd/server/main.go`
  - Write TDD test `model/skill_test.go`

  **Must NOT do**: Don't modify existing Role model

  **Recommended Agent Profile**: Category: `quick`, Skills: []

  **Parallelization**: Wave 1 parallel, blocks Task 4, 7, blocked by: none

  **References**:
  - `platform/backend/internal/model/role.go` — Follow this exact pattern

  **Acceptance Criteria**:
  - [ ] model/skill.go created with Skill struct
  - [ ] go test ./internal/model/... -run TestSkill → PASS

  **QA Scenarios**:
  ```
  Scenario: Skill model can be created and saved
    Tool: Bash (go test)
    Steps: cd platform/backend && go test ./internal/model/... -run TestSkill -v
    Expected Result: Test passes
    Evidence: .omo/evidence/task-01-skill-model-test.txt
  ```

  **Commit**: YES - Message: `feat(models): add skill model with auto-migration`

#MP|- [x] 2. MCP GORM model + auto-migration

  **What to do**:
  - Create `model/mcp.go` with MCP struct (same fields as Skill)
  - Follow exact same pattern as Task 1
  - Write TDD test `model/mcp_test.go`

  **Recommended Agent Profile**: Category: `quick`, Skills: []

  **Parallelization**: Wave 1 parallel, blocks Task 5, 8, blocked by: none

  **Acceptance Criteria**:
  - [ ] model/mcp.go created
  - [ ] go test ./internal/model/... -run TestMcp → PASS

  **QA Scenarios**:
  ```
  Scenario: MCP model can be created and saved
    Tool: Bash (go test)
    Steps: cd platform/backend && go test ./internal/model/... -run TestMcp -v
    Expected Result: Test passes
    Evidence: .omo/evidence/task-02-mcp-model-test.txt
  ```

  **Commit**: YES - Message: `feat(models): add mcp model with auto-migration`

#NK|- [x] 3. Frontend types update for Skill/MCP

  **What to do**:
  - Update `types/index.ts`: add userId, storageKey, size, isPublic to Skill and Mcp interfaces

  **Must NOT do**: Don't remove existing fields, don't change Role/User types

  **Recommended Agent Profile**: Category: `quick`, Skills: []

  **Parallelization**: Wave 1 parallel, blocks Task 11, 12, 13, 14, blocked by: none

  **References**:
  - `platform/frontend/src/types/index.ts:16-31` — Current Skill/Mcp interfaces

  **Acceptance Criteria**:
  - [ ] Skill interface has userId, storageKey, size, isPublic
  - [ ] Mcp interface has userId, storageKey, size, isPublic
  - [ ] pnpm build → PASS

  **QA Scenarios**:
  ```
  Scenario: TypeScript types compile without errors
    Tool: Bash
    Steps: cd platform/frontend && pnpm build
    Expected Result: Build succeeds
    Evidence: .omo/evidence/task-03-types-build.txt
  ```

  **Commit**: YES - Message: `feat(types): add userId and storageKey to Skill/MCP frontend types`

#WJ|- [x] 4. Skills handler TDD RED (failing tests)

  **What to do**:
  - Create `handler/skills_test.go` with failing tests for: ListSkills, GetMySkills, CreateSkill, GetSkill, UpdateSkill, DeleteSkill
  - Tests MUST fail at this stage (RED phase)

  **Must NOT do**: Don't implement handler logic yet

  **Recommended Agent Profile**: Category: `quick`, Skills: []

  **Parallelization**: Wave 1 parallel, blocks Task 7, blocked by: Task 1

  **References**:
  - `platform/backend/internal/handler/roles_test.go` — Follow test structure

  **Acceptance Criteria**:
  - [ ] handler/skills_test.go created with all CRUD tests
  - [ ] go test -run TestSkill → FAIL (expected, RED phase)

  **Commit**: YES - Message: `test(handlers): add skills handler TDD red tests`

#JT|- [x] 5. MCPs handler TDD RED (failing tests)

  **What to do**: Same as Task 4 but for MCPs CRUD tests

  **Recommended Agent Profile**: Category: `quick`, Skills: []

  **Parallelization**: Wave 1 parallel, blocks Task 8, blocked by: Task 2

  **Acceptance Criteria**:
  - [ ] handler/mcps_test.go created
  - [ ] go test -run TestMcp → FAIL (RED phase)

  **Commit**: YES - Message: `test(handlers): add mcps handler TDD red tests`

#WZ|- [x] 6. Router update with Skills/MCPs route stubs

  **What to do**:
  - Update `router/router.go`: add skill/mcp routes following Roles pattern
  - Stubs return 501 Not Implemented initially

  **Recommended Agent Profile**: Category: `quick`, Skills: []

  **Parallelization**: Wave 1 parallel, blocks Task 7, 8, blocked by: none

  **References**:
  - `platform/backend/internal/router/router.go:140-180` — Roles route pattern

  **Acceptance Criteria**:
  - [ ] Routes added: /api/skills (GET, POST), /api/skills/mine, /api/skills/:id (GET, PUT, DELETE)
  - [ ] Same pattern for /api/mcps

  **Commit**: YES - Message: `feat(router): add skills/mcps route stubs`

#ZH|- [x] 7. Skills CRUD handlers GREEN (make tests pass)

  **What to do**:
  - Implement `handler/skills.go` with all CRUD handlers
  - Use GORM for database operations
  - Make all tests from Task 4 pass (GREEN phase)

  **Must NOT do**: Don't break existing handlers

  **Recommended Agent Profile**: Category: `unspecified-high`, Skills: []

  **Parallelization**: Wave 2 parallel, blocks Task 9, 11, blocked by: Task 4, 6

  **References**:
  - `platform/backend/internal/handler/roles.go` — Follow handler pattern
  - `platform/backend/internal/handler/skills_test.go` — Make these tests pass

  **Acceptance Criteria**:
  - [ ] handler/skills.go implemented with CreateSkill, ListSkills, GetMySkills, GetSkill, UpdateSkill, DeleteSkill
  - [ ] go test ./internal/handler/... -run TestSkill → PASS

  **QA Scenarios**:
  ```
  Scenario: Skills CRUD works end-to-end
    Tool: Bash (curl)
    Steps:
      1. curl -X POST http://localhost:13207/api/skills -H 'Content-Type: application/json' -d '{"name":"Test","slug":"test"}' -H 'X-User-Id: user-001'
      2. curl http://localhost:13207/api/skills
      3. curl -H 'X-User-Id: user-001' http://localhost:13207/api/skills/mine
    Expected Result: All requests return success with correct data
    Evidence: .omo/evidence/task-07-skills-crud.txt
  ```

  **Commit**: YES - Message: `feat(skills): implement skills CRUD handlers with TDD`

#ZZ|- [x] 8. MCPs CRUD handlers GREEN (make tests pass)

  **What to do**: Same as Task 7 but for MCPs

  **Recommended Agent Profile**: Category: `unspecified-high`, Skills: []

  **Parallelization**: Wave 2 parallel, blocks Task 10, 12, blocked by: Task 5, 6

  **Acceptance Criteria**:
  - [ ] handler/mcps.go implemented with all CRUD handlers
  - [ ] go test ./internal/handler/... -run TestMcp → PASS

  **Commit**: YES - Message: `feat(mcps): implement mcps CRUD handlers with TDD`

#ZT|- [x] 9. Skills OSS upload/download integration

  **What to do**:
  - Add Presigned URL endpoints: POST /api/skills/:id/upload, GET /api/skills/:id/download
  - Follow existing OSS pattern from `service/oss.go`
  - Storage path: `skills/{userId}/{skillId}/package.zip`

  **Recommended Agent Profile**: Category: `unspecified-high`, Skills: []

  **Parallelization**: Wave 2 parallel, blocks Task 11, 13, blocked by: Task 7

  **References**:
  - `platform/backend/internal/service/oss.go` — Presigned URL pattern
  - `platform/backend/internal/handler/roles.go:UploadRole, DownloadRole` — Same pattern

  **Acceptance Criteria**:
  - [ ] Upload returns Presigned URL for PUT
  - [ ] Download returns Presigned URL for GET
  - [ ] OSS path follows pattern `skills/{userId}/{skillId}/package.zip`

  **Commit**: YES - Message: `feat(skills): add OSS upload/download for skills`

#NT|- [x] 10. MCPs OSS upload/download integration

  **What to do**: Same as Task 9 but for MCPs
  - Storage path: `mcps/{userId}/{mcpId}/config.json`

  **Recommended Agent Profile**: Category: `unspecified-high`, Skills: []

  **Parallelization**: Wave 2 parallel, blocks Task 12, 14, blocked by: Task 8

  **Acceptance Criteria**:
  - [ ] Upload/download endpoints work for MCPs
  - [ ] OSS path follows pattern `mcps/{userId}/{mcpId}/config.json`

  **Commit**: YES - Message: `feat(mcps): add OSS upload/download for mcps`

#QJ|- [x] 11. Skills.tsx wire to real API + nexus_user

  **What to do**:
  - Update Skills.tsx to use real API endpoints instead of mock
  - Change user identity from `nexus_org` to `nexus_user`
  - Keep existing UI structure unchanged

  **Must NOT do**: Don't change UI structure, don't remove existing functionality

  **Recommended Agent Profile**: Category: `visual-engineering`, Skills: [`frontend-design`]

  **Parallelization**: Wave 3 parallel, blocks Task 15, blocked by: Task 3, 7, 9

  **References**:
  - `platform/frontend/src/pages/Skills.tsx:74` — Change from nexus_org to nexus_user
  - `platform/frontend/src/pages/Roles.tsx` — Pattern for API integration

  **Acceptance Criteria**:
  - [ ] Skills page shows real data from database
  - [ ] Upload/delete works with real API
  - [ ] User identity from nexus_user

  **QA Scenarios**:
  ```
  Scenario: Skills page shows real data
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:13208/skills
      2. Check marketplace tab loads
      3. Click '我的' tab
    Expected Result: Both tabs show data (empty if none uploaded)
    Evidence: .omo/evidence/task-11-skills-page-real.png
  ```

  **Commit**: YES - Message: `feat(frontend): wire Skills page to real API`

#BQ|- [x] 12. Mcps.tsx wire to real API + nexus_user

  **What to do**: Same as Task 11 but for Mcps.tsx

  **Recommended Agent Profile**: Category: `visual-engineering`, Skills: [`frontend-design`]

  **Parallelization**: Wave 3 parallel, blocks Task 16, blocked by: Task 3, 8, 10

  **Acceptance Criteria**:
  - [ ] MCPs page shows real data
  - [ ] User identity from nexus_user

  **Commit**: YES - Message: `feat(frontend): wire Mcps page to real API`

#NK|- [x] 13. Skills edit modal (file tree viewer)

  **What to do**:
  - Add edit modal to Skills.tsx for viewing skill contents
  - Display file tree structure (SKILL.md + attachments)
  - Download skill ZIP from OSS

  **Recommended Agent Profile**: Category: `visual-engineering`, Skills: [`frontend-design`]

  **Parallelization**: Wave 3 parallel, blocks Task 15, blocked by: Task 3, 9

  **References**:
  - `platform/frontend/src/pages/RoleDebug.tsx:553-758` — FileEditor component pattern

  **Acceptance Criteria**:
  - [ ] Edit modal shows file tree for skill
  - [ ] Can view SKILL.md content

  **Commit**: YES - Message: `feat(frontend): add skill file tree viewer modal`

#XP|- [x] 14. MCPs edit modal (JSON editor)

  **What to do**:
  - Add edit modal to Mcps.tsx for editing MCP JSON config
  - Simple textarea for JSON editing
  - Save updates to OSS

  **Recommended Agent Profile**: Category: `visual-engineering`, Skills: [`frontend-design`]

  **Parallelization**: Wave 3 parallel, blocks Task 16, blocked by: Task 3, 10

  **Acceptance Criteria**:
  - [ ] Edit modal has JSON textarea
  - [ ] Save button updates MCP config

  **Commit**: YES - Message: `feat(frontend): add mcp JSON editor modal`

#ZS|- [x] 15. ConfigPanel Skills tab UI

  **What to do**:
  - Add Skills tab to ConfigPanel.tsx
  - Show list of available skills to add to role
  - Show list of skills already attached to role
  - Add/remove buttons

  **Recommended Agent Profile**: Category: `visual-engineering`, Skills: [`frontend-design`]

  **Parallelization**: Wave 4 parallel, blocks Task 17, blocked by: Task 11, 13

  **References**:
  - `platform/frontend/src/components/ConfigPanel.tsx:174` — Add new tab here

  **Acceptance Criteria**:
  - [ ] ConfigPanel has Skills tab alongside Agent/Channel
  - [ ] Can see available skills and attached skills
  - [ ] Can add/remove skills from role

  **QA Scenarios**:
  ```
  Scenario: Skills tab in role config works
    Tool: Playwright
    Steps:
      1. Navigate to role debug page
      2. Click '配置' tab
      3. Click 'Skills' tab button
    Expected Result: Skills tab renders with list
    Evidence: .omo/evidence/task-15-config-skills-tab.png
  ```

  **Commit**: YES - Message: `feat(config): add Skills tab to ConfigPanel`

#KV|- [x] 16. ConfigPanel MCP tab UI

  **What to do**: Same as Task 15 but for MCPs

  **Recommended Agent Profile**: Category: `visual-engineering`, Skills: [`frontend-design`]

  **Parallelization**: Wave 4 parallel, blocks Task 17, blocked by: Task 12, 14

  **Acceptance Criteria**:
  - [ ] ConfigPanel has MCP tab
  - [ ] Can add/remove MCPs from role

  **Commit**: YES - Message: `feat(config): add MCP tab to ConfigPanel`

#JM|- [x] 17. Backend auto-sync skills/mcp to role config.json

  **What to do**:
  - When skills/mcps are added/removed from role via ConfigPanel
  - Update role's config.json: mcp_servers array for MCPs
  - Update role's file structure: workflow/skills/{name}/ for skills

  **Must NOT do**: Don't modify role if skills/mcps list unchanged

  **Recommended Agent Profile**: Category: `deep`, Skills: []

  **Parallelization**: Wave 4, blocked by: Task 15, 16

  **References**:
  - `platform/frontend/src/types/index.ts:68-81` — PicoclawConfig structure

  **Acceptance Criteria**:
  - [ ] Adding MCP to role updates config.json mcp_servers array
  - [ ] Adding skill to role creates workflow/skills/{name}/ directory
  - [ ] Changes persist when container restarts

  **QA Scenarios**:
  ```
  Scenario: Auto-sync works for role config
    Tool: Bash (curl + file check)
    Steps:
      1. Add MCP to role via API
      2. Check config.json contains mcp_servers entry
    Expected Result: config.json updated with MCP reference
    Evidence: .omo/evidence/task-17-auto-sync.txt
  ```

  **Commit**: YES - Message: `feat(backend): auto-sync skills/mcp to role config.json`

---

## E2E Testing Wave (After F1-F4 user okay)

> 本地测试 → 部署 → 线上验证 完整流程

#VJ|- [x] E1. **本地服务启动验证** — `unspecified-high`
  确保本地所有服务正常运行：
  - PostgreSQL 容器运行中
  - Backend 服务运行在 13207 端口
  - Frontend 服务运行在 13208 端口
  - 验证 API 健康检查通过
  Output: `Backend [UP] | Frontend [UP] | Database [UP] | VERDICT: GO/NO-GO`

#TQ|- [x] E2. **本地 Playwright E2E 测试** — `unspecified-high` + `playwright` skill
  使用 Playwright 执行完整 E2E 测试流程：
  - 导航到 Skills 页面，验证双 Tab 显示
  - 导航到 MCPs 页面，验证双 Tab 显示
  - 测试上传/删除功能（如果有测试数据）
  - 截图保存到 `.omo/evidence/e2e-local/`
  Output: `Tests [N/N pass] | Screenshots [N saved] | VERDICT: PASS/FAIL`

  **QA Scenarios**:
  ```
  Scenario: Skills page E2E test
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:13208/skills
      2. Wait for page load
      3. Verify '技能市场' tab visible
      4. Click '我的技能' tab
      5. Verify tab switch works
      6. Take screenshot
    Expected Result: Both tabs render correctly
    Evidence: .omo/evidence/e2e-local/skills-page.png
  ```

- [ ] E3. **Deploy 分支提交触发 GitHub Workflow** — `unspecified-high`
  将所有更改合并到 deploy 分支并推送：
  - `git checkout deploy`
  - `git merge --squash <feature-branch>` (或 cherry-pick)
  - `git push origin deploy`
  - 监控 GitHub Actions workflow 执行状态
  Output: `Push [SUCCESS] | Workflow Triggered [YES] | Workflow URL`

  **服务器信息**:
  - IP: `8.217.143.228`
  - Backend 目录: `/opt/nexus/backend/`
  - Frontend 目录: `/opt/nexus/frontend/`
  - 数据目录: `/data/roles/`

- [ ] E4. **线上 Playwright E2E 测试** — `unspecified-high` + `playwright` skill
  部署完成后，测试线上地址：
  - 线上地址: `http://8.217.143.228` (或配置的域名)
  - 执行与 E2 相同的 E2E 测试流程
  - 验证 Skills/MCPs 功能在线上正常工作
  - 截图保存到 `.omo/evidence/e2e-prod/`
  Output: `Tests [N/N pass] | Screenshots [N saved] | VERDICT: PASS/FAIL`

  **QA Scenarios**:
  ```
  Scenario: Production Skills page E2E test
    Tool: Playwright
    Steps:
      1. Navigate to http://8.217.143.228/skills
      2. Wait for page load
      3. Verify page renders
      4. Test API calls return real data
      5. Take screenshot
    Expected Result: Production site works correctly
    Evidence: .omo/evidence/e2e-prod/skills-page.png
  ```

- [ ] E5. **线上日志/数据验证** — `unspecified-high`
  SSH 连接服务器检查部署状态：
  ```bash
  ssh root@8.217.143.228
  # 检查后端服务状态
  systemctl status nexus-backend
  # 查看后端日志
  journalctl -u nexus-backend -f --lines 100
  # 检查数据库
  docker exec nexus-postgres psql -U nexus -d nexus -c "SELECT * FROM skills LIMIT 5;"
  docker exec nexus-postgres psql -U nexus -d nexus -c "SELECT * FROM mcps LIMIT 5;"
  ```
  Output: `Backend [RUNNING] | Database [CONNECTED] | Tables [skills, mcps exist] | VERDICT: OK/ERROR`

---
## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

#BT|- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .omo/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

#KQ|- [x] F2. **Code Quality Review** — `unspecified-high]
  Run `go test ./...` + `go vet ./...` + linter. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

#SY|- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.omo/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

#PV|- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(models): add skill and mcp models with auto-migration` - model/skill.go, model/mcp.go
- **Wave 1**: `feat(types): add userId and storageKey to Skill/MCP frontend types` - types/index.ts
- **Wave 1**: `test(handlers): add skills/mcps handler TDD red tests` - handler/skills_test.go, handler/mcps_test.go
- **Wave 1**: `feat(router): add skills/mcps route stubs` - router/router.go
- **Wave 2**: `feat(skills): implement skills CRUD handlers with TDD` - handler/skills.go
- **Wave 2**: `feat(mcps): implement mcps CRUD handlers with TDD` - handler/mcps.go
- **Wave 2**: `feat(skills): add OSS upload/download for skills` - handler/skills.go
- **Wave 2**: `feat(mcps): add OSS upload/download for mcps` - handler/mcps.go
- **Wave 3**: `feat(frontend): wire Skills page to real API` - pages/Skills.tsx
- **Wave 3**: `feat(frontend): wire Mcps page to real API` - pages/Mcps.tsx
- **Wave 3**: `feat(frontend): add skill file tree viewer modal` - pages/Skills.tsx
- **Wave 3**: `feat(frontend): add mcp JSON editor modal` - pages/Mcps.tsx
- **Wave 4**: `feat(config): add Skills tab to ConfigPanel` - components/ConfigPanel.tsx
- **Wave 4**: `feat(config): add MCP tab to ConfigPanel` - components/ConfigPanel.tsx
- **Wave 4**: `feat(backend): auto-sync skills/mcp to role config.json` - handler/roles.go
- **E2E**: `ci: add playwright e2e tests for skills/mcps` - tests/e2e/ (可选，如果有独立测试文件)
- **E2E**: `chore: deploy to production via github workflow` - 触发自动部署

**服务器信息**:
- IP: `8.217.143.228`
- SSH: `ssh root@8.217.143.228`
- Backend 日志: `journalctl -u nexus-backend -f`
- 数据库查询: `docker exec nexus-postgres psql -U nexus -d nexus -c "SELECT * FROM skills;"`

## Success Criteria

### Verification Commands
```bash
# Backend health
curl http://localhost:13207/health  # Expected: {"status":"ok"}

# Skills API
curl http://localhost:13207/api/skills  # Expected: {"success":true,"data":[...]}
curl -H "X-User-Id: {userId}" http://localhost:13207/api/skills/mine  # Expected: user's skills

# MCPs API
curl http://localhost:13207/api/mcps  # Expected: {"success":true,"data":[...]}
curl -H "X-User-Id: {userId}" http://localhost:13207/api/mcps/mine  # Expected: user's mcps

# All tests pass
cd platform/backend && go test ./...  # Expected: PASS
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] 本地 E2E 测试通过 (Playwright)
- [ ] GitHub Workflow 部署成功
- [ ] 线上 E2E 测试通过
- [ ] 服务器日志验证通过
