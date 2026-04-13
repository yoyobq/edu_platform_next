<!-- docs/project-convention/public-auth-verification-intents.md -->

# Public Auth Verification Intents

本文件定义当前 public auth 一次性入口的稳定前端约定。

`staff invite` 的页面细节与交互语义，统一以 [public-auth-staff-invite.md](./public-auth-staff-invite.md) 为准；本文件只收口这些 intent 入口的共同边界、归属和当前状态。

## 适用范围

当前 public auth intent 入口包括：

- `/invite/:inviteType/:verificationCode`
- `/verify/email/:verificationCode`
- `/reset-password/:verificationCode`
- `/magic-link/:verificationCode`

共同归属固定为：

- layout：`PublicEntryLayout`
- feature owner：`src/features/public-auth`
- page owner：
  - `/invite/*`、`/verify/email/*`、`/magic-link/*` 继续由 `src/pages/verification-intent` 承接
  - `/reset-password/:verificationCode` 继续走 `verification-intent` 内的真实 reset password panel

## 固定边界

- 这些入口继续保持 path-first，不折叠进普通 `redirect`
- `features/public-auth` 只负责公开认证入口本身的 use case、API 与 UI
- `features/auth` 继续只负责 session 登录、恢复、续期与退出
- 不因为当前只剩部分 intent 未接实，就把 `/invite`、`/verify/email`、`/magic-link` 塞回 `features/auth`
- 这些 intent 入口继续挂在 `PublicEntryLayout`，不并入登录后壳层

## 当前路线状态

| 路由                                                  | 当前状态 | 说明                                                 |
| ----------------------------------------------------- | -------- | ---------------------------------------------------- |
| `/forgot-password`                                    | 已落地   | 真实提交已接通                                       |
| `/reset-password/:verificationCode`                   | 已落地   | 真实校验、重置、错误模型与 E2E 已接通                |
| `/reset-password?token=...`                           | 兼容保留 | 当前继续支持 query token 透传                        |
| `/invite/staff/:verificationCode`                     | 已落地   | 真实流程已接通，细节见 `public-auth-staff-invite.md` |
| `/invite/:inviteType/:verificationCode`（非 `staff`） | 受限壳页 | 当前只保留入口与参数展示，不伪造真实激活             |
| `/verify/email/:verificationCode`                     | 壳页     | 当前仍未接入真实成功 / 失败闭环                      |
| `/magic-link/:verificationCode`                       | 壳页     | 当前仍未接入真实登录续接闭环                         |

## 对 `magic-link` 的当前约束

- 只有在后端明确提供“验证成功后建立 session”的稳定契约时，`magic-link` 才进入真实实现
- 在拿到该契约前，页面继续保留壳页，不伪造成功登录
- 不把临时回跳方案写成正式规则

## 当前联调补充

- staff invite 当前继续通过 `/labs/invite-issuer` 生成联调链接
- 该页只作为联调工具，不承担正式管理后台职责
- 它不进入正式导航，只保留直链使用
