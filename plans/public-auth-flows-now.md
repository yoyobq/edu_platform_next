# Public Auth Flows Now

本计划覆盖 public auth 当前仍未落地、但已经接近真实实现的部分。

当前项目真相：

- `/forgot-password` 已接入真实提交
- `/reset-password/:verificationCode` 与 `/reset-password?token=...` 已接入真实校验、重置、错误模型与 E2E
- `src/features/public-auth` 当前只包含密码恢复相关 use case / API / UI
- `/invite/:inviteType/:verificationCode`、`/verify/email/:verificationCode`、`/magic-link/:verificationCode` 还停留在 [verification-intent/index.tsx](/var/www/platform_next/src/pages/verification-intent/index.tsx) 的参数展示壳页
- 对应 E2E 现状也是：
  - [public-auth-password-recovery.spec.ts](./../e2e/specs/routing/public-auth-password-recovery.spec.ts) 覆盖真实密码恢复闭环
  - [verification-intent.spec.ts](./../e2e/specs/routing/verification-intent.spec.ts) 只覆盖其余入口的 path-first shell 路由

## 阶段切换

以下内容已完成，可视为当前基线：

- `/forgot-password` 已可提交并给出统一反馈
- 登录页已有稳定“忘记密码”入口
- `/reset-password/:verificationCode` 已具备真实校验、重置与成功/失败闭环
- `/reset-password?token=...` 已支持 query token 透传
- `public-auth` 已按当前 GraphQL error model 区分业务失败与基础设施错误
- 对应基础 E2E 已存在

因此本轮不再把“密码恢复闭环”继续列为当前任务。

## 当前范围

本轮优先推进：

1. 先确认 `/invite/:inviteType/:verificationCode` 的后端契约，再决定它是“激活”“注册补全”还是别的 intent
2. 把 `/verify/email/:verificationCode` 从参数展示升级为真实成功 / 失败闭环
3. 明确 `/magic-link/:verificationCode` 是否真的具备“验证成功后建立 session”的后端契约
4. 为真正落地的 invite / verify-email / magic-link 流程补基础 E2E

本轮不做：

- 重做 `/forgot-password` 与 `/reset-password/:verificationCode`
- 重开 `public-auth` 当前错误模型与 transport 约定
- 开放公开注册 `/register`
- 账户中心与资料编辑
- 与公开认证无直接关系的第三方登录整合

## 当前固定边界

为了让这轮计划继续可执行，先固定以下边界：

- 公共认证流程继续收敛到 `src/features/public-auth`
- `features/auth` 继续只负责 session 登录、恢复与退出
- `/invite`、`/verify/email`、`/magic-link` 继续挂在 `PublicEntryLayout`
- 一次性业务入口继续保持 path-first，不折叠进普通 `redirect`
- `verification-intent` 页面仍是这些入口的 page owner
- 不能因为当前只剩 reset-password 真实化，就把 invite / verify-email / magic-link 又塞回 `features/auth`
- 若后端没有每类 intent 独立的“预校验”接口，前端可以按独立 port 建模，但不能伪造不存在的成功语义
- invite 默认继续按 `invite-first` 设计，不因为本轮实现而顺手打开 `/register`
- 若 invite 或 magic-link 成功后后端未直接返回 session，则前端统一回 `/login`
- magic-link 只有在后端明确支持“验证成功后建立 session”时才进入真实实现；否则本轮只记录 blocker，不伪造登录

这意味着：

- 现在可以先做页面、状态机、port、API adapter 和 E2E
- 但要先看 [docs/backend/README.md](/var/www/platform_next/docs/backend/README.md) 指向的后端真相，再决定哪些入口可真实推进
- 不要把 `/register`、账户资料、公开注册策略一起混入本轮

## 当前缺口

当前真正缺的不是“密码恢复再抽象一次”，而是：

- `src/features/public-auth` 里还没有 invite / verify-email / magic-link 的 application port
- 也没有对应 infrastructure adapter
- `verification-intent` 页面里这 3 个入口仍只是展示 path 参数
- E2E 目前也只证明它们是 path-first shell，不证明任何真实业务闭环

## 当前阶段的 4 个步骤

### 1. 先确认后端契约，再决定哪些入口可进入真实实现

完成内容：

- 先按 [docs/backend/README.md](/var/www/platform_next/docs/backend/README.md) 查真相
- 明确 invite / verify-email / magic-link 各自是否已有稳定接口
- 明确哪些入口有预校验、哪些入口是调用即消费
- 明确 magic-link 是否真的会直接建立 session

要求：

- 不凭前端假设发明后端契约
- 不把新的公开入口继续塞回 `features/auth`
- 不把 invite / verify-email / magic-link 一次性揉成一个超大 API port
- 若某条入口当前拿不到真契约，先记 blocker，不伪实现

### 2. 做 `/invite/:inviteType/:verificationCode`

完成内容：

- 在确认后端契约后，把 `InviteIntentPage` 从参数展示升级为真实流程
- 为 invite intent 增加独立 use case / port / adapter
- 有效时展示最小必要动作；失败时至少区分 `invalid / expired / used / unknown`

页面行为先固定为：

- 入口仍保留 `inviteType + verificationCode` 的 path-first 语义
- invite 有效时展示最小必要字段，不顺手扩成完整公开注册页
- 若激活 / 注册成功但后端未直接返回 session，则统一回 `/login`
- 若后端已经支持直接返回 session，可再决定是否直接续接登录

### 3. 做 `/verify/email/:verificationCode`

完成内容：

- 把 `VerifyEmailIntentPage` 从参数展示升级为真实成功 / 失败闭环
- 接入邮箱验证 use case / port / adapter
- 明确成功态、失败态和返回登录或继续站内流程的动作

页面行为先固定为：

- 路径继续保持 `/verify/email/:verificationCode`
- 不改成 `/verify-email/:verificationCode`
- 不与普通 `redirect` 回跳混写
- 若后端语义是“调用即消费”，则由 infrastructure adapter 吞掉差异，不把差异泄漏到页面层

### 4. 处理 `/magic-link/:verificationCode` 与 E2E

完成内容：

- 先确认 magic-link 成功后后端是否会直接返回 session
- 若支持，则把 `MagicLinkIntentPage` 从参数展示升级为真实登录续接流程
- 若不支持，则在本轮明确记下 blocker，并保留壳页，不伪造成功登录
- 为 invite / verify-email / magic-link 的最终决定补基础 E2E

至少覆盖：

- invite code 有效时可完成最小激活 / 注册
- invite code 无效 / 过期 / 已使用时显示失败态
- verify-email 成功时可看到明确成功反馈
- verify-email 失败时可看到明确失败反馈
- magic-link 若接入真实流程，应覆盖成功续接与失败态
- magic-link 若仍受阻，应至少有文档化 blocker，而不是模糊悬置

## 完成标准

满足以下条件即可认为当前计划完成：

- 密码恢复闭环继续保持当前稳定基线，不再与新任务混写
- `/invite/:inviteType/:verificationCode` 不再只是展示参数，或已被明确标记 blocker
- `/verify/email/:verificationCode` 已具备明确成功 / 失败闭环
- `/magic-link/:verificationCode` 已拿到明确 go / no-go 结论
- 上述真实落地的流程都继续停留在 `PublicEntryLayout`
- 对应基础 E2E 已覆盖当前阶段真正落地的成功 / 失败路径
