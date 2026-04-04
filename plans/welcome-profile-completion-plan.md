# Welcome Profile Completion Plan

本计划描述“登录后信息不齐时的资料补全 / welcome onboarding”当前实施口径。

它解决的问题是：

- 用户已经拿到 session 并完成登录
- 但当前账号仍缺少进入正式业务主流程所需的最小资料
- 前端需要决定如何把这类用户从登录成功平稳引导到后续站内流程

一句话结论：

- 先做登录后的 `/welcome` 信息补全流
- 不把“资料不齐”直接退避成 `GUEST`
- 不把 `/welcome`、`/invite`、未来 `/register` 混成同一条大流程
- 共享的是资料表单能力，不是整个路由状态机

## 当前状态

本计划已从讨论版更新为当前实施版。

当前分层如下：

- 后端契约：已完成
- 前端路由分流：待完成
- 前端 `/welcome` 页面：待完成
- 前端共享资料表单能力：待完成
- 前端 E2E：待完成

后端当前落地结果以 `docs/backend/welcome-pofile-completion-current.md` 为准；
本文件只保留前端实现仍需依赖的计划与边界。

## 为什么单开这条主线

当前 public auth 主线仍集中在 verification intent：

- `/invite/:inviteType/:verificationCode`
- `/verify/email/:verificationCode`
- `/magic-link/:verificationCode`

这条线继续停留在 `PublicEntryLayout`，不应与登录后流程混写。

登录后的资料补全属于 authenticated flow，不属于 public auth flow。
因此 `/welcome` 应作为 path-first 的登录后 onboarding 入口单独实现。

## 当前固定判断

本轮实现固定以下判断，不再作为待讨论项：

- “资料不齐”不等于 `GUEST`
- 前端不得因实体缺失或资料不齐自行推断 `GUEST`
- `GUEST` 只能由后端显式给出
- `GUEST` 是合法轻量会话，不默认强制补全
- `REGISTRANT` 是注册 / 首次落库后的过渡态，会被视为待补全
- 历史上的 `ADMIN only` 不再视为长期稳定完成态
- 登录后的资料补全属于 authenticated flow，不属于 public auth flow
- `/welcome` 适合作为 path-first 的登录后 onboarding 入口
- 未来 invite / register 可以复用资料表单能力，但不复用 `/welcome` 的页面语义

这意味着：

- `/welcome` 的前置条件是“已登录且仍需补全”
- `/invite` 仍负责邀请 token 校验、激活和必要的首次设置动作
- 若未来开放 `/register`，它也应作为独立 public entry，而不是退化成 `/welcome` 的匿名版

## 当前范围

本轮优先推进：

1. 收束“已登录但需补全”的前端状态与路由分流
2. 落一个最小可运行的 `/welcome` 页面
3. 抽出可被 `/welcome`、invite 激活、未来 `/register` 复用的资料表单能力
4. 为登录后资料补全补基础 E2E

本轮不做：

- 开放公开注册 `/register`
- 把待补全语义重新塞回 `GUEST`
- 把 invite 激活完全迁移到登录后流程
- 账户中心完整资料编辑
- 首次补全之外的长期 onboarding 编排

## 当前已确认契约

### 1. 触发条件契约

前端不能自行根据“字段为空”推断用户必须去 `/welcome`。

当前后端稳定字段为：

- `me.needsProfileCompletion: Boolean!`

本轮前端只认这一项作为稳定触发条件。

当前约束：

- `true`：已登录，但必须进入 `/welcome`
- `false`：不应因为资料字段局部缺失而被前端强制带去 `/welcome`
- 前端不得再用“昵称为空”“identity 为空”之类实现细节补推断
- 该字段表达的是“是否需要首次资料补全”，不是身份类型，也不是授权输入

按当前会话语义：

- `GUEST`：`needsProfileCompletion = false`
- `REGISTRANT`：`needsProfileCompletion = true`
- `ADMIN` 且 `identityHint = STAFF | STUDENT`、当前还没有正式身份实体：`needsProfileCompletion = true`
- 已收敛为 `StaffType` 或 `StudentType`：`needsProfileCompletion = false`

若未来确实出现多阶段 onboarding，再单独新增 `profileCompletionStatus` 一类字段；那不是当前这一轮的范围。

### 2. 最小资料字段契约

本轮只收敛“进入正式身份主流程真正必需的最小字段”。

当前完成态标准固定为：

- `me.identity` 必须存在
- 且 `me.identity` 必须是 `StaffType` 或 `StudentType`

也就是说：

- 有 `StaffType`：视为已满足最小资料契约
- 有 `StudentType`：视为已满足最小资料契约
- 两者都没有：不应被视为正式身份已完成

前端不允许用以下信号替代这条判断：

- `accessGroup` 里含 `ADMIN`
- `accessGroup` 里含 `STAFF`
- `accessGroup` 里含 `STUDENT`
- `identityHint = STAFF | STUDENT`
- 昵称、展示名或其他资料字段“看起来像是完整了”

### 3. `GUEST` / `REGISTRANT` / 历史 `ADMIN` 的前端消费边界

