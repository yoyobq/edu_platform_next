<!-- docs/project-convention/identity-access-session.md -->

# Identity Access Session

本文件记录当前已稳定的身份、授权摘要与前端会话契约。

## 当前会话入口

- `login`：建立 pending session；后端返回 `accessToken / refreshToken`，前端映射为 `AuthPendingSession`
- `refresh`：续期会话；后端返回新的 `accessToken / refreshToken`，前端随后执行 `me` 并产出 hydrated snapshot
- `me`：返回前端当前会话权威快照
- `logout`：显式退出会先调用后端，使当前账号已签发的 refresh token 失效，随后清理本地会话
- `clearLocalAuthSession`：只清理本地会话，用于取消水合或被动失效，不代表后端登出

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
- `accessToken` 只用于 `Authorization: Bearer <accessToken>` 调用已登录态接口
- `refreshToken` 只用于 `refresh` mutation，不允许拿 refresh token 调业务接口
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

- pending session：运行时类型为 `accessToken / refreshToken / kind: 'PENDING'`
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

当前显式退出链路为：

1. 使用当前 `accessToken` 调后端 `logout`
2. `logout` 请求设置 `allowAuthRetry: false`，不触发 refresh / retry
3. 无论后端 `logout` 成功或失败，前端都继续清本地 session、Apollo cache，并跳转登录页
4. 后端通过递增账号级 `tokenVersion` 让该账号已签发的 refresh token 全部失效
5. 已签发 access token 不做前端侧追踪，继续按服务端 JWT 过期策略自然失效

账号切换中的“移除当前账号并切到另一个账号”也按显式退出旧账号处理：

1. 先确认 fallback 账号可恢复或已重新登录
2. 使用旧当前账号的 `accessToken` 调后端 `logout`
3. 再把本地当前会话替换为 fallback 账号

账号切换中的“移除非当前账号”只表示不再保留该本地账号记录，不调用后端 `logout`。

被动退出链路保持本地语义：

- `forceLogout()`
- refresh 失败
- 会话恢复或普通请求判定会话失效
- hydrating 阶段点击“取消登录”

这些路径不调用后端 `logout`，只清理本地 session 并交给 app watcher / 调用方完成跳转。

页面刷新后的恢复链路为：

1. 先使用当前 `accessToken` 调 `me`
2. 若失败，再用 `refreshToken` 调 `refresh`
3. `refresh` 成功后，再次调用 `me`
4. 若失败是 `GraphQLIngressError.type === 'auth'`，前端按会话不可用处理并清空本地会话
5. 若失败是 `network / http / graphql / malformed` 等非 auth 错误，前端不清空本地会话

如果本地存储中只有 pending session，则当前恢复链路退化为：

1. 直接使用当前 `accessToken` 调 `me`
2. 若命中 auth 失败，再用 `refreshToken` 调 `refresh`
3. `refresh` 成功后，再次调用 `me`
4. auth 失败时清理 pending session，回到登录页
5. 非 auth 失败时保留 pending session，但退出 `hydrating` 并展示错误，避免登录页被持续重定向

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

- `accessToken`
- `refreshToken`
- `accountId`
- `account`
- `displayName`
- `userInfo`
- `identity`
- `isAuthenticated`
- `needsProfileCompletion`
- `primaryAccessGroup`
- `slotGroup`

字段边界如下：

- `accessToken` / `refreshToken`：当前本站 auth session 的 token，不代表上游系统会话
- `accountId`：当前认证账户 ID
- `account`：认证主体与账户侧信息
- `displayName`：壳层、账号菜单与协作上下文使用的稳定展示名；可由 `identity.name` 派生，也可退回 `account-${accountId}`，不作为真实姓名真源
- `userInfo`：公共资料与 `accessGroup`；其中 `nickname` 可作为展示退避源，但不是真实姓名真源
- `identity`：当前主身份的详情补充；仅在存在独立身份实体时返回；真实姓名取 `identity.name`
- `isAuthenticated`：hydrated snapshot 的字面量标记，当前固定为 `true`
- `needsProfileCompletion`：是否必须先进入 `/welcome` 完成资料补全
- `primaryAccessGroup`：当前一级导航和主身份语义来源
- `slotGroup`：来自 `me.identity.slotGroup` 的当前会话职责槽位摘要；无 `identity` 时为空数组

注意：

- pending session 不是“会话快照”
- `needsProfileCompletion`、`accountId`、`identity`、`userInfo` 等字段只有在 `me` 完成后才可信
- 因此 `hydrating` 阶段只允许开壳，不允许把 pending session 当成完整业务身份输入
- 前端不得把 `displayName`、`nickname` 或 JWT payload 当作真实姓名来源；staff / student 的真实姓名都以 `me.identity.name` 为准

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

当前前端只消费 `identity` 中与会话、展示和菜单有关的字段：

- staff：`id`、`name`、`departmentId`、`slotGroup`
- student：`id`、`name`、`upstreamId`、`currentClassId`、`currentClassCode`、`slotGroup`

