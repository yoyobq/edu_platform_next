# Upstream Session Ownership Plan

> 状态：P1 与 academicSemesters 迁移均已落地。P2 余下条目为条件触发项，待真实需求出现再启动。

## 决策

- Upstream session 是跨 feature 的领域能力，长期归属 `entities/upstream-session`。
- `shared/graphql` 只保留 transport/runtime，不承载 `loginUpstreamSession` 这类业务 facade。
- Upstream token 主权继续在前端，不进入 `features/auth`，也不由本站后端持久化。
- 本站 auth session 只作为当前账号来源，upstream session 按本站 `accountId` 绑定。
- `academicSemesters` 已迁出 `shared/graphql`，落入 `entities/academic-semester`；后续若再出现 list/CRUD 之外的需求，再在该 entity 内扩展，不回流 `shared/graphql`。

## P1：Upstream Session Entity（已落地）

- 已新增 `src/entities/upstream-session/`，作为唯一公共入口。
- upstream 登录 mutation 落在 `entities/upstream-session/infrastructure/upstream-session-api.ts`。
- upstream 本地存储落在 `entities/upstream-session/infrastructure/upstream-session-storage.ts`，storage key 已升级到 `aigc-friendly-frontend.upstream.session.v2`，并对旧 labs key 提供一次性迁移与清理。
- upstream 错误识别与用户反馈落在 `entities/upstream-session/application/upstream-error-feedback.ts`。
- 对外提供 `useUpstreamSession({ account })`：
  - `session`
  - `login({ userId, password })`
  - `persistRollingSession(session, input)`
  - `clear()`

## P1：调用方收敛（已落地）

- `course-schedule-sync` 仅从 `@/entities/upstream-session` 消费 upstream 登录、token 生命周期和错误反馈；登录场景错误经 feature 自身的 `resolveCourseScheduleSyncErrorMessage(error, 'login')` 出口归一，不直接调用 upstream 通用函数。
- `public-auth` staff invite 仅从 `@/entities/upstream-session` 消费 upstream 登录与 invite 场景错误反馈。
- `labs/upstream-session-demo` 仅从 `@/entities/upstream-session` 消费 upstream session 能力，原本地 `storage.ts` re-export 已删除。
- 页面只保留各自业务 continuation，不再直接组合 storage read/write 与 login mutation。

## 存储边界

- localStorage 存储至少包含：
  - `accountId`
  - `upstreamSessionToken`
  - `version`
- 可保存辅助字段：
  - `expiresAt`
  - `upstreamLoginId`
- 不保存 upstream 密码。
- 读取时发现存储账号与当前本站 `accountId` 不一致，必须清空并返回无 session。
- 业务响应携带新的 `upstreamSessionToken` 时，必须立即覆盖旧 token。
- 当前 storage key 为 `aigc-friendly-frontend.upstream.session.v2`；遗留 labs key 在读、写、清理路径上都会被一并移除，避免新旧并存。

## academicSemesters 迁移（已落地）

- 新增 `src/entities/academic-semester/`，承接原 `shared/graphql/academic-semesters.ts`。
- 类型 `SharedAcademicSemesterRecord` 重命名为 `AcademicSemesterRecord`；对外公开 API：
  - `requestAcademicSemesters`
  - `RequestAcademicSemestersInput`
  - `AcademicSemesterRecord`
- `shared/graphql/index.ts` 不再 re-export 任何业务 facade，仅保留 transport（`executeGraphQL`、`configureGraphQLRuntime`、`getGraphQLClient`、`getGraphQLEndpoint`、`GraphQLIngressError` 家族、`GraphQLAuthMode`）。
- 消费方收敛：
  - `features/course-schedule-sync` 从 `@/entities/academic-semester` 取学期列表。
  - `features/academic-calendar-management` 从 `@/entities/academic-semester` 取学期列表，feature 内部仍保留 semester 的 mutation 与映射；spec mock 已按 entity 与 shared 边界拆分。

## P2（条件触发，未启动）

- 若后端新增 upstream refresh token contract，再在 `entities/upstream-session` 内统一扩展，不下放到页面。
- 若未来一个本站账号允许绑定多个 upstream 身份，再调整 storage key/model，不让 feature 自行扩展第二套结构。

## 验证

- `npm run lint`
- `npm run build`
- 单测：`src/entities/upstream-session/infrastructure/upstream-session-storage.spec.ts`、`src/features/academic-calendar-management/infrastructure/academic-calendar-management-api.spec.ts`
- E2E 覆盖场景：
  - 无 upstream token 时要求登录
  - 登录成功后继续原业务动作
  - 业务成功后滚动覆盖 token
  - token 失效后清理并要求重登
  - 切换本站账号后旧 token 不可复活
  - 旧 labs storage key 在读取后被自动迁移并清理
