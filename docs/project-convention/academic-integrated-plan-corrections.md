<!-- docs/project-convention/academic-integrated-plan-corrections.md -->

# Academic Integrated Plan Corrections

本文件记录“一体化对齐”迁入 stable 后的前端边界。

## 分层

- page owner：`src/pages/integrated-plan-corrections`
- feature owner：`src/features/academic-integrated-plan-corrections`
- API client 归 feature infrastructure，统一通过 `executeGraphQL()` 调用后端
- upstream 会话统一从 `@/entities/upstream-session` 消费，不在页面内自建 token 存储
- 教师选择统一使用 `@/entities/upstream-session` 的公共教师目录 UI 与解析 helper

## 视角与权限

本功能是只读诊断页，不提交修复。

- 正式路径：`/academic-affairs/integrated-plan-corrections`
- 管理视角：`ADMIN`、`STAFF + ACADEMIC_OFFICER`、`STAFF + TEACHING_GROUP_LEADER`
- STAFF 自助视角：所有 `STAFF` 可查本人，不要求 slotGroup
- 非管理视角不传 `staffId`，调用 `listMyAcademicIntegratedPlanCorrectionSuggestions`
- 管理视角继续传 `staffId`，调用 `listAcademicIntegratedPlanCorrectionSuggestions`
- upstream 登录 staffId 锁定走 `resolveUpstreamLoginLockedUserId({ context: 'academicStaffManager' })`
- 页面不直接判断 `accessGroup` / `slotGroup` 来决定 upstream 登录范围

## UI 策略

- 教师目录 MISS 不阻塞 STAFF 自助查询；STAFF 视角的教师字段不可修改
- 教师目录填充失败只影响教师候选与提示，不影响 STAFF 自助查询；若 upstream session 已过期，仍需重新登录后继续
- 管理视角教师目录不可用时，仍允许手动输入 `staffId`
- `repairGroups` 连续异常分组只作为管理员调试辅助视图，普通 STAFF 不展示
- 勘误对齐表是主要稳定 UI；连续异常分组不作为用户主路径

## Labs 迁移

旧 `/labs/integrated-plan-corrections` 不保留重定向。迁入 stable 后不再维护 lab `access.ts` / `meta.ts`。
