<!-- docs/project-convention/public-auth-verification-intents.md -->

# Public Auth Verification Intents

本文件定义当前 public auth 一次性入口的稳定前端约定。

`staff invite` 的页面细节与交互语义，统一以 [public-auth-staff-invite.md](./public-auth-staff-invite.md) 为准；学生注册链接注册链路统一以 [public-auth-student-registration.md](./public-auth-student-registration.md) 为准。本文件只收口这些 intent 入口的共同边界、归属和当前状态。

## Public Auth 入口全集

当前 `PublicEntryLayout` 下的 public auth 入口包括：

- `/login`
- `/forgot-password`
- `/reset-password`
- `/reset-password/:verificationCode`
- `/invite/:inviteType/:verificationCode`
- `/invite/student-registration/:token`
- `/verify/account-email/:token`
- `/verify/email/:verificationCode`
- `/welcome-back/reset-password`
- `/welcome-back/reset-password/:verificationCode`
- `/magic-link/:verificationCode`

其中：

- `/login` 是 auth session 登录入口，由 `features/auth` 承接
- 其它一次性公开入口由 `features/public-auth` 承接
- 所有入口都挂在 `PublicEntryLayout`，不进入登录后 app shell

## Verification Intent 范围

当前 public auth intent 入口包括：

- `/invite/:inviteType/:verificationCode`
- `/invite/student-registration/:token`
- `/verify/account-email/:token`
- `/verify/email/:verificationCode`
- `/reset-password`
- `/reset-password/:verificationCode`
- `/welcome-back/reset-password`
- `/welcome-back/reset-password/:verificationCode`
- `/magic-link/:verificationCode`

共同归属固定为：

- layout：`PublicEntryLayout`
- feature owner：`src/features/public-auth`
- page owner：
  - `/invite/*`、`/verify/*`、`/magic-link/*` 继续由 `src/pages/verification-intent` 承接
  - `/reset-password*`、`/welcome-back/reset-password*` 继续走 `verification-intent` 内的真实 reset password panel

## 固定边界

- 这些入口继续保持 path-first，不折叠进普通 `redirect`
- `features/public-auth` 只负责公开认证入口本身的 use case、API 与 UI
- `features/auth` 继续只负责 session 登录、恢复、续期与退出
- 不因为当前只剩部分 intent 未接实，就把 `/invite`、`/verify/email`、`/magic-link` 塞回 `features/auth`
- 这些 intent 入口继续挂在 `PublicEntryLayout`，不并入登录后壳层
- `/login` 虽然属于 public auth 入口，但不是 verification intent；账号密码错误不触发 shared/graphql 的 refresh/logout

## 当前路线状态

| 路由                                                | 当前状态 | 说明                                                               |
| --------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `/login`                                            | 已落地   | session 登录入口；loader 会 restore，`skipRestore=1` 可跳过        |
| `/forgot-password`                                  | 已落地   | 真实提交已接通                                                     |
| `/reset-password`                                   | 已落地   | 支持 query token / scene 兼容入口                                  |
| `/reset-password/:verificationCode`                 | 已落地   | 真实校验、重置、错误模型与 E2E 已接通                              |
| `/reset-password?token=...`                         | 兼容保留 | 当前继续支持 query token 透传                                      |
| `/welcome-back/reset-password`                      | 已落地   | welcome-back 文案场景；支持 query token                            |
| `/welcome-back/reset-password/:verificationCode`    | 已落地   | welcome-back 文案场景；path-first verification code                |
| `/invite/staff/:verificationCode`                   | 已落地   | 真实流程已接通，细节见 `public-auth-staff-invite.md`               |
| `/invite/student/:verificationCode`                 | 已下线   | 旧学生 invite 占位入口不再查询旧接口，路由按 404 处理              |
| `/invite/student-registration/:token`               | 已落地   | 学生注册链接注册入口，细节见 `public-auth-student-registration.md` |
| `/verify/account-email/:token`                      | 已落地   | 初始登录邮箱验证入口，打开后直接消费 token                         |
| `/invite/:inviteType/:verificationCode`（其它类型） | 受限壳页 | 当前只保留入口与参数展示，不伪造真实激活                           |
| `/verify/email/:verificationCode`                   | 已落地   | 登录邮箱变更确认；不是新账号初始邮箱验证入口                       |
| `/magic-link/:verificationCode`                     | 壳页     | 当前仍未接入真实登录续接闭环                                       |

## 对 `magic-link` 的当前约束

- 只有在后端明确提供“验证成功后建立 session”的稳定契约时，`magic-link` 才进入真实实现
- 在拿到该契约前，页面继续保留壳页，不伪造成功登录
- 不把临时回跳方案写成正式规则

## Reset Password 场景

- 新密码页面校验与注册入口共用当前账户密码策略
- `/reset-password/:verificationCode` 是默认密码重置入口
- `/reset-password?token=...` 是兼容入口，仍由同一 page 读取 `token`
- `/welcome-back/reset-password/:verificationCode` 是 welcome-back 文案场景，底层仍复用 reset password panel
- `/welcome-back/reset-password?token=...` 同样允许 query token
- 若后端 preview 返回 `legacy-user-password-reset`，页面按 welcome-back copy 展示

## 当前签发入口

- staff invite 与学生班级共享注册链接统一由正式管理页 `/admin/verification-issuance` 签发
- 学生注册链接由后端按 `STUDENT_REGISTRATION_FRONTEND_URL` 拼接 `/invite/student-registration/<token>`；旧 `inviteStudent` / `registerByInvite` 已移除
- 正式页面仅签发班级共享链接，不提供按单个学生签发的表单
