# GraphQL Ingress Plan

本计划描述前端 GraphQL 调用层的收口方向。

这里的 “ingress” 指的是：

- 前端发起 GraphQL 请求时唯一可信的共享入口
- 负责承接 endpoint、鉴权 header、错误归一、运行时配置等横切能力
- 让 feature 只表达业务 query / mutation，而不再各自管理 transport 细节

本计划关注的是“如何把 GraphQL 入口层收稳”，不是立即把 Apollo hooks、cache、subscription 一次性铺开。

一句话结论：

- 起点是“完全没有 GraphQL 收口，各 feature 自己 fetch”
- 当前意图是“先把 transport 细节收进共享层，并为 Apollo runtime 预埋统一入口”
- 下一步不应急着扩成完整 Apollo 体系，而应先把错误模型、鉴权恢复、调用契约和入口边界收稳

当前规划里的稳定主语应尽量保持中性：

- runtime config
- auth bridge
- error model
- imperative execute contract

当前实现方向明确为：

- `Apollo` 是本项目 GraphQL runtime 的默认底座

但这不意味着对外稳定契约要直接绑定在 Apollo API 或 Apollo 术语上。
因此：

- 规划层仍优先使用 `runtime config / auth bridge / error model / imperative execute contract` 这些中性主语
- `Apollo client / provider / cache / ws link` 主要作为当前实现承载方式来讨论

## 当前实现口径

为保持 auth 主权单一，当前实现先按更保守的口径收敛：

- 所有 GraphQL 请求继续统一走 `shared/graphql`
- `shared/graphql` 当前只负责统一 transport/runtime 入口，不自动接管 refresh
- `auth` feature 继续独占 `login / refresh / restore / forceLogout`
- `401 / UNAUTHENTICATED -> refresh -> retry` 当前不作为共享层默认行为

当前这套口径应视为项目的长线默认方案，不是短期过渡后必然回到 shared auto-refresh。

这样做的原因：

- 避免 auth 自己的 `restore -> refresh -> hydrate` 与共享 middleware 自动 refresh 形成双主权
- 避免实现中出现防重入例外、隐式恢复链和难解释的时序问题
- 让没有当前上下文的人或 AI 更容易理解运行时边界

若未来重新引入 shared auto-refresh，也只针对普通业务请求评估，不自动接管 auth feature 自己的认证主流程。

`ws / subscription` 的长期边界也单独明确：

- 当前不让 WS 反向主导 HTTP ingress 设计
- 若未来启用 WS，必须接受“连接建连时读取 token，token 变化后按需重连”这套规则
- 不允许把现有 WS 连接视为当前会话主权来源

## 起点

在这轮尝试之前，GraphQL 调用基本处于分散状态：

- 各 feature 各自读取 `VITE_GRAPHQL_ENDPOINT`
- 各 feature 各自组装 `fetch`、headers、Authorization
- 各 feature 各自处理 HTTP error / GraphQL error / `data` 缺失
- 相同 transport 逻辑散落在 auth、public auth、profile completion、lab 等位置

这种状态的问题不是“代码重复”这么简单，而是：

- 错误语义容易漂移
- 认证行为不一致
- 后续要接入 Apollo hooks 或 subscription 时没有统一落点
- feature 层承担了过多 transport 责任

## 当前这次尝试表达出来的意图

按当前未提交变更看，意图已经比较明确：

1. 新增 [`src/shared/graphql`](../src/shared/graphql) 作为共享入口雏形
2. 用 [`executeGraphQL`](../src/shared/graphql/request.ts) 先收掉各 feature 内重复的 `fetch` 逻辑
3. 新增 [`GraphQLProvider`](../src/app/providers/graphql-provider.tsx)，把 Apollo runtime 提前接到应用根部
4. 让 [`auth`](../src/features/auth/infrastructure/auth-api.ts)、[`profile-completion`](../src/features/profile-completion/infrastructure/profile-completion-api.ts)、[`public-auth`](../src/features/public-auth/infrastructure/public-auth-api.ts)、[`payload-crypto`](../src/labs/payload-crypto/api.ts) 都开始改走共享入口
5. 提前接入 `@apollo/client`、`graphql`、`graphql-ws`，为未来 subscription / cache / hooks 留出余地

简化理解就是：

- 这次不是想“立刻全面 Apollo 化”
- 而是想先把 GraphQL transport 从 feature 中抽出来
- 同时试探 Apollo 是否适合作为后续 GraphQL runtime 的底座

