# GraphQL Error Model Plan

本计划描述 `shared/graphql` 的错误模型如何收口。

它解决 3 个问题：

- `executeGraphQL()` 当前仍会直接抛普通 `Error` 或 Apollo 原始异常
- feature 层还没有稳定的 transport 错误消费方式
- AIGC 和后续维护者还不能用一套短规则判断“什么该抛，什么该返回”

一句话结论：

- 基础设施错误统一抛 `GraphQLIngressError`
- 业务 payload 失败继续由 feature 自己解释
- 当前项目优先保留原始排错信息，不把所有错误都包装成重型框架

## 当前范围

本轮只处理 GraphQL ingress 的基础设施错误，不处理：

- auth 主流程重构
- shared auto-refresh
- 页面跳转
- domain payload 的业务失败建模

## 固定边界

### 1. 基础设施错误

来源包括：

- 网络不可达、超时、请求中断
- HTTP 非 2xx
- GraphQL `errors`（不含已归入 `auth` 的 `UNAUTHENTICATED`）
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

硬约束：

- `GraphQLIngressError` 只用于这 5 类基础设施错误
- top-level GraphQL `errors` 归入 `graphql`
- 不允许把 payload 内部的 `success: false`、`reason`、`message` 混入 `GraphQLIngressError`

`auth` 的归属判断顺序也需要固定：

1. 先判断 HTTP 层是否已稳定暴露 `401`
2. 若没有 `401`，再判断 top-level GraphQL `errors[].extensions.code === 'UNAUTHENTICATED'`
3. 只有命中以上两类时才归为 `auth`

约束：

- `401` 与 `UNAUTHENTICATED` 最终都归入 `auth`
- 但实现上必须保留“HTTP 401 优先、GraphQL code 次之”的判断顺序
- 不把其他 GraphQL `extensions.code` 误并到 `auth`

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
- 不允许因为后端接口同样走 GraphQL，就把业务失败误归到 `graphql` 类型

### 3. 应用流程错误

来源包括：

- 会话恢复失败后的强制登出
- 资料补全后仍需补全
- 路由守卫与跳转

这类错误不属于 GraphQL ingress。

约束：

- 继续留在 auth / application / router / page 层
- 不放进 `GraphQLIngressError`

一句话理解：

- transport failure 用异常
- domain failure 用显式结果
- application flow 自己推进

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

`toGraphQLIngressError()` 当前建议的最小输入契约应固定为：

```ts
type GraphQLIngressErrorContext = {
  operationName?: string;
};
```

约束：

- 第一版 `context` 只用于补充稳定、轻量、与执行器直接相关的诊断信息
- 当前只要求 `operationName`
- 不把它扩成任意 metadata 桶
- 若未来确实需要新增字段，应先证明该字段是跨调用方稳定复用的，而不是某个 feature 的临时调试信息

当前理由：

- `executeGraphQL()` 已经能稳定拿到 `operationName`
- `operationName` 对排错和日志定位有直接价值
- 若一开始允许任意 metadata，后续很容易让错误模型重新耦合 feature 细节

`isRetryable` 当前也需要固定最小赋值规则：

- `network`：`true`
- `http`：
  - `5xx` 为 `true`
  - `4xx` 为 `false`
- `graphql`：默认 `false`
- `auth`：`false`
- `malformed`：`false`

约束：

- `isRetryable` 只表达“从基础设施角度看，是否值得重试”
- 它不等于“shared/graphql 当前会自动重试”
- 当前阶段不要为单个 feature 的局部策略改写这套默认值

## Apollo 4.x 错误类型映射

当前项目使用 Apollo Client 4.x，其错误体系与 3.x 不同，不再使用 `ApolloError`。

`toGraphQLIngressError()` 必须按以下映射处理 Apollo 4.x 的具体错误类型：

