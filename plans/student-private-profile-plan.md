<!-- plans/student-private-profile-plan.md -->

# Student Private Profile Plan

本文件记录“学生个人敏感资料”的前端接入计划与后端 P5.3 契约上下文。后端 schema 真相以
[../backend/README.md](../backend/README.md) 指向的来源为准；本文只收口前端实现时需要稳定遵守
的行为。

## 当前状态

后端 P5.3 已完成，可以开始接学生个人敏感资料的本地读取、核验和人工修正。

已确认后端能力：

- manual patch 写入与清除已落地
- `studentPrivateProfileSummary` 已返回真实的 `manualOverrideActive`、
  `upstreamChangedSinceManualPatch`、`upstreamBaselineToken`
- `compareStudentPrivateProfileFields` 已按 effective digest 核验
- refresh 后 summary / compare 的分叉问题已修复
- P5.4 可保留为更宽的集成回归和收束，不再阻塞 P5.3 前端接入

## 接口范围

当前已开放接口：

- query：`studentPrivateProfileSummary`
- mutation：`compareStudentPrivateProfileFields`
- mutation：`patchStudentPrivateProfileFields`
- mutation：`refreshStudentPrivateProfileFromUpstream`

`refreshStudentPrivateProfileFromUpstream` 仍是显式 upstream 刷新入口。它不是本地资料读取接口，
也不会返回身份证、银行卡、手机号、地址、照片 base64 等完整敏感明文。

当前不要设计以下能力：

- 敏感明文详情查看
- 照片读取
- summary 之外的本地完整资料读取
- 批量刷新
- 前端保存 compare 候选原文

## 分层建议

第一版如需试接，优先放在新的 feature 或 lab 中，功能边界为：

1. 选择本地学生
2. 使用现有 `@/entities/upstream-session` 管理的 upstream session
3. 读取 `studentPrivateProfileSummary`
4. 显式刷新 upstream
5. 核验候选值
6. 对允许字段执行人工修正 `SET` / `CLEAR`
7. 展示摘要结果、脱敏值、warnings 与复核提示

不要在第一版加入详情查看、照片查看或人工修正之外的编辑流程。

## 页面数据流

页面主数据源使用 `studentPrivateProfileSummary`。

固定流程：

- 页面加载或学生切换后，读取 summary
- 显式 refresh 成功后，重新拉 summary
- manual patch 成功后，可直接使用 mutation 返回的 summary 字段刷新页面，也可重新拉 summary
- compare 只用于核验候选值，不在前端保存候选原文

summary 字段语义：

- `maskedValue` 是脱敏摘要，不是完整值
- `upstreamBaselineToken` 是 opaque token，只用于 patch `SET` 时回传
- 前端不要解析、比较或持久化解释 `upstreamBaselineToken`
- `manualOverrideActive = true` 表示当前字段展示值来自人工修正
- `upstreamChangedSinceManualPatch = true` 表示人工修正后 upstream 对应字段又变化过，UI 可提示需要复核

## Upstream Session

需要 upstream token 的动作统一复用 `@/entities/upstream-session` 的公开 API。

固定规则：

- `studentId` 必须传本地 `member_student.id`，不要传 upstream technical student id
- `upstreamSessionToken` 使用现有 upstream session 管理的 token
- 如果响应返回新的 `upstreamSessionToken` / `expiresAt`，按现有 upstream session 规则覆盖本地旧 token
- CLASS_ADVISER / COUNSELOR 第一版只能使用本人 upstream identity
- ADMIN / ACADEMIC_OFFICER 可使用其他 staff 的 upstream identity
- TEACHING_GROUP_LEADER 不因该身份获得本接口代用他人 upstream identity 的能力

## Refresh

显式刷新 mutation：

```graphql
mutation RefreshStudentPrivateProfileFromUpstream(
  $input: RefreshStudentPrivateProfileFromUpstreamInput!
) {
  refreshStudentPrivateProfileFromUpstream(input: $input) {
    success
    studentId
    snapshotUpdated
    sourceObservedAt
    lastSyncedAt
    changedSections
    warnings {
      code
      fieldPath
      message
    }
    photoPresent
    photoByteSize
    upstreamSessionToken
    expiresAt
    traceId
  }
}
```

输入：

