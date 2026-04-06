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

当前前端还保留一条显式前置续期能力：

- `ensureFreshSession()` 由 `features/auth` 提供
- 它只在 auth 的显式边界上调用，例如 protected route loader
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

进入 protected route 前的当前默认链路为：

1. 先执行 `restoreSession()`
2. 若当前已有会话，再执行 `ensureFreshSession()`
3. 续期成功后，使用最新 snapshot 继续做 `needsProfileCompletion` 和访问控制判断
4. 若续期失败，调用方先强制登出，再决定跳回登录页

当前会话失效后的页面响应规则为：

- `forceLogout()` 只负责清 storage 和 auth store
- app 根部 watcher 负责监听 `authenticated -> unauthenticated`
- 当前路径若不在 public 白名单，则硬跳 `/login?redirect=当前路径`
- 当前路径若已在 public 白名单，则不跳转

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

## 当前身份与授权摘要

当前主身份只收敛为：

- `ADMIN`
- `GUEST`
- `STAFF`
- `STUDENT`

当前 `accessGroup` 只消费上述四项。

当前 `identity` 只收敛为：

- `StaffType`
- `StudentType`

当前前端规则为：

- `ADMIN / GUEST` 不要求存在独立 `identity`
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
- protected route 前置续期失败：由调用方强制登出并回到登录页
- `me` 失败：先尝试 `refresh -> me`
- `refresh` 成功后 `me` 再失败：强制登出
- 关键 claim 缺失：强制登出
- 后端未明确给出 `GUEST` 时，前端不得进入 `GUEST` 流程

## 当前前端落地状态

- 认证会话已按 `login / refresh / me / logout` 收敛
- 本地会话存储已切到 `auth.session.v2`
- 当前 E2E 已覆盖登录、恢复、刷新、强制登出与基础路由正反路径
