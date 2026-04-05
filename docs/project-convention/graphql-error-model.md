<!-- docs/project-convention/graphql-error-model.md -->

# GraphQL Error Model

本文件定义当前项目里 `shared/graphql` 的稳定基础设施错误模型。

它回答的是：

- `executeGraphQL()` 现在统一抛什么
- 哪些错误属于 GraphQL ingress，哪些不属于
- 面向用户的默认错误提示口径是什么

## 当前结论

当前项目采用以下规则：

- `shared/graphql` 只抛一种基础设施异常：`GraphQLIngressError`
- 业务 payload 失败继续由 feature 自己解释，不进入 ingress error 模型
- application / router / auth flow 自己的流程推进不进入 ingress error 模型

一句话约束：

- transport failure 用 `GraphQLIngressError`
- domain failure 用显式结果
- application flow 自己推进

## 错误分类

当前 `GraphQLIngressError.type` 固定为 5 类：

- `network`
- `http`
- `graphql`
- `auth`
- `malformed`

硬约束：

- `GraphQLIngressError` 只用于这 5 类基础设施错误
- 不允许把 payload 内部的 `success: false`、`reason`、`message` 混入 `GraphQLIngressError`
- 不允许因为接口同样走 GraphQL，就把业务失败误归到 `graphql`

## 各类型语义

### `network`

来源包括：

- 网络不可达
- 请求中断
- 浏览器原生 fetch 网络错误

默认用户提示：

- 网络连接异常，请稍后重试。

### `http`

来源包括：

- HTTP 非 2xx

默认用户提示：

- 服务暂时不可用，请稍后重试。

### `graphql`

来源包括：

- top-level GraphQL `errors`
- 未命中已知 Apollo transport 分类、但仍属于当前 GraphQL 执行失败的异常

约束：

- 不含已归入 `auth` 的 `UNAUTHENTICATED`

默认用户提示：

- 请求处理失败，请稍后重试。

### `auth`

来源包括：

- HTTP `401`
- top-level GraphQL `errors[].extensions.code === 'UNAUTHENTICATED'`

判断顺序固定为：

1. 先判断 HTTP 层是否已稳定暴露 `401`
2. 若没有 `401`，再判断 top-level GraphQL `errors[].extensions.code === 'UNAUTHENTICATED'`
3. 命中后统一归入 `auth`

默认用户提示：

- 登录状态已失效，请重新登录后再试。

### `malformed`

来源包括：

- Apollo 已成功 resolve，但返回结果没有合法 `data`
- 2xx 响应无法解析为合法 JSON

约束：

- 如果 Apollo 已因 top-level `errors` reject，即使没有 `data`，也仍归入 `graphql` 或 `auth`
- 不允许把 Apollo 已判定为 GraphQL 执行失败的 reject 再二次改判成 `malformed`

默认用户提示：

- 返回结果异常，请稍后重试。

## GraphQLIngressError 结构

当前稳定字段包括：

- `type`
- `statusCode?`
- `operationName?`
- `graphqlErrors?`
- `isRetryable`
- `cause?`
- `userMessage`

当前 `toGraphQLIngressError()` 的最小输入上下文固定为：

```ts
type GraphQLIngressErrorContext = {
  operationName?: string;
};
```

约束：

- 第一版 `context` 只补充稳定、轻量、与执行器直接相关的诊断信息
- 当前只要求 `operationName`
- 不把它扩成任意 metadata 桶

## isRetryable 规则

当前默认赋值规则为：

- `network`: `true`
- `http`: `statusCode >= 500`
- `graphql`: `false`
- `auth`: `false`
- `malformed`: `false`

约束：

- `isRetryable` 只表达“从基础设施角度看，是否值得重试”
- 它不等于 `shared/graphql` 当前会自动重试

## Apollo 4.x 映射

当前项目使用 Apollo Client 4.x，`toGraphQLIngressError()` 按以下顺序归一：

1. `CombinedGraphQLErrors`
2. `ServerError`
3. `ServerParseError`
4. `TypeError` / network 类错误
5. `DOMException` name `AbortError`
6. 其他未知 `Error`

映射规则：

- `CombinedGraphQLErrors`
  - 若含 `UNAUTHENTICATED` → `auth`
  - 否则 → `graphql`
- `ServerError`
  - `401` → `auth`
  - 其他 → `http`
- `ServerParseError`
  - 非 2xx → `http`
  - 2xx → `malformed`
- `TypeError` / `AbortError`
  - → `network`
- 其他未知 `Error`
  - → `graphql`

约束：

- 使用 Apollo 4.x 提供的 `.is()` 静态方法做类型窄化
- 不使用 `instanceof ApolloError`
- 不把 `LinkError.is()` 作为分类依据

## 透传与用户提示

当前项目是内部系统，排错效率优先。

因此当前策略是：

- 统一异常形状
- 最大限度保留原始排错信息
- 面向用户时统一使用简洁中文兜底文案

具体要求：

- `GraphQLIngressError.message` 尽量保留原始可读信息
- `cause` 保留原始异常
- 若可稳定提取，保留 `statusCode`
- 若可稳定提取，保留 `graphqlErrors`
- 页面、表单与 workflow 面向用户展示时，不直接暴露底层英文报错、Apollo 原始异常或技术细节
- feature 若已有更具体、已验证过的业务提示，可覆盖默认 `userMessage`

## 与当前分层的关系

- `shared/graphql` 负责 transport/runtime 错误归一
- feature 负责解释业务 payload 失败
- `public-auth` 这类 feature 可以识别 `GraphQLIngressError`，但不直接依赖 Apollo 原始异常

## 当前不做的事

- 不把所有 feature 的业务失败统一建成同一错误类
- 不要求后端先改错误格式
- 不把页面提示文案强绑定到后端原始错误消息
- 不把 Apollo `ErrorLink` 作为当前实现前提

## 相关文档

- [graphql-ingress-auth-boundary.md](./graphql-ingress-auth-boundary.md)
- [identity-access-session.md](./identity-access-session.md)
- [../../plans/graphql-error-model-plan.md](../../plans/graphql-error-model-plan.md)