这个方向是成立的。

## 当前尝试里已经对的部分

- 把 endpoint 读取和 client 创建集中到共享层是对的
- 先让现有 imperative API 继续可用，而不是强推所有调用改成 hooks，是对的
- 先把多个 feature 接到同一执行器上，再讨论 cache / subscription，是对的
- 在应用根部预留 provider 入口也是合理的，只要后续职责边界收清楚

## 当前尝试里还没有收稳的点

当前实现更像“Apollo 驱动的共享请求器”，还不能算真正稳定的 GraphQL ingress。

主要问题如下。

### 1. 统一了发请求，但还没统一失败语义

当前 [`executeGraphQL`](../src/shared/graphql/request.ts) 统一了请求发送方式，但没有定义应用自己的 GraphQL 错误模型。

这会带来几个问题：

- 上层收到的仍然主要是 Apollo 默认异常或简单字符串异常
- feature 仍可能继续依赖 `error.message` 做业务判断
- 一旦 Apollo 对错误拼接方式有变化，上层行为就会漂
- 未来若要区分 `network`、`http`、`graphql`、`unauthenticated`，当前入口层没有稳定出口

### 2. 鉴权仍然是“半共享”

当前 client 已支持 runtime token 注入，但部分调用仍显式传 `accessToken`。

这说明：

- ingress 还没真正接管认证策略
- “默认取当前 session” 与 “显式指定 token” 的边界还不清楚
- 后续若要做 `401 / UNAUTHENTICATED -> refresh -> retry`，当前结构没有明确挂点

### 3. 入口能力还分散在两处

当前横切逻辑一部分在 [`client.ts`](../src/shared/graphql/client.ts)，一部分在 [`request.ts`](../src/shared/graphql/request.ts)。

这在过渡期可以接受，但要尽快定边界：

- 哪些能力必须进共享 middleware
- 哪些能力只属于 imperative executor
- hooks 将来是否必须复用同一套错误 / 鉴权逻辑

否则会出现：

- hooks 走一套逻辑
- `executeGraphQL()` 走另一套逻辑
- 最终共享层名义上统一，实际行为仍分叉

### 4. 当前是“半 Apollo”状态

现在已经有：

- ApolloClient
- ApolloProvider
- InMemoryCache
- GraphQLWsLink

但实际调用仍基本是：

- 字符串 query
- 运行时 `gql(query)`
- `query / mutate` imperative 调用
- 默认 `no-cache`

这不是错误，但不应长期停留在这个中间态。

若决定 Apollo 是 runtime 底座，就应该继续收束；
若只是想借它代替 `fetch`，那引入 provider、cache、ws link 就会偏重。

### 5. WS / subscription 的引入时机偏早

当前 [`client.ts`](../src/shared/graphql/client.ts) 已经创建 ws link。

但从仓库现状看，当前真正落地的主线还不是 subscription。
如果还没有明确的 subscription 需求、断线重连策略、鉴权刷新策略和测试方案，这一层现在更像预埋，而不是当前主线。

预埋不是不行，但它不应反过来主导 ingress 的结构设计。

### 6. `GraphQLProvider` 当前更像 runtime 注入器，不像明确的应用边界

当前这类 provider 曾经很容易被写成 runtime 注入器，它最容易承担的职责是：

- 配置 `getAccessToken`
- 获取 Apollo client
- 挂一个 `ApolloProvider`

但当前实现已经把这条边界收回来了：

- `getAccessToken` 由 app bootstrap 注入
- `GraphQLProvider` 只获取 Apollo client 并包裹 `ApolloProvider`

这里保留这条分析，是为了强调不应再把 runtime bootstrap 搬回 provider。

这里需要补一条更硬的约束：

- runtime 必须可脱离 React 工作
- `GraphQLProvider` 只负责 React 集成，不负责建立唯一运行时语义

原因是当前项目的关键 GraphQL imperative 调用与路由 loader 不依赖 React provider 生命周期；如果把运行时真源头藏进 provider，会与现有 router / session restore 结构冲突。

## 当前阶段建议的目标

本轮不追求“全面 GraphQL 平台化”，而是先达成下面这个更稳的目标：

1. 所有 GraphQL 请求都必须经过共享入口
2. feature 不再直接管理 endpoint / headers / fetch
3. ingress 对外暴露稳定的错误契约
4. ingress 明确承接鉴权注入与未来 refresh 挂点
5. imperative 调用与未来 hooks 调用必须共享同一套横切规则

## 建议的目标分层