当前前端规则为：

- `ADMIN / GUEST / REGISTRANT` 不要求存在独立 `identity`
- `REGISTRANT` 是登录后资料补全的过渡态，不等于 `GUEST`
- `STAFF / STUDENT` 的业务主视角由 `identity` 详情补充
- `currentClassId / currentClassCode` 都允许为 `null`，只作为当前读侧投影展示，不代表班级归属真相
- 前端不得因实体缺失自行推断 `GUEST`
- `GUEST` 只能由后端显式给出

## 当前摘要字段语义

- `accessGroup`：全局入口授权输入，回答“能进哪里”
- `slotGroup`：全局增量授权摘要，回答“还能多做什么”
- `identityHint`：后端账户侧提示字段，不是前端权威身份输入
- `activeRole`：仅允许作为前端本地展示偏好，不参与授权

`slotGroup` 有两处口径：

- JWT payload 中的 `slotGroup`：服务端对当前 access token 做授权判断时使用；可能要等 refresh 或重新登录后才更新
- `me.identity.slotGroup`：后端实时解析出的当前职责槽位；前端展示、菜单和页面分流优先使用这一处

## 当前前端权限体系总口径

前端权限分为四层，不能互相替代：

- 身份事实：来自 hydrated auth snapshot，包括 `accessGroup`、`slotGroup` 与 `identity`
- 能力判断：具体 `hasXxxAccess` / `resolveXxx` helper 集中收敛在
  `src/entities/auth-access/index.ts`，并通过 `@/entities/auth-access` 消费；
  `src/shared/auth-access/index.ts` 只保留稳定 access group、slot group 常量与跨域类型
- 入口治理：router loader / guard 负责登录态、profile completion、页面准入和必要的
  loader data
- 展示投影：`src/app/navigation/` 只用同一批能力结果决定菜单与本地入口是否可见

实现边界：

- 页面和 feature 不应直接写 `accessGroup.includes(...)` 或 slot 字符串判断来决定全局权限
- 页面若需要自助 / 管理分流，应消费 loader 解析好的 `viewerRole`、`defaultStaffId`、
  `lockedUpstreamLoginUserId` 等最小结果
- 导航可见不等于业务数据权限；后端接口仍是数据安全真源
- router 直达守卫必须与 navigation 使用同一套能力口径，不能出现“菜单隐藏但 URL 可进”的另一套真相
- labs 的基础暴露范围来自各 lab 自己的 `access.ts`；若额外加 `canAccess`，导航 provider
  必须同步同一规则

当前全局能力辅助入口统一为 `@/entities/auth-access`，包括：

- `hasAdminAccess`
- 各教务页面自己的自助 / 管理能力 helper
- `hasClassAffairsCourseResultsAccess`
- `hasStudentRosterMembershipReconciliationAccess`
- `hasUpstreamDataSyncAccess`
- `canAccessPayloadCrypto`
- `resolveUpstreamLoginLockedUserId`：解析 upstream 登录是否锁定当前 staffId，细节见
  [upstream-session-frontend-ownership.md](./upstream-session-frontend-ownership.md)

`src/features/auth` 只承载登录、会话恢复、刷新、存储、snapshot 类型与 session 映射逻辑；
不得作为 router / navigation / page 的全局业务权限 helper 入口。

## 当前自助/管理视角口径

前端页面在同一功能内区分自助视角与管理视角：

- `STAFF` 表示员工基础业务身份，是自助视角的兜底输入
- `slotGroup` 表示增量能力，不替换、不扣减、不覆盖 `STAFF`
- 页面不得因为存在任意 `slotGroup` 就自动进入管理视角
- 只有当前功能显式承认的 `slotGroup` 才能把该页面提升为管理视角
- 当前功能不承认的 `slotGroup` 应被忽略，并继续保留 `STAFF` 自助视角
- 管理视角使用的前端 capability helper 必须与后端同一功能的 `Authority` policy 对齐
- 同一页面若同时存在自助 query 与管理 query，应先判断功能级管理能力，再决定调用哪一个 query
- 管理视角只表达当前功能的页面 / 查询分流，不自动继承为同域其他操作、保存 mutation 或资源范围能力
- 需要按部门、班级、教研组等业务范围裁剪时，继续依赖后端接口与业务关系结果，不从 `slotGroup` 反推 scope

当前 `academicStaffManager` 视角覆盖同一组教务自助 / 管理页面：

- `My 教学日志`
- `My 计划首页`
- `一体化对齐`
- `工作量明细`

在这些页面中：

- `STAFF` 默认走本人自助查询
- `ADMIN` 走管理查询
- `STAFF + ACADEMIC_OFFICER` 走管理查询
- `STAFF + TEACHING_GROUP_LEADER` 走管理查询
- `STAFF + CLASS_ADVISER`、`STAFF + COUNSELOR`、`STAFF + STUDENT_AFFAIRS_OFFICER`
  当前没有该组教务管理视角，仍走本人自助查询
