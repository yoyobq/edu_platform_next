<!-- docs/project-convention/student-roster-membership-reconciliation.md -->

# Student Roster Membership Reconciliation

本文件记录“学生名单归属核对”的前端契约与权限提示口径。后端 schema 真相以
[../backend/README.md](../backend/README.md) 指向的来源为准；本文只描述前端需要稳定遵守
的行为。

## 分层

- page owner：`src/pages/student-roster-membership-reconciliation`
- feature owner：`src/features/student-roster-membership-reconciliation`
- API client 归 feature infrastructure，统一通过 `executeGraphQL()` 调用后端
- upstream 会话统一从 `@/entities/upstream-session` 消费，不在页面内自建 token 存储

## GraphQL 契约

当前 GraphQL schema、enum、DTO 与请求结构没有变化。

前端继续调用：

- `dryRunReconcileUpstreamStudentRoster`
- `commitUpstreamStudentRosterReconciliation`

当前 input 仍为：

- `upstreamSessionToken`
- `classCode`
- `confirmations`
- `endDecisions`

响应 DTO 字段不变。前端不应为本次权限语义变化新增字段、改 mutation 名称或改 input 结构。

## 权限语义

后端 resolver 的 `AuthorityGuard` 仍是入口粗准入，允许：

- `ADMIN`
- `CLASS_ADVISER`
- `COUNSELOR`
- `STUDENT_AFFAIRS_OFFICER`

但最终学生名单归属核对权限不再由 `session.slotGroups` 直接决定。`session.slotGroups` 只表示
能否进入该类接口的粗准入；非 `ADMIN` 用户最终必须命中当前 active 任职范围：

- 班主任：`post_class_adviser.class_id = org_class.id`
- 辅导员：`post_counselor.class_id = org_class.id`
- 学务：`post_student_affairs_officer.department_id = org_class.department_id`

如果 token 中存在对应 `slotGroup`，但当前 active post 不存在、已失效，或任职范围不覆盖目标
班级/系部，后端会拒绝本次 dry-run 或 commit。

## 权限不足反馈

该拒绝发生在拉取 upstream roster 之前，因此不会消耗或刷新上游名单结果。前端不需要改变请求
结构，但提示文案必须表达“当前岗位未覆盖该班级/系部”，不要退化成“未登录”或“系统错误”。

当前可识别的 GraphQL top-level error 形态是：

```json
{
  "extensions": {
    "code": "FORBIDDEN",
    "errorCode": "INSUFFICIENT_PERMISSIONS"
  }
}
```

运行时仍按 `GraphQLIngressError` 处理 top-level GraphQL errors。feature 可用
`INSUFFICIENT_PERMISSIONS` 作为本功能的细分提示依据；全局 GraphQL 基础设施不应把该错误改判
为 auth，也不应触发重新登录。
