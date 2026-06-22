<!-- docs/project-convention/academic-curriculum-plan-homepage.md -->

# Academic Curriculum Plan Homepage

本文件记录当前 `My 计划首页` 的稳定前端边界。

后端 schema 真相以 [../backend/README.md](../backend/README.md) 指向的来源为准；本文只记录
前端需要遵守的调用、权限提示与 upstream 会话边界。

## 分层

- page owner：`src/pages/my-curriculum-plan-homepage`
- feature owner：`src/features/academic-curriculum-plan-homepage`
- API client 归 feature infrastructure，统一通过 `executeGraphQL()` 调用本站后端
- upstream 会话统一从 `@/entities/upstream-session` 消费，不在页面内自建 token 存储或登录
  mutation
- 学期列表统一从 `@/entities/academic-semester` 消费

## GraphQL 契约

当前后端权限收敛没有引入 GraphQL schema、input、output 或字段结构变化。前端现有调用方式
不需要调整。

`previewAcademicCurriculumPlanHomepagePrefill` 仍是原 query：

- query 名称不变
- 入参不变
- 返回结构不变
- 管理视角继续传现有 `context.staffId`、学年、学期、课程与教学班上下文
- 不新增 `departmentId`、`teachingGroupId` 或其它前端权限参数

本人入口 `previewMyAcademicCurriculumPlanHomepagePrefill` 不接入 teaching-group ownership，继续保留
staff 自助语义。

## 视角与权限

本页面遵循 [identity-access-session.md](./identity-access-session.md) 的通用自助 / 管理视角口径。

- `STAFF` 默认走本人自助视角
- 当前管理视角允许 `ADMIN`、`STAFF + ACADEMIC_OFFICER`、`STAFF + TEACHING_GROUP_LEADER`
- `STAFF + CLASS_ADVISER`、`STAFF + COUNSELOR`、`STAFF + STUDENT_AFFAIRS_OFFICER`
  当前没有本页面管理视角，仍走本人自助视角
- 自助视角调用本人 prefill / 候选接口，管理视角调用指定教师 prefill / 候选接口
- upstream 登录 staffId 锁定走 `resolveUpstreamLoginLockedUserId({ context: 'academicStaffManager' })`

管理视角只决定前端页面和 query 分流，不代表目标教师资源范围自动放开。后端已经在 P3 完成
`previewAcademicCurriculumPlanHomepagePrefill` 的入口专用 ownership preflight：

- `ADMIN` bypass ownership
- `ACADEMIC_OFFICER` 通过目标教师该学期 `staff semester profile.workloadDepartmentId`
  命中当前 active `post_academic_officer.department_id`
- `TEACHING_GROUP_LEADER` 通过目标教师该学期 `staff semester profile.teachingGroupId`
  命中当前 active `post_teaching_group_leader.teaching_group_id`
- 两条 final ownership 是显式 OR 关系，命中任一条即可继续预览
- 只有 `slotGroup` 但 active post 不存在、已失效，或目标教师学期档案 scope 不命中时，后端拒绝
- 目标教师缺少正确维护的 `workloadDepartmentId` / `teachingGroupId` 可能导致管理预览被拒绝

前端不从 `slotGroup` 反推部门或教研组范围，也不自行传递这些范围。

## Upstream 身份选择

课程计划首页候选下拉和保存仍由后端根据 `upstreamSessionToken` 判断 upstream identity：

- 普通 `STAFF` 只能使用本人 upstream 登录账号
- `ACADEMIC_OFFICER` 与 `TEACHING_GROUP_LEADER` 可使用其他教师 upstream 登录账号
- 其他身份拒绝

这是 upstream identity selection gate，不是 `ORG_DEPARTMENT` 或 `TEACHING_GROUP` resource
ownership。前端继续只传现有 upstream token 与业务上下文，不新增权限字段。

## P4 边界

后续 teacher 权限会单独按课程、教学班、排课事实设计，属于 course-derived teacher ownership。
前端不得为了兼容 future teacher 权限，把 teacher 范围塞进 `slotGroup`、URL 参数或 GraphQL input。
当前暂无需要前端配合的接口变更。