建议把 GraphQL 入口分成 5 层来理解，文件名后续可调整，不要求完全按当前命名落地。

### 1. Runtime Layer

职责：

- 读取 endpoint
- 组装 runtime config
- 创建当前 GraphQL client 实例
- 组合当前 transport middleware
- 暴露唯一 runtime 实例

不负责：

- 业务 query 名字
- feature 特有错误文案
- 页面跳转

硬约束：

- runtime 必须可脱离 React 工作
- `GraphQLProvider` 只负责 React 集成，不负责建立唯一运行时语义
- 不允许把关键 GraphQL runtime 主权藏进 React provider 生命周期
- imperative executor、loader、auth restore 等非 React 调用路径，必须能在没有 provider 参与的前提下复用同一 runtime 规则

当前候选文件：

- [`src/shared/graphql/client.ts`](../src/shared/graphql/client.ts)
- [`src/app/providers/graphql-provider.tsx`](../src/app/providers/graphql-provider.tsx)

### 2. Auth Bridge Layer

职责：

- 由 app 层向 GraphQL runtime 注入认证相关能力
- 当前最小桥接只暴露 `getAccessToken`
- 保证 `shared/graphql` 不直接依赖 `features/auth`

当前实现已经按最小桥接收口：

- app bootstrap 注入 `getAccessToken`
- `shared/graphql` 不直接 import `features/auth`
- `GraphQLProvider` 不再承担 runtime 真源初始化

若未来重新评估 shared auto-refresh，再考虑是否扩展 `refreshSession` / `onAuthFailure` 一类能力。

约束：

- 只能由 app 层或更高层注入
- `shared/graphql` 不得直接 import `@/features/auth`
- 不得把 session store、storage 落盘、强制登出主权下沉到共享层

当前更合理的形态是“最小 runtime adapter”，而不是让 GraphQL ingress 直接反调 auth domain。

### 3. Middleware Layer

职责：

- Authorization 注入
- request metadata 注入
- 网络异常归一
- GraphQL error 归一
- subscription transport 策略

这是 ingress 最核心的横切层。
凡是希望 hooks 和 imperative 调用共享的行为，都应优先沉到这里。

当前明确不放进 middleware 的行为：

- `401 / UNAUTHENTICATED -> refresh -> retry`

原因：

- auth feature 已经拥有 `restore / refresh / forceLogout` 主权
- shared middleware 一旦自动接管 refresh，容易与 auth 主流程形成双主权
- 这会把实现重新推回防重入开关、隐式例外和难解释的恢复链

### 4. Executor Layer

职责：

- 给 feature 提供简单稳定的 imperative 执行接口
- 统一 query / mutation 的调用方式
- 承接少量调用级选项，如 `fetchPolicy`、`authMode`、`errorPolicy`

不负责：

- 自己再发明一套独立于 link 的错误语义
- 自己实现一套独立于 runtime 的鉴权策略

当前候选文件：

- [`src/shared/graphql/request.ts`](../src/shared/graphql/request.ts)

当前阶段不把 subscription 句柄、取消、重连、事件流等生命周期混入同一个 executor 契约。
若后续确实需要 subscription，应作为 phase 3 的单独扩展接口设计。

### 5. Domain API Layer

职责：

- 保留各 feature 自己的 query / mutation 定义
- 处理业务结果结构映射
- 决定业务成功 / 失败含义

不再负责：

- endpoint
- headers
- HTTP / GraphQL transport error 解析
- token 注入细节

当前候选文件：

- [`src/features/auth/infrastructure/auth-api.ts`](../src/features/auth/infrastructure/auth-api.ts)
- [`src/features/profile-completion/infrastructure/profile-completion-api.ts`](../src/features/profile-completion/infrastructure/profile-completion-api.ts)
- [`src/features/public-auth/infrastructure/public-auth-api.ts`](../src/features/public-auth/infrastructure/public-auth-api.ts)
- [`src/labs/payload-crypto/api.ts`](../src/labs/payload-crypto/api.ts)

## 需要修改的地方

下面这些项是我认为接下来必须收敛的内容。

### P0：先把 ingress 的职责边界收清楚

- 明确 Apollo 在这里的定位：作为本项目 GraphQL runtime 的默认底座
- 明确 `runtime / auth bridge / middleware / executor / domain api` 分层边界，避免职责继续混写
- 明确 `GraphQLProvider` 只负责 React 集成，不是运行时真源头
- 明确 `executeGraphQL` 作为长期 imperative API 的边界