| Apollo 4.x 类型                  | 判断方式                                                        | 映射到                                                                | 说明                                |
| -------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| `CombinedGraphQLErrors`          | `.is()`                                                         | 先检查 `errors` 中是否含 `UNAUTHENTICATED` → `auth`；否则 → `graphql` | 保留 `.errors` 到 `graphqlErrors`   |
| `ServerError`                    | `.is()`                                                         | `statusCode === 401` → `auth`；否则 → `http`                          | 保留 `.statusCode`                  |
| `ServerParseError`               | `.is()`                                                         | `statusCode` 非 2xx → `http`；`statusCode` 为 2xx → `malformed`       | 响应无法解析为 JSON                 |
| `TypeError` / network 类         | `message` 含 `Failed to fetch` / `NetworkError` / `Load failed` | `network`                                                             | 浏览器原生 fetch 网络错误           |
| `DOMException` name `AbortError` | `error.name`                                                    | `network`                                                             | 请求中断                            |
| 其他未知 `Error`                 | fallback                                                        | `network`                                                             | 未知 transport 错误保守归为 network |

约束：

- 判断顺序固定为上表从上到下
- Apollo `.is()` 静态方法是 4.x 推荐的类型窄化方式，不使用 `instanceof`
- 不把 Apollo 4.x 的 `LinkError.is()` 作为分类依据，它只用于检测"是否来自 link chain"，不携带类型信息

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

## 面向用户的默认错误文案

虽然内部排错优先，但面向用户的默认反馈仍应保持统一中文口径。

约束：

- 但页面、表单与 workflow 面向用户展示时，不直接暴露底层英文报错、Apollo 原始异常或技术细节
- 默认反馈文案应使用符合当前项目调性的简洁中文

当前建议口径：

- `network`：网络连接异常，请稍后重试
- `http`：服务暂时不可用，请稍后重试
- `graphql`：请求处理失败，请稍后重试
- `auth`：登录状态已失效，请重新登录后再试
- `malformed`：返回结果异常，请稍后重试

补充要求：

- 这是默认兜底文案，不替代 feature 自己已有的业务提示
- 若某个页面已有更具体、已验证过的中文反馈，可在不破坏错误分类边界的前提下覆盖默认文案
- 不把后端原始错误消息直接当作最终用户提示

## AIGC 友好规则

后续实现和生成代码时，默认按下面 4 条理解：

1. `shared/graphql` 只抛一种基础设施异常：`GraphQLIngressError`
2. feature 不直接消费 Apollo 原始异常
3. payload 业务失败优先返回显式结果，而不是抛基础设施异常
4. 不依赖 `error.message.includes(...)` 判断 transport 错误类别

## 当前不做的事

- 不把所有 feature 的业务失败统一建成同一错误类
- 不要求后端先改错误格式
- 不把 `GraphQLIngressError` 和页面提示文案强绑定
- 不在这一轮引入 result-style 主接口
- 不把 Apollo `ErrorLink` 作为当前 P0 的前置条件

## 与 Apollo ErrorLink 的关系

当前判断固定为：

- `executeGraphQL()` 仍是当前 GraphQL imperative 主入口
- `toGraphQLIngressError()` 第一版先在 `executeGraphQL()` 中落地
- `ErrorLink` 不是当前 P0 的前置条件

原因：

- 当前业务调用主要仍经由 `executeGraphQL()`
- `client.query()` / `client.mutate()` 的 reject 已经能在这一层被统一接住
- `malformed` 这类“返回成功但没有合法 data”的错误，本来就需要在执行器层判断，`ErrorLink` 不能替代

因此当前阶段建议：

- 可以为 link 层未来扩展预留结构位置
- 但不要先放一个没有稳定职责的 `ErrorLink`
- 避免形成“link 归一一部分、executeGraphQL 再归一一部分”的双主权状态

若未来 hooks 成为主调用方式，再重新评估：

- 是否把一部分 transport 错误归一前移到 `ErrorLink`
- 如何让 hooks 和 imperative executor 共享同一套错误模型

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

`malformed` 的触发条件也需要明确区分：

- 只有在执行器已经拿到成功 resolve 的结果、且该结果没有合法 `data` 时，才归为 `malformed`
- 若 Apollo 因 top-level GraphQL `errors` 直接 reject，即使最终没有 `data`，也仍归为 `graphql` 或 `auth`

