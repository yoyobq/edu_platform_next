# Welcome Profile Completion Follow-up

本文件只保留 `/welcome` 资料补全主线已落地后的后续事项。

当前稳定口径见：

- [docs/project-convention/identity-access-session.md](/var/www/platform_next/docs/project-convention/identity-access-session.md)

## 当前真相

当前项目里，`/welcome` 主线已经落地：

- `/welcome` 已是登录后资料补全入口
- 路由分流已按 `needsProfileCompletion` 收敛
- `REGISTRANT` 已作为前端当前会话里的过渡态承接
- `GUEST` 不会因 `identity = null` 被错误推入 `/welcome`
- `ADMIN + identityHint = STAFF | STUDENT + needsProfileCompletion = true` 会进入 `/welcome`
- `/welcome` 提交成功后，前端按 `refresh -> me` 重建当前会话快照
- 提交失败、刷新失败、刷新后仍待补全的异常路径已收口
- 对应 E2E 已覆盖路由分流、回环解开、提交成功、提交失败与异常分支

这意味着：

- 本文件不再负责描述当前 `/welcome` 的正式规则
- 当前规则以 `docs/project-convention/identity-access-session.md` 为准

## Follow-up

### 1. 资料表单能力的后续复用边界

当前 `/welcome` 已消费 `features/profile-completion` 的最小资料表单能力。

后续若 invite 激活或未来 `/register` 需要复用：

- 只复用字段 contract、表单 schema、mapper 和表单 UI 能力
- 不复用 `/welcome` 的路由分流、成功跳转与登录后会话语义
- 不把 `/welcome` 的页面状态机抬成通用 public/authenticated 混合状态机

### 2. 若出现多阶段 onboarding，不继续复用 `needsProfileCompletion`

当前 `needsProfileCompletion` 只表达“是否需要首次最小资料补全”。

若未来出现多阶段 onboarding：

- 不继续把更多状态塞进 `needsProfileCompletion`
- 应新增更明确的阶段字段，例如 `profileCompletionStatus`
- `/welcome` 仍只处理首次最小补全，不自动扩成长期 onboarding 容器

### 3. 账户中心与首次补全继续分开

当前 `/welcome` 只处理首次最小资料补全。

后续仍应保持：

- 登录后长期资料编辑不回流到 `/welcome`
- 头像修改、安全设置、长期资料维护继续留给未来账户中心
- 不把账户中心页面和 `/welcome` 合并成同一个 page owner

### 4. 新身份类型或新补全契约出现时，再回头评估

当前完成态仍固定为：

- `me.identity` 存在
- 且为 `StaffType` 或 `StudentType`

若后端后续新增新的正式身份类型，或改变 `completeMyProfile` 契约：

- 再单独评估 `/welcome` 的完成态定义
- 不让前端根据旧的 `identityHint` 或 `accessGroup` 规则自行猜测新身份的完成条件

## 一句话结论

`/welcome` 主线当前已完成；后续只继续跟踪资料表单复用边界、多阶段 onboarding、账户中心分层，以及未来身份契约变化带来的补充动作。