如果这一步不先定，后续每接一个 feature 都会把入口层继续拉歪。

### P0：落地最小 Runtime Adapter

建议入口层后续提供显式请求语义，例如：

```ts
type GraphQLAuthMode = 'required' | 'none';
```

推荐默认语义：

- `required`：带 token
- `none`：不带 token，也不参与 refresh

这样可以先把“请求是否带鉴权”这件事单独收稳，而不把 auth 恢复策略混进共享层。

这里再补一条硬约束：

- 当前 token 主权始终在前端 auth session
- Apollo runtime 不是 token 真源，也不是独立 session 容器
- Apollo link、client、cache、ws transport 只是在请求发出时消费当前 token
- 不允许把 token 真值长期缓存进 GraphQL runtime，形成第二份独立状态
- 若某层为了性能或库接口需要暂存请求上下文，它也不得覆盖 auth feature 持有的当前 token 真源
- refresh 完成后，runtime 必须重新读取当前 token，再决定后续请求头
- “前端想要请求就要自己带 token” 这条约束继续成立；runtime 代带 header 只是前端内部实现细节，不改变 token 责任归属
- 当前阶段 `ws / subscription` 先不作为主线实现目标
- 但后续一旦启用 `ws`，连接只允许在建连时读取当前 token；token 变化后必须按需重连，不能长期复用携带旧 token 的连接

当前进一步确认：

- `authMode` 默认值为 `required`
- 公开请求应显式声明为 `none`

当前落地口径：

- app bootstrap 只注入 `getAccessToken`
- `shared/graphql` 根据 `authMode` 决定是否带默认 `Authorization`
- `login / refresh / public-auth` 等公开请求显式声明 `authMode: 'none'`
- auth 恢复、续期、失效推进继续留在 `features/auth`

### P0：定义稳定错误模型

需要新增应用自己的 GraphQL 错误抽象，并把它收成可直接落地的最小接口。

至少应区分：

- network error
- http error
- graphql execution error
- unauthenticated / authorization error
- malformed response / missing data

建议的最小草案：

```ts
// src/shared/graphql/errors.ts
export class GraphQLIngressError extends Error {
  readonly type: 'network' | 'http' | 'graphql' | 'auth' | 'malformed';
  readonly statusCode?: number;
  readonly graphqlErrors?: readonly GraphQLFormattedError[];
  readonly isRetryable: boolean;
}
```

建议先把关键抽象收稳：

- `type`：让上层不再依赖字符串匹配判断错误类型
- `isRetryable`：让调用方能快速判断是否值得重试
- `graphqlErrors` / `statusCode`：保留必要的调试与分支信息

当前实现口径明确为：

- ingress 内部统一产出 `GraphQLIngressError`
- `executeGraphQL()` 作为默认主接口，走异常流
- transport error 默认抛出 `GraphQLIngressError`
- 不提供并行的 result 流主接口
- 不得再把 Apollo 默认错误直接暴露给 feature

当前实现口径进一步明确为：

- 入口层提供统一错误拦截器
- response 进入共享层后，先经过统一拦截与归一
- 正常 `data` 默认透传
- transport error 默认抛出 `GraphQLIngressError`
- domain payload 的业务失败不在这一层强行改写

这样做的原因：

- public auth 中已有基于 `error.message` 的业务判断，这很脆弱
- 登录、资料补全、密码找回都需要更稳定的错误可消费性
- 统一错误模型后，UI 才能决定“哪些可以直接展示给用户，哪些只能记录”

当前还要提前注意一个边界：

- GraphQL 存在 `data` 与 `errors` 同时返回的可能
- 本轮先不展开完整 partial data 策略，但不能在设计上把它提前堵死

当前阶段更保守的默认语义是：

- 网络不可达、服务端不可连接、明显的 HTTP 失败、auth 失败、malformed response：直接进入统一错误流
- 正常返回且 `data` 合法：直接透传给 domain API
- 业务返回体里的 `success / reason / message`：继续由 domain 层判断
- 暂不把 partial data 作为默认成功路径

因此，“服务器连不上时直接报错”这个判断是合理的；
它属于明确的 transport failure，不应被透传成业务结果。

### P0：明确鉴权模型与 refresh 边界

当前已经先定下面几件事：

- 默认请求是否总是从当前 auth session 取 token
- 哪些调用允许显式覆盖 token
- `login / refresh / public-auth` 这类请求如何声明“不带默认鉴权”

当前明确不做：

