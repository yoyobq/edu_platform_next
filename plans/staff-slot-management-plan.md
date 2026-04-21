# Staff Slot Management Plan

## 决策

- Staff slot 插/拔首版合并进 admin 用户详情页。
- 复杂治理不做成“单 staff 详情加强版”，后续单独做 Staff Slot 工作台。
- 用户详情页保留摘要、常用插/拔、跳转工作台入口。
- Staff Slot 工作台以列表和批量治理为中心；单 staff 只是筛选态，不是页面模型。
- `TEACHER`、`CLASS_CADRE` 当前不进入 admin staff slot 写链路。

## P1：用户详情轻量插/拔

- 在用户详情 staff 区块增加 Staff Slot 摘要。
- 查询 `staffCurrentSlotPosts(accountId)` 展示当前任职事实。
- 支持单条 `assignStaffSlot`。
- 支持单条 `endStaffSlot`。
- 按 slot 强制填写对应 scope：
  - `ACADEMIC_OFFICER`：`departmentId`
  - `STUDENT_AFFAIRS_OFFICER`：`departmentId`
  - `CLASS_ADVISER`：`classId`
  - `COUNSELOR`：`classId`
  - `TEACHING_GROUP_LEADER`：`teachingGroupId`
- `LEFT` staff 禁止新增 slot。
- `SUSPENDED` staff 允许新增，但提示 binding 会是 `INACTIVE`。
- 不做 reconcile UI。
- 不做批量操作。

## P2：Staff Slot 工作台

- 新增独立 Staff Slot 工作台页面。
- 工作台主对象是“任职事实行 + binding 对齐状态”。
- 支持按 staff、account、姓名、部门、slotCode、scope、employmentStatus、postStatus、bindingStatus、异常类型筛选。
- 支持批量插入、批量结束、批量 dry-run reconcile、批量执行 reconcile。
- 支持异常视图：
  - 缺 binding
  - binding 状态不符
  - `LEFT` staff 仍有未结束 binding
  - 有 binding 但无当前 post
  - 多 scope 下 binding 保留原因

## 后端前提

- P1 当前 schema 已基本支持。
- P2 不依赖前端用 `adminUsers + N 次 staffCurrentSlotPosts` 拼批量治理。
- P2 前应补后端分页聚合查询与批量 mutation。
- 建议后端补：
  - `staffSlotPosts(...)`
  - `batchAssignStaffSlot(...)`
  - `batchEndStaffSlot(...)`
  - `batchReconcileStaffSlotBindings(...)`

## 边界

- `post_*` 是任职事实源。
- `base_identity_binding` 只做登录、session、权限汇总索引。
- 插/拔操作以指定 scope 的任职事实为准。
- 拔除不是物理删除，而是把任职事实流转到 `ENDED`。
- binding 对齐、dry-run 修复、异常治理只进入工作台，不塞进用户详情页。
