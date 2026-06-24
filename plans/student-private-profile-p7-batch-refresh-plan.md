<!-- plans/student-private-profile-p7-batch-refresh-plan.md -->

# Student Private Profile P7 Batch Refresh Plan

本文记录学生个人敏感资料 P7 “受控小批量刷新”的前端接入计划与当前交接状态。后端契约真相以
`/var/www/backend_next` 的 schema 与 resolver 为准；本文只收口 `labs/student-private-profile`
后续实现需要遵守的前端决策。

## 当前状态

后端已开放 `refreshStudentPrivateProfilesFromUpstream` mutation。它是学生个人敏感资料同一业务能力
下的受控小批量 upstream refresh，不是新业务域，也不是批量资料视图。

前端当前基线：

- `/labs/student-private-profile` 已承载单学生 summary、compare、manual patch、photo、family、
  education、record、单学生 refresh 等 P5/P6/P6.5 能力。
- P7 应继续放在现有 lab 内，不新增页面、不新增导航入口。
- P7 前端接入已在现有 lab 内完成，保留为 lab 能力验证入口。

已完成的代码改动：

- `src/labs/student-private-profile/api.ts`
  - 添加 batch result 类型、mutation、`normalizeBatchRefreshStudentIds`、
    `normalizeBatchRefreshInput`、`refreshStudentPrivateProfilesFromUpstream`。
- `src/labs/student-private-profile/api.spec.ts`
  - 添加 batch normalizer 与 upstream-session GraphQL 调用测试。
- `src/labs/student-private-profile/page.tsx`
  - 添加 batch 相关 import、state、pending action、session runner、结果表 columns。
  - 页面已拆为“单学生工作台”和“受控小批量刷新”Tabs。

## 后端 Contract

GraphQL mutation：

```graphql
mutation StudentPrivateProfileLabBatchRefresh(
  $input: RefreshStudentPrivateProfilesFromUpstreamInput!
) {
  refreshStudentPrivateProfilesFromUpstream(input: $input) {
    success
    requestedCount
    successCount
    failureCount
    upstreamSessionToken
    expiresAt
    traceId
    results {
      studentId
      status
      snapshotUpdated
      changedSections
      warningCodes
      errorCode
      errorMessage
    }
  }
}
```

输入规则：

- `studentIds` 必填，trim 后 1 到 20 个。
- 每个 `studentId` trim 后非空，最大 32 字符。
- trim 后不能重复；前端应 dedupe 并保留首次出现顺序。
- `studentId` 必须是本地 `member_student.id`，不是 upstream technical student id。
- `upstreamSessionToken` 必填，trim 后非空，最大 4096 字符。
- 不提交 `classId`，不做“一键整班刷新”。

返回语义：

- `results` 按输入 `studentIds` 顺序返回。
- `success=false` 表示至少一个学生失败，不等于整批请求失败。
- 支持部分成功；成功学生不会因为后续失败回滚。
- 成功项刷新主 snapshot、photo metadata、family、education、record section。
- 失败项只返回脱敏 `errorCode` / `errorMessage`，不返回 summary 或明细。
- top-level `upstreamSessionToken` 是批量结束后可继续使用的当前 token。
- top-level `expiresAt=null` 只表示本次没有发生被动刷新，不代表 token 不可用。

## 前端实现决策

页面结构：

- 保留现有 `/labs/student-private-profile` 路由。
- 使用 Tabs 拆为：
  - `单学生工作台`：现有 summary / compare / patch / photo / family / education / record /
    单学生 refresh。
  - `受控小批量刷新`：学生选择、执行按钮、批量结果表。
- 小批量 Tab 不展示 summary 明细，不做失败重试、进度、取消、后台任务或审计表。

输入来源：

- 复用现有班级列表和班级学生 options。
- 批量 Tab 提供学生多选，最多 20 个。
- 保留手动输入/粘贴本地 studentId 入口。
- 多选与粘贴两路输入合并后统一 trim、去空、dedupe、校验数量。
- 切换班级时清空多选学生；手动粘贴内容保留。

Session 处理：

- 请求走 `executeUpstreamSessionGraphQL`，和单学生 refresh / photo 一致。
- 点击批量刷新前必须有 upstream session；没有则打开现有 `UpstreamLoginModal`。
- pending action 保存当次 normalize 后的 `studentIds` 快照。
- 登录成功后继续执行同一批，不重新读取当前 UI 输入。
- 成功返回后用 top-level `upstreamSessionToken` / `expiresAt` 更新 rolling session。
- 只用 top-level GraphQL error 的 `extensions.code` 做 auth/session 分支。
- `results[].errorCode` 只能展示和排查，不能驱动登录态、logout 或 session refresh。

结果展示：

- 结果表按后端 `results` 顺序展示。
- 表列包括：
  - `studentId`
  - 本地学生姓名/班级，来自当前学生 options map；找不到时显示“未在当前班级列表”
  - `status`
  - `snapshotUpdated`
  - `changedSections`
  - `warningCodes`
  - `errorCode`
  - `errorMessage`
- 顶部展示 `success`、`requestedCount`、`successCount`、`failureCount`、`traceId`。

与单学生工作台的关系：

- batch result 不能作为 summary、photo、family、education、record 的数据源。
- 如果当前 `summary.studentId` 命中本次 `SUCCESS` 项，显示“当前摘要可能已更新”的提示。
- 提供手动“重新读取摘要”按钮。
- 不自动替换当前 summary，避免和 compare、manual patch、photo 当前状态产生隐式联动。

## Implementation Checklist

1. `api.ts`
   - 已添加 batch 类型、mutation 字段、normalizer 错误文案和 token 4096 校验。
   - 已确认 `persistSessionFromResult` 可接受 `upstreamSessionToken: string` 与
     `expiresAt: string | null` 的 batch result shape。

2. `api.spec.ts`
   - 已跑通新增测试。
   - 已覆盖 query 中包含 `results` 字段。
   - 已覆盖 per-item `errorCode` 不触发 session helper 判断。

3. `page.tsx`
   - 已用 `Tabs` 拆出现有单学生内容。
   - 已新增“受控小批量刷新”Tab JSX。
   - 已接入多选、粘贴、预览、校验错误、执行按钮、结果 summary、结果表。
   - 已接入当前 summary 命中 batch success 后的手动重读提示。
   - 已保持切换班级只清空班级多选，手动输入保留。

4. 验证
   - 已通过 `npm run test:unit -- src/labs/student-private-profile/api.spec.ts`
   - 已通过 `npx tsc --noEmit`
   - 已通过 `npm run lint`
   - 已通过 `npm run format:check`

## Non-goals

本阶段不要实现：

- 单独新页面或新导航入口。
- `classId` 整班刷新。
- 批量资料视图。
- 批量失败重试、取消、进度订阅。
- 后台预热、worker、session 自动保活。
- batch audit 表或失败项审计。

## Acceptance Criteria

- 现有单学生工作台功能保持可用。
- 批量刷新可以对 1 到 20 个本地学生 ID 发起 P7 mutation。
- 无 upstream session 时可以登录后继续执行原始 studentIds 快照。
- top-level token 返回后 rolling session 正确更新。
- 部分失败能在结果表中展示，不被当作 GraphQL request failure。
- 当前 summary 命中 batch success 后只提示手动重读，不自动替换 summary。
- 单测、TypeScript、lint、format check 全部通过。
