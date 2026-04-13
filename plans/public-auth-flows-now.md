# Public Auth Flows Now

本计划只覆盖 public auth 当前仍未落地、且仍需要推进的部分。
已经稳定落地的链路不再在本文件重复展开实现细节，统一以下列文档为准：

- [Invite Register Current Contract](/var/www/platform_next/docs/backend/invite-register-current.md)
- [Public Auth Verification Intents](/var/www/platform_next/docs/project-convention/public-auth-verification-intents.md)
- [Public Auth Staff Invite](/var/www/platform_next/docs/project-convention/public-auth-staff-invite.md)

当前项目真相：

- `/forgot-password` 已接入真实提交
- `/reset-password/:verificationCode` 与 `/reset-password?token=...` 已接入真实校验、重置、错误模型与 E2E
- `/invite/staff/:verificationCode` 已接入真实 staff invite 流程与基础 E2E
- `src/features/public-auth` 当前已包含密码恢复与 `staff invite` 的 use case / API / UI
- `/verify/email/:verificationCode`、`/magic-link/:verificationCode` 还停留在 [verification-intent/index.tsx](/var/www/platform_next/src/pages/verification-intent/index.tsx) 的壳页
- 当前已有临时签发入口 [InviteIssuerLabPage](/var/www/platform_next/src/labs/invite-issuer/page.tsx)，直链 `/labs/invite-issuer`，用于调用 `inviteStaff` / `inviteStudent` 生成联调 invite link
- 对应 E2E 现状也是：
  - [public-auth-password-recovery.spec.ts](./../e2e/specs/routing/public-auth-password-recovery.spec.ts) 覆盖真实密码恢复闭环
  - [public-auth-staff-invite.spec.ts](./../e2e/specs/routing/public-auth-staff-invite.spec.ts) 覆盖真实 staff invite 成功 / 失败主线
  - [verification-intent.spec.ts](./../e2e/specs/routing/verification-intent.spec.ts) 只覆盖 `verify-email` / `magic-link` 及非 `staff` inviteType 的 path-first shell 路由

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

1. 把 `/verify/email/:verificationCode` 从参数展示升级为真实成功 / 失败闭环
2. 明确 `/magic-link/:verificationCode` 是否真的具备“验证成功后建立 session”的后端契约
3. 为后续真正落地的 verify-email / magic-link 流程补基础 E2E
4. staff invite 联调继续通过 `/labs/invite-issuer` 生成邀请链接，不再额外回退公开消费主线

本轮不做：

- 重做 `/forgot-password` 与 `/reset-password/:verificationCode`
- 重开 `public-auth` 当前错误模型与 transport 约定
- 重做已落地的 `/invite/staff/:verificationCode`
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
- 当前 invite 先只推进 `staff` 这一路；其他 inviteType 继续留在后续项
- invite 默认继续按 `invite-first` 设计，不因为本轮实现而顺手打开 `/register`
- 已落地的 `staff invite` 真实流程与字段口径不再在本文件重复维护，统一以 docs 中的后端 contract 与前端 convention 为准
- magic-link 只有在后端明确支持“验证成功后建立 session”时才进入真实实现；否则本轮只记录 blocker，不伪造登录

这意味着：

- 现在已可以稳定联调 `staff invite`
- 若需要新 token，不再临时手造或依赖缺失的管理页，而是直接进入 `/labs/invite-issuer`
- 当前剩余 blocker 集中在 `verify-email` 与 `magic-link`，不要把 `/register`、账户资料、公开注册策略一起混入本轮

## 最新补充

- 临时签发入口 `/labs/invite-issuer` 的定位是联调工具，不承担正式管理后台职责：
  - 当前可签发 `staff` / `student` invite
  - 返回后会直接展示 `token`、`expiresAt`、`recordId` 与可打开的邀请链接
  - 该页不进入导航，仅保留直链使用

## 当前缺口

当前真正缺的不是“密码恢复再抽象一次”，而是：

- `src/features/public-auth` 已完成 `staff invite` 的 application port / infrastructure adapter；剩余缺口集中在 `verify-email` 与 `magic-link`
- `verification-intent` 页面里当前仍只有 `staff invite` 进入真实流程；`verify-email` / `magic-link` 还是 path-first shell
- E2E 目前已覆盖 `staff invite` 真实成功 / 失败闭环；`verify-email` / `magic-link` 仍主要停留在壳层路由验证

## 当前阶段的 4 个步骤

### 1. 做 `/verify/email/:verificationCode`

完成内容：

- 把 `VerifyEmailIntentPage` 从参数展示升级为真实成功 / 失败闭环
- 接入邮箱验证 use case / port / adapter
- 明确成功态、失败态和返回登录或继续站内流程的动作

页面行为先固定为：

- 路径继续保持 `/verify/email/:verificationCode`
- 不改成 `/verify-email/:verificationCode`
- 不与普通 `redirect` 回跳混写
- 若后端语义是“调用即消费”，则由 infrastructure adapter 吞掉差异，不把差异泄漏到页面层

### 2. 处理 `/magic-link/:verificationCode` 与 E2E

完成内容：

- 先确认 magic-link 成功后后端是否会直接返回 session
- 若支持，则把 `MagicLinkIntentPage` 从参数展示升级为真实登录续接流程
- 若不支持，则在本轮明确记下 blocker，并保留壳页，不伪造成功登录
- 为 invite / verify-email / magic-link 的最终决定补基础 E2E

至少覆盖：

- verify-email 成功时可看到明确成功反馈
- verify-email 失败时可看到明确失败反馈
- magic-link 若接入真实流程，应覆盖成功续接与失败态
- magic-link 若仍受阻，应至少有文档化 blocker，而不是模糊悬置

## 完成标准

满足以下条件即可认为当前计划完成：

- 密码恢复闭环继续保持当前稳定基线，不再与新任务混写
- `/invite/staff/:verificationCode` 继续保持已落地基线，其 contract 以 docs 为准
- `/verify/email/:verificationCode` 已具备明确成功 / 失败闭环
- `/magic-link/:verificationCode` 已拿到明确 go / no-go 结论
- 上述真实落地的流程都继续停留在 `PublicEntryLayout`
- 对应基础 E2E 已覆盖当前阶段真正落地的成功 / 失败路径