当前前端需要显式接受这几类不同会话语义：

- `GUEST`：合法轻量会话，不因为 `identity = null` 就自动进入 `/welcome`
- `REGISTRANT`：注册过渡态，会因为 `needsProfileCompletion = true` 被带入 `/welcome`
- 历史待归一化 `ADMIN`：若 `identityHint = STAFF | STUDENT` 且还没有正式身份实体，也会因为 `needsProfileCompletion = true` 被带入 `/welcome`

前端消费约束固定为：

- 路由分流只认 `needsProfileCompletion`
- 会话展示与调试信息可以承接 `REGISTRANT`
- 前端 auth model 需要正式承接 `REGISTRANT`
- 但前端不得根据 `accessGroup = REGISTRANT` 自己重新发明一套平行的补全判定
- 前端不得根据 `identityHint` 直接把用户放进完整 `STAFF` 或 `STUDENT` 流程

### 4. 当前补全写入契约

当前登录后资料补全入口已经存在：

- `completeMyProfile`

当前输入：

- `name: String!`
- `targetIdentity: STAFF | STUDENT`
- `nickname?: String`
- `phone?: String`
- `departmentId?: String`

当前返回：

- `success: Boolean!`

前端需要按以下约束消费：

- `completeMyProfile` 仅允许已登录用户调用
- `GUEST` 不允许进入首次补全
- 当前合法待补全态只有：
- `accessGroup = [REGISTRANT]`
- `accessGroup = [ADMIN]`，且 `identityHint = STAFF | STUDENT`
- mutation 成功后，前端必须重新查询 `me`
- mutation 当前不返回提交后的会话快照

### 5. 提交成功后的会话处理契约

资料补全成功后，前端应有明确去向：

- 先刷新当前 session snapshot，再决定最终跳转
- 默认进入 `/`
- 若用户是从受保护页登录后被分流到 `/welcome`，则回到原始受控目标
- 不回到 `/login`
- 不把 `/welcome` 伪装成普通 `redirect` 页面

本轮前端行为固定为：

1. `/welcome` 提交成功
2. 立即调用 `refresh`，拿到新的 token
3. 使用新 token 重新拉取 `me`，重建当前 session snapshot
4. 若 `refresh -> me` 成功，再根据最新 snapshot 判断跳转目标
5. 若 `refresh` 或后续 `me` 失败，则视为当前会话不可继续信任，执行强制登出并回到 `/login`

跳转判断也固定基于“`refresh -> me` 后的新快照”，而不是提交前的旧快照：

- 若刷新后 `needsProfileCompletion === false`，再进入 `/` 或原目标页
- 若刷新后仍为 `true`，则继续留在 `/welcome`，并把这视为后端未完成收敛或提交未真正生效的异常路径

本轮不采用以下方案：

- “补全成功后强制重新登录”
- “只拉 `me` 不刷新 token”

## 路由分流契约

`/welcome` 分流只作用于“已登录才能访问”的页面。

换句话说：

- 这不是一条新的 public route 规则
- 这不是对所有 URL 的全局强制改写
- 它只拦截 authenticated area 内、且当前用户暂时不应进入的页面

### 允许访问，不强制跳 `/welcome`

当 `me.needsProfileCompletion === true` 时，以下目标必须豁免：

- `/welcome` 自己
- 登出动作，以及任何显式 session 终止入口
- 已登录态下的帮助 / 支持页
- 错误页、错误边界和故障兜底页

约束说明：

- `/welcome` 不豁免就会形成重定向循环
- 登出不豁免，用户会被锁死在补全流里
- 帮助 / 支持页不豁免，用户在资料异常或后端契约错误时缺少逃生出口
- 错误页不豁免，调试和异常反馈会被 `/welcome` 吞掉

### 必须强制跳 `/welcome`

当 `me.needsProfileCompletion === true` 时，以下页面默认都必须被带去 `/welcome`：

- `/`
- 任何受保护业务页
- 任何要求已登录的 labs / sandbox / workbench 页面
- 未来新增的 authenticated 页面，只要它们不在豁免集合内

约束说明：

- 默认策略是“authenticated route deny by default，allowlist 放行”
- 不要反过来维护一个“哪些页面需要补全”的分散名单
- 新增登录后页面时，应默认先被 `/welcome` 守卫拦住，再按需要加入豁免

### 不参与该规则的页面

以下页面不属于 `/welcome` 强制分流范围：

- `/login`
- `/forgot-password`
- `/invite/:inviteType/:verificationCode`
- `/verify/email/:verificationCode`
- `/reset-password`
- `/reset-password/:verificationCode`
- `/magic-link/:verificationCode`

这些页面继续属于 public entry flow，不应因为资料未补全被中途改写到 `/welcome`。

但有一个例外需要明确：

- 已登录用户访问 `/login` 时，仍不应停留在 `/login`
- 若此时 `me.needsProfileCompletion === true`，登录后默认去向应是 `/welcome`，而不是 `/`

### 推荐 guard 顺序

建议路由层统一按以下顺序判断：

