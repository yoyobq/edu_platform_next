<!-- docs/project-convention/graphql-ingress-auth-boundary.md -->

# GraphQL Ingress Auth Boundary

本文件定义当前项目里 GraphQL 共享入口与 auth feature 的职责边界。

它回答的是：

- 所有 GraphQL 请求为什么统一走 `shared/graphql`
- 当前 reactive refresh 与 auth 主流程如何分工
- `auth` 与 `shared` 各自负责什么

## 当前结论

当前项目采用以下规则：

- 所有 GraphQL 请求统一走 `src/shared/graphql`
- `shared/graphql` 负责 transport 统一入口、endpoint、header 注入与基础运行时装配
- `shared/graphql` 对普通业务请求提供受控的 reactive refresh
- `auth` feature 继续负责 `login / refresh / restore / forceLogout`
- auth 主流程不交给 `shared/graphql` 自动接管

这不是临时折中，而是当前项目的长线默认方案。

一句话约束：

- `shared/graphql` 统一请求入口
- `auth` 保留认证主权

## 为什么这样收敛

这样做的原因不是“功能不够强”，而是为了让运行时边界更稳定、更容易理解：

- 避免同时存在两套“会话恢复主流程”
- 避免 `me -> refresh -> me` 与共享 middleware 的自动 refresh 互相套娃
- 避免 `shared/graphql` 反向主导 auth feature 的登录态决策
- 让没有当前上下文的人或 AI 也能快速判断“谁负责什么”

当前更看重：

- 边界清晰
- 主权单一
- 行为可预测

而不是：

- 让共享层尽可能“聪明”

## shared/graphql 负责什么

当前 `shared/graphql` 负责：

- GraphQL endpoint 读取
- Apollo client/runtime 初始化
- app 启动阶段的最小 runtime 装配
- 请求执行入口 `executeGraphQL`
- 默认从当前 auth session 读取 token 并注入 `Authorization`
- 显式公开请求的 `authMode: 'none'`
- 普通业务请求收到 `type: 'auth'` 后的一次性 refresh / retry 编排
- 为 React 集成提供 `ApolloProvider` 所需 client

当前 `shared/graphql` 不负责：

- `login`
- `refresh`
- `restore`
- `forceLogout`
- auth 主流程（`me` 水合、`restore -> refresh -> me`）的 retry
- protected route 进入前的主动安全检查
- 会话失效后如何跳转（由 app 层 watcher 负责）

## auth feature 负责什么

当前 auth 主流程继续由 `features/auth` 掌管：

- `login`
- `refresh`
- `restore`
- `logout`
- `forceLogout`
- 会话快照维护
- 本地 session 持久化
- `me` 水合后的当前会话重建
- protected route / 页面显式边界上的主动续期（`ensureFreshSession()`）
- refresh single-flight（`ensureFreshPromise`）

一句话要求：

- 认证主流程只在 auth feature 内闭环，不上抬到 `shared/graphql`

## 当前请求语义

当前 GraphQL 调用分两类：

### 1. Protected request

- 默认语义
- 从当前 auth session 读取 token
- 由请求方自己决定失败后如何处理

### 2. Public request

- 必须显式声明 `authMode: 'none'`
- 不带默认 `Authorization`
- 不参与当前会话语义

典型 public request 包括：

- `login`
- `refresh`
- public auth（忘记密码、重置密码、验证链接等）

## 后端 auth error 信号

当前后端真相以 `docs/backend/domain-error.ts` 与 `docs/backend/graphql-exception.filter.ts` 为准：

- `extensions.code` 是 GraphQL 标准大类
- `extensions.errorCode` 是后端细粒度错误码
- 生产环境默认不透出 `extensions.errorCode`

当前 JWT 相关错误在后端都会归到 `UNAUTHENTICATED`：

- `JWT_TOKEN_EXPIRED`
- `JWT_TOKEN_INVALID`
- `JWT_TOKEN_NOT_BEFORE`
- `JWT_TOKEN_VERIFICATION_FAILED`
- `JWT_AUTHENTICATION_FAILED`

`INVALID_REFRESH_TOKEN` 较特殊：

- 它发生在 `refresh` mutation 中
- 后端当前未将其映射到 `UNAUTHENTICATED`
- 前端会看到 `extensions.code = 'BAD_USER_INPUT'`
- 因此它最终会落到 `GraphQLIngressError.type = 'graphql'`，而不是 `type = 'auth'`

## 当前请求层 reactive refresh 边界

当前 `shared/graphql` 的 `executeGraphQL` 已具备受控的 reactive refresh：

- 触发信号基于 `GraphQLIngressError.type === 'auth'`
- 不依赖 `extensions.errorCode` 作为主开关，因为生产环境会抹掉该字段
- 普通业务请求（`authMode` 默认为 `required` 且 `allowAuthRetry` 未显式禁用）收到 `type: 'auth'` 后，触发一次 `refreshSession`
- `refreshSession` 由 app bridge 注入，内部调用 `ensureFreshSession({ force: true })`，复用 auth feature 的 single-flight
- 成功后重放原请求一次（仅一次，不循环）
- 失败后调用 `onAuthFailure`（当前为 `forceLogout()`）

以下请求不参与 reactive refresh：

- `authMode: 'none'` 的所有请求
- `allowAuthRetry: false` 的请求（auth 主流程统一标记此选项）

这条能力的约束是：

