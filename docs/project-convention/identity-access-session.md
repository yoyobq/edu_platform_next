<!-- docs/project-convention/identity-access-session.md -->

# Identity Access Session

本文件记录当前已稳定的身份、授权摘要与前端会话契约。

## 当前会话入口

- `login`：建立会话，只返回 `accessToken` 与 `refreshToken`
- `refresh`：续期会话，只返回新的 `accessToken` 与 `refreshToken`
- `me`：返回前端当前会话权威快照
- `logout`：前端当前按纯本地退出处理，直接清本地会话

当前前端统一按两步处理登录态：

1. `login / refresh` 只负责拿 token
2. `me` 负责重建前端消费的当前会话快照

当前前端会话状态机收敛为：

- `unauthenticated`
- `restoring`
- `hydrating`
- `authenticated`

其中：

- `restoring`：页面刷新或进入受保护路由时，前端正在尝试从本地会话恢复
- `hydrating`：`login` 已成功返回 token，前端已离开 `/login`，正在壳层内异步执行 `me`
- `authenticated`：`me` 已成功，当前完整会话快照可用于访问控制与页面渲染

当前登录成功后的默认体验为：

1. 调用 `login`
2. 若成功，仅先写入 `accessToken / refreshToken`
3. 立即离开 `/login`
4. 在 app shell 内进入 `hydrating`
5. 异步执行 `me`
6. `me` 成功后进入 `authenticated`
7. 若 `me` 失败，则清理会话并回到 `/login`

这条规则的目的不是缩短真实总耗时，而是把“等待 `me`”从登录页内挪到壳层内，改善首次登录体感。

当前前端 token 主权明确为：

- `accessToken` 与 `refreshToken` 由前端当前会话负责持有
- 只要后端要求鉴权，请求发起方就必须带上当前有效 `accessToken`
- 后端不替前端保存“浏览器当前会话”这一层语义
- GraphQL runtime、HTTP client、SDK wrapper 都不是 token 真源，只是请求时消费 token 的技术承载层
- `shared/graphql` 当前不自动发起 `refresh`；会话恢复、续期与失效推进仍由 `features/auth` 负责
- `shared/graphql` 当前只对普通业务请求做受控的 reactive refresh；auth 主流程不参与
- 运行时层不得在 auth feature 之外再维护一份独立 token 真源，避免与当前会话状态漂移
- 若某个 runtime 需要鉴权，它必须在请求时读取当前 token，而不是长期缓存一份自己的 token 副本
- `refresh` 成功后，后续请求必须使用最新 token；旧 token 只允许停留在失败中的历史请求上下文里
- 这套“auth 主流程归 auth feature、shared/graphql 只做 transport/runtime”的划分，当前按长线方案执行
- `ws / subscription` 不适用“每次请求现读 token”的 HTTP 语义；若后续启用，token 变化时必须按需重连

当前本地会话存储允许两种形态：

- pending session：仅含 `accessToken / refreshToken`
- hydrated snapshot：完整 `me` 水合结果

前者只用于 `hydrating` 过渡态，后者才是正式业务页面消费的完整会话快照。

当前前端还保留一条显式前置续期能力：

- `ensureFreshSession()` 由 `features/auth` 提供
- 它只在 auth 的显式边界上调用，不再作为 protected route 的默认同步门槛
- 它不会下沉成 `shared/graphql` 自己的 refresh 主权

当前规则为：

- 若 access token 距离过期仍有安全余量，则直接复用当前 snapshot，不产生网络开销
- 若 access token 已接近过期或已过期，则由 auth feature 主动调用 `refresh`
- 多个 loader / 页面边界同时触发时，前端只允许一个 `refresh` 在飞，其余调用等待同一结果
- 无法可靠解析 token `exp` 时，按保守兼容处理，直接返回当前 snapshot，不阻塞当前流程
- `refresh` 失败时，`ensureFreshSession()` 自身不决定页面跳转；由调用方决定是否 redirect 或展示错误

当前请求层还存在一条兜底续期路径：

- 普通业务请求若收到 `GraphQLIngressError.type === 'auth'`
- 则由 `shared/graphql` 通过 bridge 调用 `refreshSession`
- bridge 内部调用 `ensureFreshSession({ force: true })`
- `force: true` 只用于“服务端已经实际拒绝了当前 token”的场景，跳过客户端 `isTokenFresh` 判断
- 成功后重放原请求一次；失败后调用 `onAuthFailure`
- auth 主流程通过 `allowAuthRetry: false` 排除在此路径之外

页面刷新后的恢复链路为：

1. 先使用当前 `accessToken` 调 `me`
2. 若失败，再用 `refreshToken` 调 `refresh`
3. `refresh` 成功后，再次调用 `me`
4. 任一步失败，前端强制登出并清空本地会话

如果本地存储中只有 pending session，则当前恢复链路退化为：

1. 直接使用当前 `accessToken` 调 `me`
2. 若命中 auth 失败，再用 `refreshToken` 调 `refresh`
3. `refresh` 成功后，再次调用 `me`
4. 任一步失败，前端清理 pending session，回到登录页