- 如果前端已经切到管理 query，但后端 policy 没有承认同一 `slotGroup`，页面会表现为
  “有 slotGroup 后反而没有 STAFF 权限”；这属于前后端功能级管理口径不一致，不是
  `STAFF` 自助权限被移除

在个人资料语义上：

- `myProfileIdentity.slotGroup` 可以作为当前用户职责摘要展示
- 该展示是只读信息，不承担授权判定
- 完整任职事实仍应通过 `staffCurrentSlotPosts(accountId)` 单独读取，不从 `slotGroup` 反推

在菜单语义上，当前进一步收口为：

- `primaryAccessGroup` 决定正式一级菜单的主身份语义
- 当前 `ADMIN / STAFF / STUDENT` 均已有正式侧栏入口，具体菜单由 `src/app/navigation/` provider 与 access helper 聚合过滤
- `ADMIN / STAFF` 当前使用完整分组式管理与教务入口
- 纯 `STUDENT` 当前使用独立轻量导航入口与账户菜单，不复用 staff/admin 完整分组骨架
- `REGISTRANT` 不进入正式菜单体系，只保留补全过程所需壳层与入口
- `slotGroup` 只承接跨页面持续存在的全局职责插槽
- 进入全局菜单的职责能力必须具备独立 landing page 或明确所属业务入口
- 页面内对象权限、临时能力与资源关系不进入全局菜单

当前前端已消费的 slot 摘要包括：

- `ACADEMIC_OFFICER`
- `TEACHING_GROUP_LEADER`
- `CLASS_ADVISER`
- `COUNSELOR`
- `STUDENT_AFFAIRS_OFFICER`

注意：

- 这些 slot 只是当前功能显式承认时才产生增量能力
- 一个 slot 在某页面可用，不代表它自动拥有同域其它页面的管理能力

当前明确不进入 `accessGroup / slotGroup` 的包括：

- `teacher`

课程、班级等资源访问继续走业务关系判定，不并入当前全局会话快照。

`teacher` 当前也不作为 slot 示例，原因是：

- 它与 `STAFF` 视角高度重叠
- 更接近资源关系被激活后的工作语义
- 容易与页面上下文权限混淆

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

- access token 只承载会话级鉴权输入，不承载完整用户资料或正式身份详情
- 前端不得从 JWT payload 解析用户资料、真实姓名、正式 `identity` 或菜单展示数据
- 前端展示与菜单所需的 `accessGroup / slotGroup / identity` 均以 `me` 水合后的 snapshot 为准
- 前端允许解析标准 `exp` 作为主动 refresh 的轻量启发；解析失败不得合成任何身份字段，也不得阻塞当前 snapshot
- 正式菜单最终消费 hydrated snapshot，而不是 `hydrating` 阶段的 pending token

## 当前前端异常处理

- token 过期或无效：强制登出
- `me` 失败：先尝试 `refresh -> me`
- 启动恢复或 refresh 后的 `me` 非 auth 失败：保留本地会话；已有完整 snapshot 时继续使用本地 snapshot
- `refresh` 成功后 `me` 再 auth 失败：强制登出
- JWT payload 缺失前端展示字段：不由前端补造；以 `me` 成功与否为准
- 后端未明确给出 `GUEST` 时，前端不得进入 `GUEST` 流程

## 当前前端落地状态

- 认证会话已按 `login / refresh / me / logout` 收敛
- 登录成功后已改为“先 token、后 `me` 水合”的壳层内异步模式
- 本地会话存储当前同时兼容 pending session 与 hydrated snapshot
- 当前 E2E 已覆盖登录、恢复、刷新、强制登出与基础路由正反路径

## `slotGroup` 导航语义

`slotGroup` 代表增量的、跨页面持续存在的全局职责，其值影响菜单插槽入口的渲染。

**进入全局菜单的准入门槛（同时满足）：**

- 有明确职责边界，有独立 landing page
- 能跨页面持续存在，不是单对象临时能力

不满足以上条件的能力，继续留在页面级 action、首页模块入口或 Sidecar / command 入口，不进入全局菜单。

**当前稳定 slot 摘要：** `ACADEMIC_OFFICER`、`TEACHING_GROUP_LEADER`、
`CLASS_ADVISER`、`COUNSELOR`、`STUDENT_AFFAIRS_OFFICER`。

**呈现规则：**

- `slotGroup` 不改变 `primaryAccessGroup` 的一级菜单骨架
- 第一版默认一级平铺，不嵌入其他业务父节点
- 不默认做成 context switcher；升级为 context switcher 需单独评估（需有独立 landing page、成体系二级菜单、与主骨架心智边界足够清晰）
- 当活跃 slot 已明显压缩一级导航的可扫读性时，触发 IA review，再决定是否需要分组

**枚举策略：**

- `slotGroup` 的值应进入受控枚举，不允许任意字符串散长
- 新增 slot 时必须同步 `src/shared/auth-access/index.ts` 的受控枚举、对应 feature 的能力
  helper、导航规则、router guard 与本节文档