- `shared/graphql` 自身不决定 refresh 如何执行，只通过 bridge 调用
- `shared/graphql` 自身不决定 auth failure 后如何跳转，只通过 `onAuthFailure` 回调
- auth 主流程不会进入 shared retry，其闭环仍在 `features/auth` 内部
- `force: true` 只用于“服务端已经实际拒绝了当前 token”的 reactive 路径，不改变 router 中的主动安全检查语义

## 当前续期双机制

当前项目存在两条续期路径，共享同一套 single-flight：

### 1. 主动续期（proactive）

- `ensureFreshSession()` 由 auth feature 提供
- 它在 route loader、页面进入前这类显式边界调用
- 先看当前 token 是否临近过期（当前阈值：过期前 60 秒）
- 若仍足够新鲜，则直接复用当前 snapshot
- 若已接近过期，则由 auth feature 主动调用 `refresh`
- 多个边界同时触发时，只允许一个 `refresh` 在飞（`ensureFreshPromise`）
- 失败后的 redirect / UI 反馈仍由调用方决定

### 2. 兜底续期（reactive）

- 由 `executeGraphQL` 的外层编排承载
- 普通业务请求收到 `type: 'auth'` 后，通过 bridge 调用 `refreshSession`
- bridge 内部调用 `ensureFreshSession({ force: true })`，强制跳过客户端 `isTokenFresh` 判断
- 成功后重放原请求一次
- 失败后调用 `onAuthFailure`
- auth 主流程通过 `allowAuthRetry: false` 排除在外

两条路径通过 `ensureFreshPromise` 共享 single-flight，不会产生并发 refresh。

### 会话失效后的导航

`forceLogout()` 只负责清除 session 状态，不负责导航跳转。

跳转由 app 根部的 auth state watcher 承载：

- 监听 auth state 从 `authenticated` 变为 `unauthenticated`
- 若当前路径属于 protected area，则 `window.location.replace` 到 `/login?redirect=当前路径`
- 若当前路径已在 public area（login、forgot-password 等），则不跳转
- 使用硬跳转而非 `router.navigate`，因为 forceLogout 后 app state 不可信

public 白名单当前包括：

- `/login`
- `/forgot-password`
- `/reset-password`
- `/invite/`
- `/verify/`
- `/magic-link/`

## 当前长线方案

当前项目长期按以下口径执行：

- HTTP GraphQL 请求统一走 `shared/graphql`
- `shared/graphql` 负责 transport/runtime + 普通业务请求的 reactive refresh
- `features/auth` 长期负责 `login / refresh / restore / logout / forceLogout`
- auth 主流程通过 `allowAuthRetry: false` 排除在 shared retry 之外
- `authMode: 'required' | 'none'` 作为稳定请求语义长期保留
- router 中的 `ensureFreshSession()` 是主动安全检查，请求层 reactive refresh 是兜底
- `onAuthFailure` 只负责宣布会话失效；真正的页面跳转由 app 根部 watcher 响应 auth state 变化

## WS 边界

`ws / subscription` 不改变上述长线方案，但它有一条单独边界：

- HTTP 请求可以在每次发起时读取当前 token
- WS 连接通常只在建连时读取当前 token
- 因此 WS 不能直接套用 HTTP 的“请求时现读 token”语义

当前项目对 WS 的长期约束是：

- 在没有真实 subscription 主线需求前，WS 只算预埋能力，不算当前 auth 语义承诺的一部分
- 一旦启用 WS，token 变化时必须按需重连
- 登出、切账号、强制失效时必须断开旧连接
- 不允许把现有 WS 连接当成当前会话真源

因此，当前长线方案对 HTTP/auth 是稳定的；对 WS，则要求后续启用时补齐“token 变化 -> 重连”规则，而不是默认沿用 HTTP 语义。

## 显式 accessToken 与 reactive retry 的约束

当前 reactive retry 的重放逻辑会清除请求级显式 `accessToken`（`options.accessToken = undefined`），让重放请求通过 runtime bridge 的 `getAccessToken()` 读取刷新后的最新 token。

这个策略的前提假设是：

- 调用方传入的显式 `accessToken` 代表的是当前 session 的 token
- refresh 成功后，`getAccessToken()` 返回的就是正确的替代值

对当前仓库中的所有调用点，这个假设成立：

- `src/features/profile-completion/infrastructure/profile-completion-api.ts` — 传入当前 session 的 `accessToken`
- `src/features/auth/infrastructure/auth-api.ts` — 传入当前 session 的 `accessToken`（且已通过 `allowAuthRetry: false` 排除 retry）

**约束：**

- 如果未来出现传入非当前 session 的专用 token 场景（例如第三方服务 token、临时凭证等），该请求必须同时传 `allowAuthRetry: false`
- 否则 retry 会用当前 session token 替换原始 token，导致语义错误
- 这条规则适用于所有通过 `executeGraphQL` 的调用方

## 与 React 的边界

- runtime 必须可脱离 React 工作
- runtime 当前由 app bootstrap 注入 `getAccessToken`、`refreshSession`、`onAuthFailure`
- `GraphQLProvider` 只负责 React 集成
- 运行时 bootstrap 在 app 启动阶段完成
- 不能把 GraphQL runtime 主权藏进 provider 生命周期

## 相关文档

- [graphql-error-model.md](./graphql-error-model.md)
- [identity-access-session.md](./identity-access-session.md)
- [../dependency-rules.md](../dependency-rules.md)
- [../../plans/graphql-ingress-plan.md](../../plans/graphql-ingress-plan.md)
