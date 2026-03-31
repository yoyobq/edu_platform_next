# Public Auth Flows Now

本计划只覆盖当前就可以直接开始编码的部分。

目标是先把“用户自助恢复”做成最小可用闭环，而不是一口气补完整个公共认证体系。

## 当前范围

本轮只做：

1. 新增 `/forgot-password`
2. 登录页增加“忘记密码”入口
3. 把 `/reset-password/:verificationCode` 从展示壳升级为真实流程
4. 为上述流程补基础 E2E

本轮不做：

- invite 激活 / 注册
- 邮箱验证真实化
- magic-link 真实化
- 开放注册 `/register`
- 账户中心与资料编辑

## 当前实现假设

为了保证现在就能开工，本轮先固定以下假设，不再作为开放项来回讨论：

- 公共认证流程新增到 `src/features/public-auth`
- `features/auth` 继续只负责 session 登录、恢复与退出
- `/forgot-password` 继续挂在 `PublicEntryLayout`
- `/reset-password/:verificationCode` 继续保持 path-first
- 忘记密码提交后统一显示成功反馈，不暴露账户是否存在
- reset 页面统一支持 `loading / ready / success / failure`
- `failure` 至少覆盖：`invalid / expired / used / unknown`
- 如果后端没有单独的“verify reset code”接口，前端仍先按独立 port 建模，基础设施层再适配到实际后端语义

这意味着：

- 现在可以先做页面、状态机、port、API adapter 和 E2E
- 不需要等 invite / magic-link / verify-email 的后端契约一起明确后再开始

## 推荐目录

```text
src/pages/
  forgot-password/index.tsx
  verification-intent/index.tsx

src/features/public-auth/
  application/
    ports.ts
    types.ts
    request-password-reset.ts
    verify-reset-password-intent.ts
    reset-password.ts
  infrastructure/
    public-auth-api.ts
    mapper.ts
  ui/
    forgot-password-form.tsx
    reset-password-form.tsx
```

## 现在就做的 4 个步骤

### 1. 建立 `public-auth` 最小骨架

完成内容：

- 新增 `src/features/public-auth`
- 定义 `ports.ts`
- 定义 reset 流程最小结果类型
- 建立 `public-auth-api.ts`

最小接口先固定为：

```ts
export type VerificationFailureReason = 'invalid' | 'expired' | 'used' | 'unknown';

export type VerificationIntentResult =
  | { status: 'valid' }
  | { status: 'invalid'; reason: VerificationFailureReason }
  | { status: 'expired'; reason: VerificationFailureReason }
  | { status: 'used'; reason: VerificationFailureReason };

export type PublicAuthApiPort = {
  requestPasswordReset: (input: { email: string }) => Promise<void>;
  verifyResetPasswordIntent: (input: {
    verificationCode: string;
  }) => Promise<VerificationIntentResult>;
  resetPassword: (input: { verificationCode: string; newPassword: string }) => Promise<void>;
};
```

要求：

- 不把 forgot/reset 继续塞进 `features/auth`
- 不提前把 invite / verify-email / magic-link 的全部 port 一起做重

### 2. 做 `/forgot-password`

完成内容：

- 在 router 中新增 `/forgot-password`
- 新增 `src/pages/forgot-password/index.tsx`
- 登录页增加“忘记密码”入口
- 新增 `forgot-password-form.tsx`
- 接入 `requestPasswordReset`

页面行为固定为：

- 用户输入邮箱并提交
- 成功后统一显示：“若该账户存在，我们已发送重置邮件”
- 页面提供返回登录入口
- 不显示“邮箱不存在”这类账号枚举信息

### 3. 做 `/reset-password/:verificationCode`

完成内容：

- 在现有 `verification-intent` 页面中，把 `ResetPasswordIntentPage` 从参数展示升级为真实流程
- 接入 `verifyResetPasswordIntent`
- 接入 `resetPassword`
- 新增 `reset-password-form.tsx`

页面状态固定为：

- `loading`：进入页面后先校验 code
- `ready`：code 有效，展示新密码表单
- `success`：密码更新成功，给出返回登录入口
- `failure`：无效 / 过期 / 已使用 / 未知错误

当前轮次固定行为：

- 成功后不直接登录
- 成功后统一回到 `/login`

### 4. 补基础 E2E

至少覆盖：

- 登录页能进入忘记密码
- 忘记密码提交后能看到统一成功反馈
- reset code 有效时可完成重置
- reset code 无效时显示失败态
- reset code 过期时显示失败态
- reset code 已使用时显示失败态

说明：

- 若当前后端未就绪，可先通过 route mock 跑通页面闭环
- 但不要把 mock 协议直接当作正式后端契约写死

## 完成标准

满足以下条件即可认为当前计划完成：

- 登录页已有稳定的“忘记密码”入口
- `/forgot-password` 可提交并给出统一反馈
- `/reset-password/:verificationCode` 不再只是展示 code
- reset 页面已具备有效 / 无效 / 过期 / 已使用四类基本状态
- 上述流程都继续停留在 `PublicEntryLayout`
- 对应基础 E2E 已覆盖关键成功 / 失败路径
