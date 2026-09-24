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

## 学籍变动证据与裁定复核

名单按姓名/学号搜索，支持“缺少生效学期”和“有学籍变动”筛选；缺失生效学期的历史裁定进入
人工复核列表。表格显示裁定生效学期与校园网最近变动时间，具体处理移到学生抽屉。

抽屉展示学籍变动时间线、获取时间、来源完整性，并使用独立学籍变动刷新接口。
普通名单预读只消费后端本地快照，不逐人拉取资料。刷新响应使用原有校园网会话保存与重试流程。
新出现但尚无本地成员或裁定的学生先提交归属，再刷新证据。

类型 10/20/30/40 展示退学/休学/留级/复学，未知类型保留原码。业务变动时间按原文展示，
系统获取时间按系统时间格式展示。未获取、已查询无记录、不可用分别提示；无记录不能证明退学。

采用建议要求快照完整、最新事件无歧义、日期完整、班级一致，且日期恰好落在一个已存在的本地
学期内。留级和复学还要求校园网名单返回当前班。不能匹配时留给人工核实，不猜测学期。
建议只预填草稿，用户仍需提交核对；关闭抽屉保留草稿。历史 SUPPRESSED 裁定可以修订，
提交时同时结束旧裁定与创建新裁定，适用于只有历史裁定、没有成员记录的学生。

验证：`application/status-change-evidence.spec.ts`、既有确认策略/API 测试，及
`e2e/specs/routing/student-roster-reconciliation.spec.ts` 的搜索→刷新→采用建议→保留草稿→提交流程。

### 裁定编辑与提交反馈

- 抽屉分别展示已保存裁定、校园网依据和本次修改；刷新依据不会覆盖当前裁定或用户草稿。
- 编辑直接选择实际情况，再确认生效学期；归属结果由所选情况对应，不再要求先切换归属结果再选择原因。
  班级归属修正和校园网名单异常可对应两种结果，选项必须说明具体归属。
- 表单和校园网建议均展示对学期名单的影响。采用建议前可先看实际情况及起始学期；与当前裁定一致时无需重复采用。
- 修订不切换列表筛选，撤销恢复原裁定草稿。关闭抽屉保留本页草稿，列表标明待提交的修订。
- 抽屉底部与名单页均可进入提交确认页。确认页展示本班所有待提交裁定的修改前后及自动归属处理，明确搜索与筛选不缩小提交范围。
- 校园网无记录时，明确无法自动建议、可依据其他材料手动修订，并保留当前裁定。

验证补充：浏览器回归覆盖无记录时手工纠正转入为退学、撤销恢复、缺少学期不能提交、
筛选保持、关闭后保留草稿、提交前后影响及已一致建议不重复采用。

### 抽屉信息密度

默认查看只展示当前业务结果（如“已退学”及名单起始学期）、校园网花名册状态与学籍变动。
无学籍变动用“未查到记录”表达；查询时间作为次要信息。编辑表单在点击“修改裁定”或
采用建议后出现。删除调试明细，不向用户展示内部 key、枚举、成员/裁定 ID、原始状态字段
或推断班序号。不重复解释保存、刷新、草稿等机制。
