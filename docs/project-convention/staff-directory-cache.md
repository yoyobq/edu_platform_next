<!-- docs/project-convention/staff-directory-cache.md -->

# Staff Directory Cache

本文件记录前端消费 `staffId -> 教师姓名` 的统一约定。后端 schema 真相以 [../backend/README.md](../backend/README.md) 指向的来源为准。

## 当前结论

常用页面不要直接调用旧的 upstream 教师列表接口，也不要各自实现 MISS / populate / token 更新状态机。

统一链路是：

1. 页面先调用 `staffDirectory` 或 `staffDirectoryEntries`
2. 若返回 `cacheStatus = MISS`，复用当前页面的 upstream 登录流程取得 `upstreamSessionToken`
3. 调用 `populateStaffDirectory({ sessionToken, forceRefresh: false })`
4. 使用 mutation 返回数据，或重新调用只读接口渲染页面

缓存由 API 进程持有，不落前端本地数据库，也不落 MySQL。API 重启或多实例部署时，不同进程可能出现各自的 `MISS`。

## 接口分工

- `staffDirectory`：读完整教师目录缓存；不需要 upstream token；不访问 upstream；适合教师下拉。
- `staffDirectoryEntries`：按最多 800 个 `staffId` 批量解析姓名；不需要 upstream token；不访问 upstream；适合列表补姓名。
- `populateStaffDirectory`：用有效 upstream session 显式填充或刷新缓存；只有它会在需要时访问 upstream。

`MISS` 不是异常。页面可以在用户触发主业务动作时顺带索取 upstream 登录，再完成 populate。

`FRESH` 和 `STALE` 都可以直接用于普通展示。`STALE` 只表示超过本地新鲜期，不等于数据错误。

## Token 规则

`populateStaffDirectory` 可能返回新的 `upstreamSessionToken` 与 `expiresAt`。

前端规则：

- 返回的新 token 非空时，用现有 `persistSessionFromResult` / upstream session helper 覆盖本地 token
- 返回为空时，保留本地已有 token
- `staffDirectory` 和 `staffDirectoryEntries` 不参与 token 更新

`fetchVerifiedStaffIdentity` 只用于确认当前 upstream 身份，不作为主动续期接口。只有当它返回的 token 与当前本地 token 不同时，才覆盖本地 upstream session。

## 页面选择

需要教师下拉的页面优先使用 `staffDirectory`；只有缓存存在时展示 `staffId + name` 组合 label，提交值仍然是 `staffId`。无缓存时要允许管理员手动输入 `staffId`，避免教师目录缓存问题阻塞业务查询。

只需要给已有业务列表补姓名的页面使用 `staffDirectoryEntries`，对 `missingStaffIds` 展示原始 `staffId` 兜底。

## 公共教师选择 UI

需要按教师筛选的页面统一使用 `src/shared/upstream` 暴露的 `StaffDirectoryTeacherAutoComplete`，不要在各页面重复实现教师 AutoComplete。

组件规则：

- 候选项展示为 `staffId name`，例如 `3664 张三`
- 选择候选项时，业务值写回 `staffId`
- 手动输入时，保留用户正在编辑的原始文本，不因为唯一候选项或匹配到 `staffId` 就自动补齐
- 输入框失焦后，如果当前值能命中教师目录，再展示为 `staffId name`
- 默认提供右侧清空按钮；确有只读或固定值场景时，由调用方显式禁用或设为不可编辑
- 候选只作为输入辅助；提交或查询前仍需用 `resolveStaffDirectoryTeacherStaffId(value, teachers)` 收敛成稳定 `staffId`
- 教师目录不可用时，管理查询仍允许手动输入 `staffId`

自助视角中，若当前登录身份已经决定教师，页面可以禁用该组件并展示当前教师，不提供切换教师或切换 upstream 账号的普通 UI。

## 当前落点

- `src/shared/upstream` 暴露 Staff Directory Cache client
- `src/shared/upstream` 暴露 `StaffDirectoryTeacherAutoComplete`、`useStaffDirectoryTeachers` 与教师输入解析 helper
- `src/features/academic-teaching-log` 的 `My 教学日志` 页面消费完整教师目录
- `src/features/academic-timetable`、`src/features/academic-integrated-plan-corrections`、`src/labs/academic-timetable`、`src/labs/academic-workload` 复用同一套教师选择 UI
