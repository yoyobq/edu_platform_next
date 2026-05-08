<!-- docs/project-convention/upstream-session-frontend-ownership.md -->

# Upstream Session Frontend Ownership

本文件记录当前项目里 `upstream` 会话的前端主权约定，以及当前示例页的稳定前端行为。

后端 schema 真相以 [../backend/README.md](../backend/README.md) 指向的来源为准；本文件只收口当前前端已经确认的边界，不反推后端内部实现。

## 当前结论

当前项目对 `upstream` 的约定是：

- 前端收集 `upstream` 用户名和密码
- 前端把这组凭据提交给本站后端
- 本站后端仅用它们去登录 `upstream`
- 本站后端把 `upstream` 返回的会话 token 回给前端
- 前端负责保存、回传和更新这个 token
- 本站后端不持久化保存 `upstream` 用户名、密码或会话 token

一句话：

- `upstream` 会话主权在前端
- 本站后端只是代访问 `upstream` 的受控代理层

## 与本站登录态的关系

当前必须明确区分两套会话：

- 本站登录态：`login / refresh / me`
- upstream 会话：`loginUpstreamSession` 返回的 `upstreamSessionToken`

它们不是一套 token，也不能混用。

当前语义分工为：

- 本站登录态回答“当前用户能不能进入本站页面”
- upstream token 回答“本站后端代用户访问 upstream 时拿什么去访问”

当前 upstream token：

- 不并入 `features/auth`
- 不进入本站当前 auth session snapshot
- 不被本站后端作为服务器端 session 保存

## 当前前端 contract

当前前端已接入并使用的 upstream contract 包括：

- `loginUpstreamSession(input: { userId, password })`
- `refreshUpstreamSession(input: { sessionToken })`
- `fetchVerifiedStaffIdentity({ sessionToken })`
- 业务页面自己的 upstream 代理接口，例如教学日志对账查询/保存
- shared Staff Directory Cache 的显式填充接口 `populateStaffDirectory`

当前 upstream 会话返回值包括：

- `upstreamSessionToken`
- `expiresAt`

当前没有独立 refresh token；刷新使用现有 `upstreamSessionToken` 调用 `RefreshUpstreamSession` mutation。

因此前端当前执行的是：

- 首次登录时保存 `upstreamSessionToken`
- 后续业务请求把该 token 回传给本站后端
- 若后端在业务返回中携带滚动更新后的 `upstreamSessionToken`，前端立即覆盖本地旧值
- 页面启用 `keepAlive` 时，前端在 `expiresAt` 前默认提前 2 分钟主动刷新 upstream 会话

## 当前代码归属

- `entities/upstream-session` 是 upstream 登录、存储、滚动 token 更新与错误反馈的唯一公共入口
- 调用方只消费 entity 暴露的 hook、controller、UI 或 request adapter，不直接组合 storage 与 login mutation
- `shared/graphql` 只保留 transport/runtime，不承载 `loginUpstreamSession` 这类业务 facade
- `entities/academic-semester` 承接学期列表读取；`shared/graphql` 不再 re-export 业务查询 facade

## 当前示例页

当前示例页路由为：

- `/labs/upstream-session-demo`

访问范围当前为：

- `ADMIN`
- `STAFF`

而其他现有 admin-only labs 仍保持只对 admin 可见，不因这个示例页一并放开。

当前示例页的固定行为是：

1. 先确认当前本站登录账号
2. 读取当前账号绑定的本地 upstream token
3. 若没有 token，显示 upstream 用户名/密码登录表单
4. 若已有 token，直接调用后端读取教师字典
5. 成功后展示后端返回的原始 JSON
6. 若响应里带新的 `upstreamSessionToken`，立即覆盖本地旧 token
7. 启用 keepAlive 时，按 `expiresAt` 提前刷新 token
8. 若 token 已失效或刷新失败，则清空本地 token 并回到 upstream 登录表单

当前示例页只演示：

- upstream 登录
- 前端持有 token
- 后端代查 upstream
- 前端按后端返回结果滚动更新 token
- 前端主动 keepAlive 刷新 token

稳定业务页不应继续把旧 `fetchTeacherDirectory(sessionToken)` 当作教师姓名常用入口。`staffId -> 教师姓名` 的前端约定见 [staff-directory-cache.md](./staff-directory-cache.md)。

当前不演示：

- 多 token 协作
- 把 upstream token 并入本站 auth
- 更复杂的表格化教师字典工具

## 当前本地存储规则

当前示例页的 upstream token 存储是前端本地存储，且按本站账号强绑定。

固定规则：

- 存储里至少包含 `accountId` 与 `upstreamSessionToken`
- token 只归属于当前本站 `accountId`
- 若切换本站账号，本地残留的旧账号 upstream token 必须失效并清空
- 前端可按需要记录 `expiresAt`、`upstreamLoginId` 这类辅助信息，但它们不改变 token 主权归属
- 若用户勾选记住凭据，前端会按本站 `accountId` 在 localStorage 记录 `upstream` `userId` 与 `password`
- 未勾选或用户清除时，必须删除对应本站账号的 remembered credentials

## 给后续 AIGC 的约束

后续若继续实现基于 `upstream` 的功能，应默认遵守：

- 不要把 upstream 用户名、密码或 token 下沉进本站后端持久化；记住凭据只能是前端本地能力
- 不要把 upstream token 混进本站 auth session
- 不要假设存在独立 upstream refresh token；当前只允许用 `refreshUpstreamSession(sessionToken)` 刷新
- 若业务请求成功返回新的 `upstreamSessionToken`，前端应覆盖本地旧值
- 启用 keepAlive 的页面应复用 `entities/upstream-session` 的刷新调度，不自行写定时器或 storage
- `fetchVerifiedStaffIdentity` 成功返回相同 token 是正常结果，不应触发重复刷新或重试
- 若本地 upstream token 与当前本站账号不匹配，必须立即清空
- 若某个页面只是消费 upstream 数据，它应复用“前端持 token、后端代查”的模式，而不是重新发明另一套会话真相
- 若后端后续新增独立 upstream refresh token contract，应在 `entities/upstream-session` 内统一扩展，不下放到页面
