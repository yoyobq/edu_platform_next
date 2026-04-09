<!-- docs/project-convention/public-auth-staff-invite.md -->

# Public Auth Staff Invite

本文件只描述前端当前 `staff invite` 链路的页面语义、交互边界与实现约定。

后端 contract、schema 与 resolver 真相不在这里维护，统一以下列文档为准：

- [Invite Register Current Contract](/var/www/platform_next/docs/backend/invite-register-current.md)
- [schema.graphql](/var/www/platform_next/docs/backend/schema.graphql)

## 适用范围

- 路由：`/invite/staff/:verificationCode`
- page owner：`verification-intent`
- feature owner：`src/features/public-auth`
- layout：`PublicEntryLayout`

## 固定流程

当前前端固定为 3 段：

1. 邀请确认
2. 上游身份核对
3. 设置平台账户

成功后不在当前页建立 session，统一回：

- `/login?skipRestore=1`

## 页面语义

- 入口继续保持 `inviteType + verificationCode` 的 path-first 语义
- 当前只对 `inviteType=staff` 进入真实流程
- 页面不扩成通用公开注册页
- 用户必须先确认 invite，再进入上游身份核对
- 前端不得把“上游核对通过”当作最终成功

## 邀请确认阶段

- 先查询 `publicInviteInfo(token)`
- 仅展示最小必要信息：
  - invited email
  - issuer
  - expiresAt
  - description
- 若 invite 无效、过期、已使用，应直接进入失败态

## 上游身份核对阶段

- 当前表单文案使用“校园网工号 / 校园网密码”
- 这里填写的是校园网账号，不是当前平台登录账号
- 上游核对失败时，应显示明确中文错误并停留在本阶段
- 此阶段失败不应把 invite 视为已消费

## 设置账户阶段

- 登录邮箱不再由页面输入
- 当前登录邮箱固定使用 invite 的 `invitedEmail`
- 页面最终只收：
  - `nickname`
  - `loginPassword`
  - 可选 `loginName`
- 上游身份摘要当前只展示：
  - staff name
  - invited email
  - department，优先 `departmentName`，缺失时回退 `orgId`
  - personId
- 不展示上游账号
- 不额外展示部门 ID；只有 `departmentName` 缺失时才回退显示 `orgId`

## 成功态

- 成功文案为“账号已准备就绪”
- CTA 为“前往登录”
- 成功提示需明确：
  - 可使用邀请邮箱登录
  - 若填写了 `loginName`，也可使用该登录名登录

## 失败态

- invite 入口失败态区分：
  - invalid
  - expired
  - used
  - unknown
- 最终提交失败时，若后端返回结构化 failure result，页面进入“邀请注册未完成”
- 最终提交 transport / ingress error 时，保留在表单阶段并显示统一错误
- 身份 mismatch 相关错误按明确中文文案展示，不再自行拼接技术细节

## E2E 基线

当前 `staff invite` 相关 E2E 至少覆盖：

- 成功激活主线
- 设置可选 `loginName` 后，用登录名登录
- invite 失败态：invalid / expired / used
- 上游身份核对失败
- 最终提交 failure / mismatch / transport error
- 已有本地 session 时，public-auth staff invite 流程不主动触发 `me` / `refresh`
