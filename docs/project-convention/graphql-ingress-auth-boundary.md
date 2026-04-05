<!-- docs/project-convention/graphql-ingress-auth-boundary.md -->

# GraphQL Ingress Auth Boundary

本文件定义当前项目里 GraphQL 共享入口与 auth feature 的职责边界。

它回答的是：

- 所有 GraphQL 请求为什么统一走 `shared/graphql`
- 为什么当前不让 `shared/graphql` 自动接管 `refresh`
- `auth` 与 `shared` 各自负责什么

## 当前结论

当前项目采用以下规则：

- 所有 GraphQL 请求统一走 `src/shared/graphql`
- `shared/graphql` 负责 transport 统一入口、endpoint、header 注入与基础运行时装配
- `auth` feature 继续负责 `login / refresh / restore / forceLogout`
- auth 主流程当前不交给 `shared/graphql` 自动接管

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
- 为 React 集成提供 `ApolloProvider` 所需 client

当前 `shared/graphql` 不负责：

- `login`
- `refresh`
- `restore`
- `forceLogout`
- 根据 `401 / UNAUTHENTICATED` 自动发起 refresh
- 自动决定何时发起 refresh
- 自动决定会话失效后如何推进 auth 状态

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

## 当前明确不做的事

当前阶段，`shared/graphql` 明确不做：

- `401 / UNAUTHENTICATED -> refresh -> retry`

原因：

- 这会与 auth feature 自己的 `restore / refresh / hydrate` 主流程形成双主权
- 共享层一旦自动接管 refresh，就必须回答“refresh 失败后谁负责 forceLogout”
- auth 主流程与共享 middleware 混写后，调用链更难排查，也更不利于 AI 理解

当前明确担心：

- `me` 失败后，auth 自己要不要 refresh，与 shared middleware 要不要 refresh 发生重叠
- 共享层开始反向主导 auth 语义
- 实现上出现防重入开关、隐式例外和难解释的恢复链

因此当前结论是：

- 不为了“更自动”牺牲 auth 主权清晰度

## 当前长线方案

除非未来出现明确且持续的业务压力，否则当前项目长期按以下口径执行：

- HTTP GraphQL 请求统一走 `shared/graphql`
- `shared/graphql` 长期只负责 transport/runtime，不接管 auth 主流程
- `features/auth` 长期负责 `login / refresh / restore / logout / forceLogout`
- `authMode: 'required' | 'none'` 作为稳定请求语义长期保留

这套口径默认视为长期约束，而不是等待被更“自动”的 shared auto-refresh 替换。

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

## 如果将来要重新引入 auto-refresh

只有在以下前提都满足后，才重新评估：

- auth feature 与 session 主权已经稳定
- 已有明确业务场景需要共享层自动补救
- 已补齐针对 `401 / UNAUTHENTICATED`、并发请求、失败路径的自动化测试

即便未来重新引入，也应遵守：

- 只针对普通业务请求评估
- 不自动接管 auth feature 自己的 `login / refresh / restore / me`
- 不让 `shared/graphql` 成为 auth 主权来源

## 与 React 的边界

- runtime 必须可脱离 React 工作
- runtime 当前只由 app bootstrap 注入 `getAccessToken`
- `GraphQLProvider` 只负责 React 集成
- 运行时 bootstrap 在 app 启动阶段完成
- 不能把 GraphQL runtime 主权藏进 provider 生命周期

## 相关文档

- [identity-access-session.md](./identity-access-session.md)
- [../dependency-rules.md](../dependency-rules.md)
- [../../plans/graphql-ingress-plan.md](../../plans/graphql-ingress-plan.md)
