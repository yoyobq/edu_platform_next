<!-- docs/project-convention/welcome-profile-completion.md -->

# Welcome Profile Completion

本文件定义当前 `/welcome` 首次资料补全链路的稳定前端约定。

会话状态机、`needsProfileCompletion`、`REGISTRANT` 与登录后恢复主线，统一以 [identity-access-session.md](./identity-access-session.md) 为准；本文件只补 `/welcome` 自身的页面语义、跳转边界与复用约束。

## 适用范围

- 路由：`/welcome`
- layout：`AppLayout`
- page owner：`src/pages/welcome`
- feature owner：`src/features/profile-completion`

## 入口语义

- `/welcome` 只承接登录后的首次最小资料补全
- 进入 `/welcome` 的稳定触发条件是 `needsProfileCompletion === true`
- `REGISTRANT` 是当前前端会话里的过渡态，不等于 `GUEST`
- 前端不得因 `identity = null` 自行把用户推断成 `GUEST`
- `ADMIN + identityHint = STAFF | STUDENT + needsProfileCompletion = true` 当前允许进入 `/welcome`

## Redirect 规则

- `/welcome` 继续属于登录后 authenticated shell，不属于 public entry
- 登录后若还需要补全资料，应先进入 `/welcome`，再回原目标页或默认工作台
- `/welcome` 的回跳继续使用 `?redirect=...` 承接
- `redirect` 若解析为 `/login` 或 `/welcome`，前端统一回退到 `/`
- 未完成资料补全时，不允许绕过 `/welcome` 直接进入正式业务主线

## 固定流程

当前 `/welcome` 固定为以下闭环：

1. 已存在登录会话
2. 展示最小资料补全表单
3. 提交 `completeMyProfile`
4. 成功后执行 `refresh -> me`
5. `needsProfileCompletion` 解除后，跳到 `redirect` 或 `/`

固定约束：

- `/welcome` 不重新建立登录会话；它只消费当前已存在的会话
- 成功提交后，前端必须通过 `refresh -> me` 重建当前会话快照
- 若刷新后仍显示 `needsProfileCompletion = true`，页面应停留在 `/welcome` 并给出明确错误
- 若提交成功但当前会话刷新失败，按会话失效处理，要求用户重新登录

## 表单与复用边界

- `/welcome` 当前消费 `features/profile-completion` 的最小资料表单能力
- 可复用内容只限：
  - 字段 contract
  - 表单 schema
  - mapper
  - 表单 UI 能力
- 不复用 `/welcome` 自己的路由分流、成功跳转与登录后会话状态机
- invite 激活、未来 `/register` 或其他 public flow 若要复用资料表单，应各自维护自己的页面编排与成功语义

## 当前不扩张的边界

- `/welcome` 不扩成长期账户中心
- `/welcome` 不承接头像修改、安全设置或长期资料维护
- 若未来出现多阶段 onboarding，不继续把更多状态塞进 `needsProfileCompletion`
- `/welcome` 继续只处理首次最小补全，不自动扩成长期 onboarding 容器
