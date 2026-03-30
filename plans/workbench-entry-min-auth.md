# Workbench Entry Auth Foundation Proposal

本文件是 `workbench entry` 主题下 P0-2 的当前产出物。

它只回答以下问题：

- 当前项目里第一阶段应落下的完整登录基础是什么
- 身份来源、权限来源、默认编排来源分别由谁提供
- 它们在前端应落在哪一层、如何接入

它不回答：

- `/` 在登录前后如何最终分流到哪个具体页面
- 首页模块 contract
- 个人偏好、编排编辑、排序存储

这些内容继续分别属于 P0-3 与后续阶段。

## 目标

- 先建立足以支撑 workbench entry 的第一阶段完整登录基础
- 让首页工作台能够稳定回答“用户是谁、能看什么、默认看到什么”
- 回收当前 URL 上用于临时模拟的身份语义，避免继续外溢成正式契约
- 为后续 `/` 默认入口治理提供稳定用户态来源

## 当前判断

- 当前前端仓库还没有正式登录链路、认证状态宿主、令牌持久化、用户态快照或权限接入层
- 当前 `role=admin` 只是在路由和 layout 中用于 demo 级访问模拟，不能继续外溢成正式产品契约
- 当前 `availability=...` 只属于协作入口可用性模拟，不属于认证、权限或用户身份语义
- 因此 P0-2 的重点不是“把现有 query 参数包装得更像正式能力”，而是给它们找到正式替代物

## 结论

当前项目的第一阶段完整登录基础采用：

- `public entry shell` 下的登录页作为登录入口
- 一个最小 `auth` 稳定切片负责登录、会话持久化、会话恢复与退出
- 路由层只消费“是否已登录 + 当前会话快照”，不直接读取 token 或表单字段
- 首页工作台只消费“当前用户摘要 + 权限摘要 + 默认模板 key”，不直接拼装登录响应 DTO

一句话说：

- 登录解决“你是谁”
- 权限解决“你能进什么”
- 默认编排解决“你先进来先看什么”

三者相关，但不混成一层。

## 当前推荐的首阶段链路

```txt
/login
  -> 提交登录表单
  -> auth feature 调 login mutation
  -> infrastructure 将 LoginResult 转为内部 session snapshot
  -> infrastructure 持久化 token / session
  -> app 在启动或路由分流时恢复 session
  -> router 判断是否已登录
  -> 已登录进入 workbench shell
  -> pages/home 根据 session + 默认模板 key 组织首页工作台
```

## 身份来源

当前推荐的首阶段身份来源为后端 `login` mutation 的返回结果。

本地 schema 已提供：

- `login(input: AuthLoginInput!): LoginResult`
- `LoginResult.accessToken`
- `LoginResult.refreshToken`
- `LoginResult.accountId`
- `LoginResult.role`
- `LoginResult.identity`
- `LoginResult.userInfo`

因此 P0-2 阶段的首阶段身份来源结论是：

- 首次身份建立来源：`login` 的 `LoginResult`
- 前端会话恢复来源：前一次成功登录后持久化的 session snapshot
- 若后续需要更完整的角色详情，再由对应身份 query 补充；它不是 P0-2 的前置条件

当前不要求一上来就补齐所有 `my*` 查询。只要登录成功后能稳定拿到：

- `accountId`
- 当前默认 `role`
- `userInfo`

就足以先建立登录后入口判断与首页首阶段用户态。

## 权限来源

当前推荐的首阶段权限来源为后端返回的角色与访问组，而不是前端 URL 参数。

本地 schema 已提供：

- `LoginResult.role`
- `UserInfoDTO.accessGroup`

因此当前结论是：

- 权限主来源：`userInfo.accessGroup`
- 权限补充来源：`login` 返回的默认 `role`
- 前端不自行发明正式权限，只做受控映射和界面级可见性判断

这意味着：

- 是否允许进入某条正式页面，最终仍应服从后端语义
- 前端可基于 `accessGroup + role` 做菜单、首页模块、路由守卫和空态降级
- 当前 `labs` 的 access list 与 `sandbox` 的环境暴露规则继续独立存在，不被 auth 切片吞并

## 默认编排来源

当前推荐的首阶段默认编排来源不是权限接口本身，也不是个人偏好，而是前端维护的角色模板映射。

当前结论：

- 默认编排来源：前端 workbench 侧维护的“基于角色的默认模板”
- 输入依据：已登录 session 中的 `role`，必要时可辅以 `accessGroup`
- 个人偏好：暂不进入 P0-2

原因：

- 权限只回答“能不能看、能不能进”
- 默认编排回答“首次进入时优先展示什么”
- 个人偏好回答“这个具体用户后来想怎么改”

如果在 P0-2 就把这三者混写，后续首页工作台会再次发散。

因此在首阶段，推荐先做：

- `role -> defaultWorkbenchTemplateKey`

而不是：

- `role == permission == home layout == personal preference`

## 前端接入边界

### `app/router`

- 只负责登录前后分流、路由守卫、进入 public / workbench branch 的判断
- 不直接发登录请求
- 不直接解析后端登录 DTO
- 不直接读取 storage 中的原始 token