也就是说，当前至少要区分两种“没有 data”的来源：

1. Apollo 成功 resolve，但 `result.data` 为空
   这才属于真正的 `malformed`
2. Apollo 因 top-level `errors` reject，导致调用方没有 `data`
   这属于 `graphql`，若 code 为 `UNAUTHENTICATED` 则属于 `auth`

实现约束：

- 不允许把 Apollo 已经判定为 GraphQL 执行失败的 reject 再二次改判成 `malformed`
- `malformed` 只保留给“transport 成功，但响应契约不合法”这类情况

### P2

- 先确认 `executeGraphQL()` 已稳定产出 `GraphQLIngressError`
- 再迁 `public-auth` 使用 `error.type`
- 停止依赖 `error.message` 做 transport 分类；字符串匹配只保留给少量 verification 业务 reason 的兼容 fallback

`public-auth` 当前要同时覆盖两条链：

- `resetPassword()` 提交链
- `verifyResetPasswordIntent()` / `loadResetPasswordIntent()` 的 intent lookup 链

当前状态下：

- `resolveVerificationFailureReason()` 仍只认 `Error.message`
- `toResetPasswordResult()` 只覆盖 resetPassword submit 链
- intent lookup 链虽然已经在 workflow 层有 `try/catch`，不会直接崩溃，但 catch 后会直接返回 `reason: 'unknown'`，当前会把 transport 错误类型整体吞掉

这里还需要明确 `resolveVerificationFailureReason()` 的迁移边界：

- 它当前处理的是 verification 业务 reason 的字符串匹配，不是 transport 错误分类
- `GraphQLIngressError.type` 落地后，它不应继续承担 transport 判断
- 若继续保留，它的职责应收敛为：
  - 只在缺少稳定业务 reason 时，作为 verification 业务失败的兼容 fallback
  - 不再负责把 Apollo / transport 异常翻译成业务 reason

因此 P2 的目标不是只改一个 helper，而是分别补齐两条链：

- submit 链：
  - `toResetPasswordResult()` 优先识别 `GraphQLIngressError.type`
  - `resolveVerificationFailureReason()` 只保留 verification 业务 reason 的兼容 fallback
- intent lookup 链：
  - `loadResetPasswordIntent()` 必须补 `GraphQLIngressError` 判断
  - 不能继续把 `network / http / auth / graphql` 全部静默压成 `reason: 'unknown'`
  - `ResetPasswordIntentWorkflowState` 需要新增 `{ status: 'error'; message: string }` 变体，用于承载 transport 错误的用户提示
  - UI 层 `ResetPasswordIntentPanel` 需要处理新增的 `error` 状态，展示错误信息并提供重试引导
  - `findResetPasswordIntent()` 本身无需修改，`GraphQLIngressError` 自然向上传播
- 原有 `message.includes(...)` 只保留给 verification 业务 reason 的兼容 fallback，不再承担 transport 分类

### P3

- 再评估 auth / profile-completion 等 authenticated 调用方是否需要细化消费
- 视真实需要再决定是否补更多字段或 helper

## 落地后的立即补测要求

当前已有的 public-auth transport 负例 E2E，主要覆盖的是 `HTTP 200 + GraphQL errors`。

它们不等于真正的底层 transport failure。

因此本计划一旦完成 `GraphQLIngressError` 落地，必须立即补一组新的 E2E，用来覆盖：

- `network`
- `http`

最小要求：

- `network` 至少命中 intent lookup 链，例如 `findVerificationRecord`
- `http` 至少覆盖一条有明确 UI 反馈出口的链；更稳妥的目标是 submit 链与 intent lookup 链各一条
- 用真实请求失败方式模拟 `network`，例如 request abort / failed request
- 用真实 HTTP 非 2xx 模拟 `http`，例如 `500`
- 不把当前“200 + errors”的 mock 误当成对 `network/http` 的完整覆盖

一句话要求：

- `GraphQLIngressError` 一旦落地，`network/http` 的真实 transport failure E2E 必须紧跟补齐，且不能只打 submit 链
