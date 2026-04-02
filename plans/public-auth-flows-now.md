# Public Auth Flows Now

本计划覆盖 public auth 的下一阶段。

上一阶段“用户自助恢复”已经完成；当前不再围绕 `/forgot-password` 与 `/reset-password/:verificationCode` 继续展开，而是把剩余公开认证入口从展示壳推进到真实流程。

## 阶段切换

以下内容已完成，可视为当前基线：

- `/forgot-password` 已可提交并给出统一反馈
- 登录页已有稳定“忘记密码”入口
- `/reset-password/:verificationCode` 已具备真实校验、重置与成功/失败闭环
- 对应基础 E2E 已存在

因此本轮不再把“密码恢复闭环”继续列为当前任务。

## 当前范围

本轮优先推进：

1. 把 `/invite/:inviteType/:verificationCode` 从参数展示升级为真实激活 / 注册流程
2. 把 `/verify/email/:verificationCode` 从参数展示升级为真实成功 / 失败闭环
3. 明确 `/magic-link/:verificationCode` 的后端契约，并据此决定是否接入真实登录续接
4. 为上述流程补齐基础 E2E

本轮不做：

- 重做 `/forgot-password` 与 `/reset-password/:verificationCode`
- 开放公开注册 `/register`
- 账户中心与资料编辑
- 与公开认证无直接关系的第三方登录整合

## 当前实现假设

为了让这一轮继续可执行，先固定以下假设：

- 公共认证流程继续收敛到 `src/features/public-auth`
- `features/auth` 继续只负责 session 登录、恢复与退出
- `/invite`、`/verify/email`、`/magic-link` 继续挂在 `PublicEntryLayout`
- 一次性业务入口继续保持 path-first，不折叠进普通 `redirect`
- `verification-intent` 页面仍是这些入口的 page owner
- 若后端没有每类 intent 独立的“预校验”接口，前端仍可先按独立 port 建模，再由基础设施层适配到 `findVerificationRecord`
- invite 默认继续按 `invite-first` 设计，不因为本轮实现而顺手打开 `/register`
- 若 invite 或 magic-link 成功后后端未直接返回 session，则前端统一回 `/login`
- magic-link 只有在后端明确支持“验证成功后建立 session”时才进入真实实现；否则本轮只记录 blocker，不伪造登录

这意味着：

- 现在可以先做页面、状态机、port、API adapter 和 E2E
- 但不要把 `/register`、账户资料、公开注册策略一起混入本轮

## 推荐目录

```text
src/pages/
  verification-intent/index.tsx

src/features/public-auth/
  application/
    ports.ts
    types.ts
    verify-invite-intent.ts
    activate-invite.ts
    verify-email-intent.ts
    consume-magic-link.ts
  infrastructure/
    public-auth-api.ts
    mapper.ts
  ui/
    invite-activation-form.tsx
    invite-intent-panel.tsx
    verify-email-intent-panel.tsx
    magic-link-intent-panel.tsx
```

## 当前阶段的 4 个步骤

### 1. 收束 verification intent 的共享建模

完成内容：

- 继续以 `src/features/public-auth` 作为公开认证入口的唯一 feature owner
- 为 invite / verify-email / magic-link 补独立 use case 与 port
- 复用当前 reset 已验证过的 `loading / ready / success / failure` 工作流思路
- 明确哪些失败态至少需要区分 `invalid / expired / used / unknown`

要求：

- 不把新的公开入口继续塞回 `features/auth`
- 不把 invite / verify-email / magic-link 一次性揉成一个超大 API port
- 可以共享基础类型或 mapper，但业务动作仍应按入口拆清楚

### 2. 做 `/invite/:inviteType/:verificationCode`

完成内容：

- 在现有 `verification-intent` 页面中，把 `InviteIntentPage` 从参数展示升级为真实流程
- 接入 invite intent 校验
- 有效时展示最小激活 / 注册表单
- 失败时至少覆盖 `invalid / expired / used`

页面行为先固定为：

- 入口仍保留 `inviteType + verificationCode` 的 path-first 语义
- invite 有效时展示最小必要字段，不顺手扩成完整公开注册页
- 若激活 / 注册成功但后端未直接返回 session，则统一回 `/login`
- 若后端已经支持直接返回 session，可再决定是否直接续接登录

### 3. 做 `/verify/email/:verificationCode`

完成内容：

- 把 `VerifyEmailIntentPage` 从参数展示升级为真实成功 / 失败闭环
- 接入邮箱验证 use case
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

- 密码恢复闭环已明确视为“已完成基线”，不再与当前任务混写
- `/invite/:inviteType/:verificationCode` 不再只是展示参数
- `/verify/email/:verificationCode` 已具备明确成功 / 失败闭环
- `/magic-link/:verificationCode` 已拿到明确 go / no-go 结论
- 上述流程都继续停留在 `PublicEntryLayout`
- 对应基础 E2E 已覆盖当前阶段真正落地的成功 / 失败路径
