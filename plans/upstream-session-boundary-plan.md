<!-- plans/upstream-session-boundary-plan.md -->

# Upstream Session Boundary Plan

> 状态：`已实施`（2026-06-14）

## 背景

当前 upstream 会话能力已经有一部分放在 `entities/upstream-session`，但真正携带
`upstreamSessionToken` 访问后端 upstream 代理接口的逻辑散落在多个 feature / labs API
中。

这造成两个问题：

- upstream 会话恢复、过期识别、GraphQL retry / logout 策略被各业务 API 重复实现。
- 本站 `accessToken / refreshToken` 与 upstream `upstreamSessionToken` 字段名虽不同，但
  GraphQL `auth` 错误策略混在一起，upstream token 过期可能被误判为本站登录态失效。

## 决策

- upstream session 是稳定业务对象，统一归入 `entities/upstream-session`。
- 业务 feature 只声明“当前请求需要 upstream session”，不自行决定 GraphQL auth retry /
  logout 策略。
- `shared/graphql` 只负责本站 GraphQL transport 与本站 auth reactive refresh，不直接理解
  upstream 业务语义。
- `entities/upstream-session` 公开统一 upstream GraphQL adapter：
  - 允许本站 `accessToken` reactive refresh。
  - refresh 后 retry 仍返回 auth error 时，不触发本站 `forceLogout`。
  - 错误继续抛回页面，由页面打开 upstream 登录 / 恢复流程。
- upstream 登录 / 刷新自身继续使用 `allowAuthRetry: false`，不参与本站 auth reactive
  refresh。
- 前端会话字段统一使用 `upstreamSessionToken`；若后端 schema 参数叫 `sessionToken`，只在
  adapter 或 infrastructure 映射层出现。

## P0：请求边界收敛

- 在 `entities/upstream-session` 增加 `executeUpstreamSessionGraphQL()`。
- 将携带 upstream token 的业务 API 改为调用该 adapter。
- 移除 feature / labs 中重复的 `UPSTREAM_SESSION_GRAPHQL_OPTIONS`。
- 将原 `shared/upstream` 中的 staff directory 能力迁入 `entities/upstream-session`
  公开出口。
- 保持现有页面交互不变：
  - upstream 过期仍由页面识别并打开 upstream 登录弹窗。
  - 本站 refresh token 失效仍回到 `/login`。

## P1：命名与错误模型收敛

- feature 内部输入统一使用 `upstreamSessionToken`。
- 后端变量名 `sessionToken` 只保留在 GraphQL infrastructure 映射处。
- 如后端错误契约稳定，新增 upstream 专用错误类型或 mapper，避免页面直接依赖
  `GraphQLIngressError.type === 'auth'` 判断 upstream 过期。

## 验收

- upstream token 过期时，页面不跳本站 `/login`。
- 本站 access token 过期但 upstream token 有效时，请求可刷新本站 token 后成功重放。
- 本站 refresh token 失效时，仍正常触发本地会话失效流程。
- `rg "UPSTREAM_SESSION_GRAPHQL_OPTIONS" src/features src/labs` 无结果。
- upstream staff directory 不再从 `shared/upstream` 暴露给业务层。

## 实施记录

- `entities/upstream-session` 新增 `executeUpstreamSessionGraphQL()`，集中 upstream
  proxy 请求的本地登出隔离策略。
- staff directory 已从 `shared/upstream` 迁入 `entities/upstream-session` 并通过公共 barrel
  暴露。
- 携带 `upstreamSessionToken` 的 feature / labs API 已改为调用 upstream session adapter。
- entity 公共 API 与业务调用面已统一使用 `upstreamSessionToken`，后端 `sessionToken` 只保留在
  GraphQL 变量映射处。
- feature / labs 测试不再直接断言 `logoutOnRetryAuthFailure`，该策略由 upstream session
  adapter 单测覆盖。
