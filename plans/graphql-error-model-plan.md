# GraphQL Error Model Plan

本计划描述 `shared/graphql` 的错误模型如何收口。

它解决的问题是：

- `executeGraphQL()` 当前仍会直接抛普通 `Error` 或 Apollo 原始异常
- feature 层还没有稳定的 transport 错误消费方式
- AIGC 和后续维护者还无法用一套短规则判断“什么该抛，什么该返回”

一句话结论：

- 基础设施错误统一抛 `GraphQLIngressError`
- 业务 payload 失败继续由 feature 自己解释
- 当前项目优先保留原始排错信息，不追求把所有错误都包装成重型框架

## 当前范围

本轮只处理 GraphQL ingress 的基础设施错误，不处理：

- auth 主流程重构
- shared auto-refresh
- 页面跳转
- domain payload 的业务失败建模

## 当前固定边界

### 1. 基础设施错误

来源包括：

- 网络不可达、超时、请求中断
- HTTP 非 2xx
- GraphQL `errors`
- `401` 或 `UNAUTHENTICATED`
- 返回成功但没有合法 `data`

这类错误统一由 `shared/graphql` 归一，并抛出：

- `GraphQLIngressError`

推荐最小分类：

- `network`
- `http`
- `graphql`
- `auth`
- `malformed`

### 2. 业务 payload 失败

来源包括：

- `success: false`
- `reason`
- `message`

这类错误不进入 `GraphQLIngressError` 主模型。

约束：

- 继续由 feature / domain API 自己解释
- 能返回显式结果时，优先返回显式结果
- 不为了“统一”把所有业务失败强行抬成基础设施异常

### 3. 应用流程错误

来源包括：

- 会话恢复失败后的强制登出
- 资料补全后仍需补全
- 路由守卫与跳转

这类错误不属于 GraphQL ingress。

约束：

- 继续留在 auth / application / router / page 层
- 不放进 `GraphQLIngressError`

## 目标模型

建议最小接口：

```ts
type GraphQLIngressErrorType = 'network' | 'http' | 'graphql' | 'auth' | 'malformed';

class GraphQLIngressError extends Error {
  readonly type: GraphQLIngressErrorType;
  readonly statusCode?: number;
  readonly operationName?: string;
  readonly graphqlErrors?: readonly GraphQLFormattedError[];
  readonly isRetryable: boolean;
  readonly cause?: unknown;
}
```

辅助接口建议同时提供：

- `isGraphQLIngressError(error)`
- `toGraphQLIngressError(error, context)`

## AIGC 友好规则

后续实现和生成代码时，默认按下面 4 条理解：

1. `shared/graphql` 只抛一种基础设施异常：`GraphQLIngressError`
2. feature 不直接消费 Apollo 原始异常
3. payload 业务失败优先返回显式结果，而不是抛基础设施异常
4. 不依赖 `error.message.includes(...)` 判断 transport 错误类别

一句话理解：

- transport failure 用异常
- domain failure 用显式结果
- application flow 自己推进

## 透传策略

当前项目是内部系统，排错效率优先。

因此本轮策略不是“吞掉原始异常细节”，而是：

- 统一异常形状
- 最大限度保留原始排错信息

具体要求：

- `GraphQLIngressError.message` 尽量保留原始可读信息
- `cause` 保留原始异常
- 若可稳定提取，保留 `statusCode`
- 若可稳定提取，保留 `graphqlErrors`
- 不在 shared 层提前改写 domain 级 message

## 当前不做的事

- 不把所有 feature 的业务失败统一建成同一错误类
- 不要求后端先改错误格式
- 不把 `GraphQLIngressError` 和页面提示文案强绑定
- 不在这一轮引入 result-style 主接口

## 与后端的关系

本轮默认不要求后端配合更新。

原因：

- 第一阶段只做前端归一
- 继续消费当前已有的 HTTP 状态、GraphQL `errors` 和 payload `message / reason`

只有在后续要进一步减少字符串判断时，才再评估是否推动后端补稳定 `extensions.code` 或业务错误码。

## 建议落地顺序

### P0

- 新增 `src/shared/graphql/errors.ts`
- 定义 `GraphQLIngressError`
- 定义 `isGraphQLIngressError()` 与 `toGraphQLIngressError()`

### P1

- 在 `executeGraphQL()` 中统一包裹 Apollo / transport 异常
- 把“未返回 data”收口为 `malformed`
- 保证 `executeGraphQL()` 不再直接抛普通 `Error`

### P2

- 先迁 `public-auth` 使用 `error.type`
- 减少基于 `error.message` 的 transport 判断

### P3

- 再评估 auth / profile-completion 等 authenticated 调用方是否需要细化消费
- 视真实需要再决定是否补更多字段或 helper