### `app/providers`

- 可承接“应用级会话已恢复”这一类状态宿主
- 但不应把认证协议、DTO 清洗、storage 读写直接堆在 provider 内

### `pages/login`

- 只承接登录页表单与页面呈现
- 不直接决定 workbench 默认编排
- 不承接权限判定规则

### `pages/home`

- 只消费已整理好的当前用户态与默认模板 key
- 不直接读取 token、URL 模拟身份参数或后端原始登录响应

### `features/auth`

- 拥有最小登录链路
- 负责 login use case、session snapshot、logout、session restore
- 负责 token / storage / API adapter / DTO mapper
- 负责暴露统一的 `forceLogout` 或等价“会话失效退出”入口，供 API 基础设施在收到 `401` / 会话失效信号时调用

### `features/workbench-entry` 或首页拥有者

- 拥有默认编排模板映射
- 根据已登录 session 提供首页初始化所需的 template key 或最小首页视图模型
- 该层只消费认证切片提供的 session snapshot，不反向拥有登录协议
- 不直接拥有 token 持久化

## 推荐的首阶段内部结构

为避免违反当前分层与基础设施规则，当前推荐：

```txt
src/features/auth/
  application/
    login.ts
    restore-session.ts
    logout.ts
    ports.ts
  infrastructure/
    auth-api.ts
    auth-storage.ts
    mapper.ts
  ui/
    login-form.tsx
  index.ts
```

说明：

- 登录 API、storage 读写、DTO 映射都属于 `infrastructure`
- `application` 只组织 use case 与 session 语义，不直接承接外部协议
- `pages/login` 通过 feature 公开 API 使用登录能力
- `app/router` 只消费 session restore 的结果，不深挖 feature 内部文件
- 若后端会话失效或接口统一返回 `401`，应由 API 基础设施调用 `features/auth` 暴露的 `forceLogout` 或等价入口，统一完成 session 清理、持久化清理与登录态回退，而不是让各页面或模块各自弹错

如果后续觉得“会话恢复”更接近全局 app 能力，也仍应优先通过 feature 公开出口提供，而不是把认证细节回灌到 `app/`

## 会话持久化边界

P0-2 阶段要求“有可恢复的首阶段会话基础”，但不要求现在就定死最终部署策略。

当前建议：

- token 与 session snapshot 的持久化读写由 `features/auth/infrastructure` 统一负责
- `router`、`pages`、`layout` 不直接读取浏览器存储
- 若当前纯前端形态下只能使用浏览器存储，也应封装在 auth storage adapter 内
- 若未来改为更安全的 httpOnly cookie / BFF 方案，应通过替换 adapter 完成，不改动页面与路由消费面
- token 过期、refresh 轮转、服务端撤权后的重新校验，可放到 P2 / P3 继续补齐，不要求在 P0-2 一次性定完
- 但 P0-2 必须明确它们属于后续安全补齐项；会话恢复失败时必须能回退到未登录态，不能把本地持久化 snapshot 当成永久可信身份来源
- 即使 token 过期与 refresh 不在 P0-2 完整补齐，首阶段也应具备“后端已判定当前 session 无效时，统一退出并回退到未登录态”的兜底能力

这意味着当前阶段可以先接受“技术上可替换的最小存储适配”，但不能让 token 读写散落到应用各层。

## 当前应回收的临时语义

在 P0-2 完成后，以下语义不应继续作为正式用户态来源：

- `?role=admin`
- 任何通过 URL search params 直接模拟正式登录身份的做法

同时需要明确：

- `?availability=available|degraded|readonly|unavailable` 仍只属于协作入口调试语义
- 它不提供身份、权限、默认编排或登录状态

## 当前首阶段 session snapshot 建议

前端在 P0-2 阶段至少需要收束出一个内部 session snapshot，至少包含：

- `accountId`
- `role`
- `accessGroup`
- `displayName`
- `avatarUrl`
- `isAuthenticated`

其中：

- `displayName` 可优先从 `userInfo.nickname` 或当前身份对象上的名称字段归一得到
- `accessGroup` 优先来自 `userInfo.accessGroup`
- 若后端某些字段临时缺省，应在 `infrastructure/mapper` 做兜底，而不是把空值兼容散落到页面中

## 当前推荐实现顺序

1. 建立最小 `features/auth` 切片
2. 接入 `login` mutation 与 session snapshot mapper
3. 接入 auth storage adapter 与 session restore
4. 回收 `role` query 参数作为正式身份来源的职责
5. 让 `app/router` 改为消费已恢复的 session 判断 public / workbench 分流
6. 再在 P0-3 中确定 `/` 的登录前后跳转与职责说明

## 完成标准

- 完整登录基础的首阶段边界明确，至少覆盖登录入口、login use case、session restore 与 logout
- 身份来源明确收束为登录结果与可恢复 session
- 权限来源明确收束为 `accessGroup + role`
- 默认编排来源明确收束为前端维护的角色模板映射
- URL 临时身份语义不再被当作正式产品契约继续扩散
- `router`、`pages`、`layout` 不直接读取 token 或后端原始登录 DTO
