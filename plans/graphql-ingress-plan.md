# GraphQL Ingress Plan

本计划只记录 GraphQL ingress 仍未完成的事项。

已经稳定的现行机制，统一以 `docs/` 为准，不再在本计划中重复展开：

- [docs/project-convention/graphql-ingress-auth-boundary.md](../docs/project-convention/graphql-ingress-auth-boundary.md)
- [docs/project-convention/identity-access-session.md](../docs/project-convention/identity-access-session.md)
- [docs/project-convention/graphql-error-model.md](../docs/project-convention/graphql-error-model.md)

当前已落地并已移入规则文档的内容包括：

- `shared/graphql` 与 `features/auth` 的职责边界
- `authMode: 'required' | 'none'`
- 普通业务请求的 reactive refresh
- auth 主流程通过 `allowAuthRetry: false` 排除在 shared retry 之外
- `ensureFreshSession()` 的主动续期与 `ensureFreshPromise` single-flight
- `refreshSession` / `onAuthFailure` 的 app bridge 注入
- `forceLogout()` 与 app 根部 auth state watcher 的分工
- 显式 `accessToken` 与 reactive retry 的约束
- 当前后端 auth error 信号与生产环境 `errorCode` 可见性约束

一句话：

- 现行行为看 `docs/`
- 本计划只看后续仍要推进的点

## 当前仍需推进的事项

### P1：补齐 reactive refresh 的剩余 E2E

当前已覆盖：

- protected 请求 `auth -> refresh -> retry`
- refresh 失败后的登录跳转
- public request 不参与 refresh
- auth 主流程不参与 shared retry

仍建议继续补：

- 两个并发 protected 请求同时命中 `type: 'auth'` 时，只产生一次 refresh
- public 白名单页面在 `authenticated -> unauthenticated` 时不被 watcher 误跳走
- 非当前 session 的显式 token 调用若未传 `allowAuthRetry: false`，应有测试或明确限制

### P1：继续收紧文档与实现的一致性

现行规则已进入 `docs/`，后续新增实现时应优先更新规则文档，而不是继续把稳定机制写回本计划。

重点提醒：

- 不要重新让 `plan` 成为当前机制的主规则来源
- 不要在 `docs` 与 `plan` 中同时维护两套当前语义

### P2：评估 proactive 窗口是否需要调整

当前主动续期阈值为：

- `REFRESH_THRESHOLD_MS = 60_000`

这已可用，但是否需要调大或调小，仍应结合真实 token 寿命与用户体感再评估。

约束保持不变：

- proactive 与 reactive 必须继续共享 `ensureFreshPromise`
- 不允许请求层绕过 `ensureFreshSession` 直接单独调用底层 refresh

### P2：继续评估 typed document / hooks 收口

当前 ingress 已稳定，但调用形态仍以 imperative `executeGraphQL()` 为主。

后续若要推进：

- `DocumentNode` / typed document
- Apollo hooks
- 更明确的 middleware / executor 分工

应保持以下语义不变：

- hooks 与 imperative 调用共享同一套鉴权与错误规则
- auth 主流程仍不由 shared retry 接管

### P3：WS / subscription 单独评估

当前 WS 仍只算预埋能力，不作为现行 auth 语义承诺的一部分。

后续若真的启用 WS，仍需单独补齐：

- token 变化后的重连策略
- 登出 / 切账号 / 强制失效时断开旧连接
- 对 HTTP ingress 不反向施压

这部分在未形成真实业务需求前，不进入当前主线。
