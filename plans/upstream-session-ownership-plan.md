# Upstream Session Ownership Plan

## 决策

- Upstream session 是跨 feature 的领域能力，长期归属 `entities/upstream`。
- `shared/graphql` 只保留 transport/runtime，不承载 `loginUpstreamSession` 这类业务 facade。
- Upstream token 主权继续在前端，不进入 `features/auth`，也不由本站后端持久化。
- 本站 auth session 只作为当前账号来源，upstream session 按本站 `accountId` 绑定。
- `academicSemesters` 当前暂不迁移；后续应移出 `shared/graphql`，进入 academic-semester entity 或正式公共 domain API。

## P1：Upstream Session Entity

- 新增 `src/entities/upstream/` 作为唯一公共入口。
- upstream 登录 mutation 放入 upstream entity 的 infrastructure，而不是 `shared/graphql`。
- upstream 本地存储放入 upstream entity 的 infrastructure。
- upstream 错误识别与用户反馈放入 upstream entity 的 application。
- 对外提供 `useUpstreamSession({ account })`：
  - `session`
  - `login({ userId, password })`
  - `persistRollingSession(session, input)`
  - `clear()`

## P1：调用方收敛

- `course-schedule-sync` 只从 `@/entities/upstream` 消费 upstream 登录、token 生命周期和错误反馈。
- `public-auth` staff invite 只从 `@/entities/upstream` 消费 upstream 登录与 invite 场景错误反馈。
- `labs/upstream-session-demo` 只从 `@/entities/upstream` 消费 upstream session 能力。
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

## P2

- 若后端新增 upstream refresh token contract，再在 `entities/upstream` 内统一扩展，不下放到页面。
- 若未来一个本站账号允许绑定多个 upstream 身份，再调整 storage key/model，不让 feature 自行扩展第二套结构。
- 将 `academicSemesters` 共享 query 迁出 `shared/graphql`，避免 transport 层业务化。

## 验证

- `npm run lint`
- `npm run build`
- 覆盖场景：
  - 无 upstream token 时要求登录
  - 登录成功后继续原业务动作
  - 业务成功后滚动覆盖 token
  - token 失效后清理并要求重登
  - 切换本站账号后旧 token 不可复活