进入 protected route 前的当前默认链路为：

1. 先执行 `restoreSession()`
2. 若当前已有完整 snapshot，直接使用当前 snapshot 做 `needsProfileCompletion` 和访问控制判断
3. 若当前只有 pending session，则允许先开 app shell，并在壳层内继续 `hydrating`
4. 不再在 route loader 中同步等待 `ensureFreshSession()`
5. 后续若普通业务请求收到 `type: 'auth'`，再走请求层 reactive refresh / forceLogout

当前会话失效后的页面响应规则为：

- `forceLogout()` 只负责清 storage 和 auth store
- app 根部 watcher 负责监听 `authenticated -> unauthenticated`
- 当前路径若不在 public 白名单，则硬跳 `/login?redirect=当前路径`
- 当前路径若已在 public 白名单，则不跳转
- 若 `hydrating` 期间 `me` 失败，则同样清会话并回到 `/login`
- 失败原因通过 flash 回传到登录页，避免只剩 toast 而丢失表单上下文

当前 refresh 反馈规则为：

- 普通请求级 reactive refresh 默认不提示
- 页面级、用户已明显感知到的 refresh 可补轻量提示
- 提示统一由 layout 内宿主承接，避免页面跳转时提示丢失
- refresh 失败后的提示走单一路径，不再同时依赖登录页表单错误和 toast
- 当前默认文案：
  - 成功：`已为你更新登录状态`
- 失败：`登录状态已失效，请重新登录`

当前登录后 hydrate 失败的反馈规则为：

- 不继续停留在 app shell
- 清除 pending session
- 回到 `/login?redirect=原目标`
- 失败原因优先落到登录页 inline error；必要时可同时保留统一 flash 承接

## 当前会话快照

当前前端会话快照收敛为：

- `accountId`
- `account`
- `userInfo`
- `identity`
- `accessToken`
- `refreshToken`
- `slotGroup`

字段边界如下：

- `account`：认证主体与账户侧信息
- `userInfo`：公共资料与 `accessGroup`
- `identity`：当前主身份的详情补充；仅在存在独立身份实体时返回
- `slotGroup`：来自 access token 的增量授权摘要

注意：

- pending session 不是“会话快照”
- `needsProfileCompletion`、`accountId`、`identity`、`userInfo` 等字段只有在 `me` 完成后才可信
- 因此 `hydrating` 阶段只允许开壳，不允许把 pending session 当成完整业务身份输入

## 当前身份与授权摘要

当前 `primaryAccessGroup` 只收敛为：

- `ADMIN`
- `GUEST`
- `REGISTRANT`
- `STAFF`
- `STUDENT`

当前 `accessGroup` 只消费上述五项。

当前 `identity` 只收敛为：

- `StaffType`
- `StudentType`

当前前端规则为：

- `ADMIN / GUEST / REGISTRANT` 不要求存在独立 `identity`
- `REGISTRANT` 是登录后资料补全的过渡态，不等于 `GUEST`
- `STAFF / STUDENT` 的业务主视角由 `identity` 详情补充
- 前端不得因实体缺失自行推断 `GUEST`
- `GUEST` 只能由后端显式给出

## 当前摘要字段语义

- `accessGroup`：全局入口授权输入，回答“能进哪里”
- `slotGroup`：全局增量授权摘要，回答“还能多做什么”
- `identityHint`：后端账户侧提示字段，不是前端权威身份输入
- `activeRole`：仅允许作为前端本地展示偏好，不参与授权

当前明确不进入 `accessGroup / slotGroup` 的包括：

- `teacher`

课程、班级等资源访问继续走业务关系判定，不并入当前全局会话快照。

## 当前 JWT 使用边界

当前 access token 基线：

- 必含 `sub`
- 必含 `username`
- 必含 `email`
- 必含 `accessGroup`
- 可选 `slotGroup`
- 必含 `type: 'access'`

当前 refresh token 基线：

- 必含 `sub`
- 必含 `type: 'refresh'`
- 必含 `tokenVersion`

当前前端规则为：

- access token 只承载粗粒度鉴权输入，不承载 `identity`
- 前端可以直接消费 `accessGroup / slotGroup`
- 前端不得根据 token 自行推断正式 `identity`

## 当前前端异常处理

- token 过期或无效：强制登出
- `me` 失败：先尝试 `refresh -> me`
- `refresh` 成功后 `me` 再失败：强制登出
- 关键 claim 缺失：强制登出
- 后端未明确给出 `GUEST` 时，前端不得进入 `GUEST` 流程

## 当前前端落地状态

- 认证会话已按 `login / refresh / me / logout` 收敛
- 登录成功后已改为“先 token、后 `me` 水合”的壳层内异步模式
- 本地会话存储当前同时兼容 pending session 与 hydrated snapshot
- 当前 E2E 已覆盖登录、恢复、刷新、强制登出与基础路由正反路径