1. 若未登录，按原有规则处理登录跳转
2. 若已登录且 `needsProfileCompletion === false`，按原有 authenticated routing 继续
3. 若已登录且 `needsProfileCompletion === true`
4. 目标在豁免集合内，则允许访问
5. 目标不在豁免集合内，则强制跳 `/welcome`

同时补一条反向规则：

1. 若已登录且 `needsProfileCompletion === false`
2. 用户仍主动访问 `/welcome`
3. 则应立即带离 `/welcome`，回到默认落点或受控目标

## 当前前台缺口

结合当前仓库代码，前台尚未完成以下部分：

- `me` 查询还未承接 `needsProfileCompletion`
- auth session snapshot 还未承接 `needsProfileCompletion`
- 前端 access group model 还未正式承接 `REGISTRANT`
- router 还没有 `/welcome` route 与统一 guard
- login 成功后还不会根据补全态改写默认去向
- 还没有 `profile-completion` feature
- 还没有 `/welcome` 页面
- 还没有“补全成功后 `refresh -> me`”的明确前端 use case
- E2E 还未覆盖 welcome 分流与提交流程

## 推荐目录

```text
src/pages/
  welcome/index.tsx

src/features/profile-completion/
  application/
    ports.ts
    types.ts
    get-profile-completion.ts
    submit-profile-completion.ts
  infrastructure/
    profile-completion-api.ts
    mapper.ts
  ui/
    profile-completion-form.tsx
    profile-completion-panel.tsx
```

若当前团队更希望把它挂在账户域，也可以保留在 `features/account`。
但无论挂在哪，都应避免再次塞回 `features/auth`。

## 当前阶段的 4 个步骤

### 1. 收束“需补全”状态与路由守卫

完成内容：

- 在现有 session snapshot 之上明确“authenticated but incomplete”的消费方式
- 决定 `/welcome` 在路由层的准入与回跳规则
- 明确哪些页面会把用户分流到 `/welcome`
- 同步承接 `REGISTRANT` 会话类型，但不让路由守卫直接按 `accessGroup` 做补全判定

要求：

- 不新增“伪认证态”
- 不把“资料不齐”直接改写成 `unauthenticated`
- 不把 `GUEST` 当作前端兜底状态机
- 不把 `REGISTRANT` 变成另一套绕开 `needsProfileCompletion` 的平行路由开关

### 2. 落一个最小 `/welcome` 页面

完成内容：

- 提供稳定的登录后信息补全页
- 明确 loading / ready / success / failure 四态
- 成功后能继续回到默认工作台或原目标页

页面行为固定为：

- `/welcome` 属于已登录页面，而不是 public entry
- 已完成补全的用户不应继续停留在 `/welcome`
- 未登录访问 `/welcome` 时，按受保护页规则直接跳 `/login`
- 页面只承接首次最小补全，不提前长成完整账户中心

### 3. 抽共享资料表单能力

完成内容：

- 把最小资料字段、校验规则和提交 payload 抽成可复用的 feature 能力
- `/welcome` 先作为第一个消费方
- 后续 invite 激活与 `/register` 只复用表单能力，不复用整个页面状态机

要求：

- 不为了“未来也许会复用”而过度抽象
- 共享的应是字段 contract、schema、mapper、form 组件
- 不把 `/welcome` 的路由分流、成功跳转和登录前后边界硬编码进共享层
- 共享层不持有路由、session、redirect 语义
- `redirectTo`、`fromInvite`、`postLogin` 之类导航状态不得进入共享 feature contract

### 4. 补基础 E2E

至少覆盖：

- 已登录且需补全时会被正确分流到 `/welcome`
- 已登录且已补全时访问 `/welcome` 会被带离
- `/welcome` 提交成功后进入默认落点或原目标页
- `/welcome` 提交失败时能看到明确失败反馈
- 未登录访问 `/welcome` 时不会误进登录后补全流

## 与其他计划的边界

### 与 public auth 的边界

- `/invite`、`/verify/email`、`/magic-link` 仍留在 `public-auth-flows-now.md`
- `/welcome` 不接管 verification code 入口
- invite 仍需独立处理 token 校验、激活和可能的密码设置

### 与未来 `/register` 的边界

- `/register` 是否开放，仍由产品策略决定
- 即使未来开放 `/register`，它也仍是 public entry
- `/register` 可以复用资料表单能力，但不应与 `/welcome` 合并成一个页面 owner

### 与账户中心的边界

- `/welcome` 只处理首次最小资料补全
- 登录后长期资料编辑、头像修改、安全设置等，继续留给未来账户中心

## 完成标准

满足以下条件即可认为当前计划完成：

- 已登录但需补全的用户有稳定、明确的 `/welcome` 分流
- 前端没有把“资料不齐”错误推断成 `GUEST`
- `/welcome` 已具备最小成功 / 失败闭环
- 最小资料表单能力已能被后续 invite / register 复用
- 基础 E2E 已覆盖分流、提交成功、提交失败与错误访问路径

## 一句话结论

当前这条主线已经不是“要不要做 `/welcome`”的问题，而是“后端契约已定，前端按 `needsProfileCompletion -> /welcome -> refresh -> me` 补齐闭环”。