- 由 `shared/graphql` 统一执行 `401 / UNAUTHENTICATED -> refresh -> retry`

当前担心：

- auth 自己的 `restore -> refresh -> hydrate` 与 shared middleware 自动 refresh 形成双主权
- `me -> refresh -> me` 这类认证主链路与共享层重试链路互相套娃
- 为了兜住边界，不得不引入防重入开关、隐式例外和更难解释的时序

因此当前结论是：

- `shared/graphql` 先做统一 transport/runtime
- auth 相关恢复与失效逻辑继续留在 `features/auth`
- 若未来重新评估 shared auto-refresh，必须建立在明确测试和更强 session runtime 抽象之上

### P1：把横切逻辑尽量下沉到 middleware，而不是堆在 executor

建议原则：

- 希望 hooks 与 imperative 调用都共享的逻辑，应下沉到 middleware
- 仅属于调用入口语法适配的逻辑，留在 executor

优先应放进 middleware 的内容：

- Authorization header 注入
- request id / debug metadata
- 错误归一
- subscription 连接鉴权

当前不默认下沉到 middleware 的内容：

- refresh / retry

否则未来一旦页面开始用 `useQuery`，当前 `executeGraphQL()` 内的很多保护都会失效。

### P1：不要长期依赖“字符串 query + 运行时 gql”

当前这种方式适合作为迁移过渡，但不适合长期作为正式入口。

后续至少应走向以下二选一之一：

- 使用 `DocumentNode` / typed document 作为正式入参
- 保留字符串 query 仅作为低频实验接口或 labs 接口

继续长期使用运行时 `gql(query)` 的问题：

- 缺少类型收敛
- operation 级约束只能在运行时发现
- 调用面不容易与 hooks 统一

### P1：推迟对 cache 的野心，先保守收口

当前默认 `no-cache` 是可以接受的。

在以下条件没成立之前，不建议先扩 cache：

- 主要业务 query 的消费方式稳定
- Apollo 是否真会成为主运行时已经确认
- 类型与错误契约已稳定

本轮更适合：

- 保持 query 默认 `no-cache`
- mutation 不依赖 Apollo cache 更新 UI
- 只在确有收益的场景单独引入 `typePolicies`

### P1：明确 `executeGraphQL` 是长期 imperative facade，不是一次性过渡层

`executeGraphQL` 建议保留为长期 API，但角色应明确限制在 imperative 场景。

推荐定位：

- React 组件优先走 hooks
- 非组件场景继续使用 `executeGraphQL`
- 两者必须共享同一套 runtime 与 middleware 行为

典型适用场景：

- auth restore / refresh
- router loader
- bootstrap 过程中的一次性 query
- Web Worker 或其他非 React 运行环境
- labs 或低频实验模块

这意味着：

- `executeGraphQL` 不应消失
- 它不应只服务 mutation，也应能覆盖合法的 imperative query
- 它应该足够薄，只负责调用 client 与转换共享错误类型
- auth、retry、错误归一等横切能力不得继续堆在 executor 内

### P1：WS 能力先降级为可选，不要成为当前主设计驱动

建议先把 subscription 能力视为可选扩展，而不是当前 ingress 的核心目标。

当前更合理的顺序是：

1. 先收稳 HTTP GraphQL ingress
2. 再明确是否真的需要 subscription
3. 有真实消费场景后，再补 ws 重连、鉴权刷新、连接生命周期和测试

建议把“是否接入主链路”写成明确开关，而不是默认启用。

当前建议动作：

- 保留 ws link 工厂或相关代码结构
- 在没有真实 subscription 主线需求前，不把 WS 当成当前 auth 语义承诺的一部分
- 若后续要把“默认关闭”收成硬约束，应再补显式运行时开关或 feature flag

当前进一步确认：

- WS 继续保留在 Apollo 底座能力范围内
- 当前代码仍会在可用时创建 ws link，这里暂不把“默认 feature flag 关闭”写成已落地事实
- 在没有真实 subscription 场景前，不把 WS 视为当前默认主线能力

建议只有在以下条件至少满足后，才考虑默认接入 WS：

- 已有至少一个确认要落地的 subscription 业务场景
- 已有断线重连策略与测试用例
- 已有 subscription 鉴权刷新设计

在这些条件未满足前，WS 只能算预埋能力，不能反过来影响 HTTP ingress 的稳定性判断。

### P2：统一命名与目录结构

当前 `shared/graphql` 是合理起点，但命名还可以再讨论。

可讨论方向：