```graphql
input RefreshStudentPrivateProfileFromUpstreamInput {
  studentId: String!
  upstreamSessionToken: String!
}
```

refresh 与 manual patch 的关系：

- refresh 不会清除已有 manual patch
- refresh 后 summary 和 compare 都按同一个 effective value 判断
- 前端不需要在 refresh 后主动清本地人工修正状态，只需要重新拉 summary

## Manual Patch

人工修正 mutation：

```graphql
mutation PatchStudentPrivateProfileFields($input: PatchStudentPrivateProfileFieldsInput!) {
  patchStudentPrivateProfileFields(input: $input) {
    studentId
    lastManualUpdatedAt
    fields {
      fieldKey
      maskedValue
      valueStatus
      source
      manualOverrideActive
      upstreamChangedSinceManualPatch
      upstreamBaselineToken
    }
  }
}
```

支持动作：

- `SET`
- `CLEAR`

固定规则：

- 前端先调用 `studentPrivateProfileSummary`，从目标字段拿 `upstreamBaselineToken`
- `SET` 必须带 `value` 与 `upstreamBaselineToken`
- `CLEAR` 不需要 `value` / `upstreamBaselineToken`
- `SET` 的 `value` 不能为空
- 同一个请求最多 7 个字段
- 同一个请求内字段不能重复
- 任一字段无权、输入非法、baseline 冲突时，整个请求失败，不会部分成功
- `SET` 值如果和当前 upstream 值一致，后端会等同于 `CLEAR`，不保留人工覆盖
- 成功后直接使用返回的 summary 刷新页面，不需要立刻再查一次 summary

支持字段：

- `ID_CARD`
- `BANK_CARD_NUMBER`
- `CARD_NUMBER`
- `STUDENT_PHONE`
- `CONTACT_PERSON_PHONE`
- `HOME_ADDRESS`
- `MAILING_ADDRESS`

字段写权限：

- `ID_CARD` / `BANK_CARD_NUMBER` / `CARD_NUMBER`：仅 `ADMIN`、`ACADEMIC_OFFICER` 可修正
- 手机号和地址字段：P4 本地学生授权角色可修正

baseline token 过期或不匹配时：

- `extensions.code = CONFLICT`
- `extensions.errorCode = STUDENT_PRIVATE_PROFILE_MANUAL_PATCH_BASELINE_CONFLICT`
- 前端应重新拉取 `studentPrivateProfileSummary` 后让用户确认再编辑

## Compare

`compareStudentPrivateProfileFields` 只用于核验候选值，不保存候选原文。

支持字段：

- `ID_CARD`
- `BANK_CARD_NUMBER`
- `CARD_NUMBER`
- `STUDENT_PHONE`
- `CONTACT_PERSON_PHONE`

地址字段不支持 compare。

返回值：

- `MATCH`
- `MISMATCH`
- `MISSING`

语义：

- `MISSING` 表示后端当前 effective digest 缺失，不表示候选输入缺失
- 有 manual patch 时，compare 对比人工修正后的 effective value
- 没有 manual patch 时，compare 对比 upstream value

## 权限和错误

后端入口粗准入允许：

- `ADMIN`
- `ACADEMIC_OFFICER`
- `CLASS_ADVISER`
- `COUNSELOR`

最终是否允许由后端按目标学生当前班级 / 系部和 upstream identity gate 判断。

错误处理沿用现有 GraphQL 入口错误模型：

- 会话失效看 `extensions.code === 'UNAUTHENTICATED'`
- 权限失败是 `FORBIDDEN`
- 细分业务码只用于提示和排查，不应替代入口错误分类
- baseline 冲突按 `CONFLICT` 与
  `STUDENT_PRIVATE_PROFILE_MANUAL_PATCH_BASELINE_CONFLICT` 单独提示并重新拉 summary

## 第一版验收点

- 页面不展示敏感完整明文
- 页面主数据只来自 `studentPrivateProfileSummary`
- refresh 成功后重新拉 summary
- patch `SET` 使用 summary 返回的 `upstreamBaselineToken`
- patch `CLEAR` 不强制带 baseline token
- patch 成功后页面状态来自 mutation 返回结果或重新拉取 summary
- compare 输入只用于一次性核验，不写入本地状态、缓存或日志
- upstream session rolling token 按现有实体规则更新
- baseline 冲突能提示重新拉取后再确认