- `graphql/runtime`
- `graphql/links`
- `graphql/execute`
- `graphql/errors`
- `graphql/provider`

也可以继续保留当前结构，只要边界清晰即可。
这里不是优先级最高的事，但应该在入口层稳定前完成一次收束。

## 建议的推进顺序

### 阶段 1：把“共享入口”从雏形收成稳定边界

产出：

- ingress 分层与职责确定
- 最小 runtime adapter 注入方式确定
- 统一错误模型确定
- 鉴权边界与 `authMode` 策略确定
- `executeGraphQL` 的长期定位确定

### 阶段 1.5：先迁移一个 feature 作为试金石

在大规模迁移前，先挑一个复杂度适中、又能真实验证入口设计的 feature 做试迁移。

当前建议优先选择：

- public auth

优先选它的原因：

- 密码找回 / 重置这类流程对错误提示有明确需求
- 该模块不依赖复杂 session restore 与 refresh 主流程
- 可以先验证统一错误模型是否足够好用
- 可以较低风险地验证 executor 与 domain api 的协作方式

这一阶段的目标不是“先迁掉一个模块算完成”，而是验证 ingress 的核心设计是否真的成立。

建议验收标准：

- `public-auth` 内不再出现基于 `error.message` 的 transport 级业务判断
- 不再依赖 `error.message.includes(...)` 这种字符串匹配方式来判断 network / http / auth / graphql error
- transport error 的分支判断改为基于 `error.type`
- 若需要补充识别后端返回的稳定错误码，可按需读取 `error.statusCode`，以及 `error.graphqlErrors[0]?.extensions?.code`
- 业务返回体中的失败分支，仍优先由 domain payload 自己的 `success / reason / message` 判断，不把这类 domain failure 强行上提为 ingress error
- 迁移后 transport 级逻辑从 feature 中继续缩减，代码量有明显下降
- 迁移完成后，再回头检查当前 ingress 抽象是否需要补字段、补 helper 或调整边界

若 `public-auth` 迁移后仍然不得不频繁回退到字符串错误匹配，说明当前错误模型仍不够稳定，不应继续批量迁移其他 feature。

### 阶段 1.6：补一个 authenticated pilot

`public-auth` 只能验证错误模型和 domain api 边界，无法验证最危险的 authenticated 路径。

因此在批量迁移前，还需要再补一个 authenticated pilot。

当前固定优先选择：

- auth restore + `me`

这一阶段要重点验证：

- loader / imperative 调用在脱离 React provider 的情况下是否仍共享同一运行时行为
- `restore -> me -> refresh -> me` 这条链是否仍只由 auth feature 主导
- `login / refresh / public-auth` 是否都能稳定走 `authMode: 'none'`

建议验收标准：

- auth restore 失败路径不被 shared middleware 反向接管
- refresh 失败后，session store 与持久化状态仍保持一致
- loader 路径与普通 imperative API 路径在 auth error 上表现一致

只有 authenticated pilot 通过后，才适合宣布 ingress 的 auth 设计已基本定型。

### 阶段 2：把现有 feature 全部迁移到共享入口

范围至少包括：

- auth
- profile completion
- public auth
- labs 中当前仍有 GraphQL 请求的实验模块

验收标准：

- feature 内不再自行读取 GraphQL endpoint
- feature 内不再自行管理 Authorization header
- feature 内不再自行解析 transport 级错误

### 阶段 3：确认 Apollo 是否继续上升为默认 GraphQL runtime

若答案是“是”，再推进：

- typed document
- hooks 化调用
- 精细 cache 策略
- subscription 场景

若答案是“否”，则应反向收缩：

- 保留共享 ingress
- 降低 Apollo 暴露面
- 避免 provider / cache / ws link 成为长期包袱

## 当前不建议做的事

- 不建议一边迁移 feature，一边继续发明多套错误处理方式
- 不建议在鉴权策略未定前就做复杂 cache
- 不建议把 ws / subscription 当成本轮的主目标
- 不建议让 feature 继续直接吃 Apollo 默认错误
- 不建议长期停留在“provider 已引入，但调用契约和错误契约未稳定”的状态

## 当前 plan 的预期产出

本计划完成后，希望形成的不是“某个具体实现细节”，而是以下稳定结果：

- 前端 GraphQL 请求有唯一共享入口
- 入口层职责边界清晰
- feature 不再接触 transport 细节
- 错误与鉴权语义对上层稳定
- Apollo 是否继续扩张有明确决策依据
