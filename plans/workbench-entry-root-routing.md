# Workbench Entry Root Routing

本文件是 `workbench entry` 主题下 P0-3 的当前产出物。

当前状态：

- 已完成首阶段最小闭环（2026-03-31）
- 当前已落地 `public entry shell`、`workbench shell`、`/` 登录前后分流、`/login?redirect=...` 回跳与 governed experiment branch 的基本治理顺序
- verification intent 仍保留为后续 path-first 扩展项；它已与普通 `redirect` 语义分层，但不作为 P0-3 完成前置

它只回答以下问题：

- `/` 在登录前后分别承担什么职责
- 登录成功后默认跳到哪里
- 未登录访问 `/` 或受保护页面时，应被拦到哪里
- verification code 一次性入口在登录前后如何分流

它不回答：

- 登录表单字段细节
- 首页模块 contract
- 个人偏好、编排编辑与排序存储

这些内容继续分别属于 P0-2、P1 和后续阶段。

## 目标

- 把“登录后的 `/` 默认进入工作台”从规则口径落到可执行接入清单
- 让 `public entry shell`、`workbench shell` 与 `/` 的职责边界稳定下来
- 避免 `/` 继续承载过渡 demo 首页语义
- 让后续登录接入、首页工作台和路由守卫可以沿同一条路径推进
- 把普通 `redirect` 回跳与 verification intent 入口语义分开

## 当前落地状态

- `/login` 已独立挂到 `public entry shell`
- `/` 已作为受保护的 `workbench shell` 默认入口，未登录时统一跳到 `/login?redirect=%2F`
- 登录页已统一消费合法 `redirect`，登录成功后优先回原目标，否则回 `/`
- 已登录访问 `/login` 时，会在 loader 中提前回跳，不再停留在 public entry 分支
- `labs / sandbox` 已从 `/` 默认入口语义中拆出，继续按各自环境、access 与登录态规则治理
- 当前 `HomePage` 仍是过渡态 API 状态面板，但它现在只在登录后的 `/` 下承接默认首页，不再兼任未登录入口

## 结论

`/` 只保留一个正式产品语义：

- 登录后默认进入工作台首页

与之配套的入口分流采用：

- 未登录访问 `/`：跳转到 `/login`
- 登录成功后：默认跳回 `/`
- 未登录访问其他受保护正式页面：跳转到 `/login`，并保留原目标地址
- 公开访问页如 `/login`、`/welcome`：继续留在 `public entry shell`
- verification code 一次性入口：优先采用 path-first 路由，先校验 intent，再决定是否要求登录与后续站内跳转

一句话说：

- `/` 是登录后的默认工作台入口，不再兼任未登录欢迎页
- `redirect` 只负责普通受保护页回跳；verification code 负责一次性业务入口
- path 承接主要入口语义，query 继续承接附加导航状态

## `/` 的状态职责

### 未登录态

未登录访问 `/` 时：

- 不渲染 `workbench shell`
- 不渲染当前过渡态 `HomePage`
- 直接跳转到 `/login?redirect=%2F`

这里推荐带上 `redirect`，原因不是为了做复杂导航体系，而是为了让“受保护页 -> 登录 -> 回原目标”成为统一机制。

补充：

- 这里的 `redirect` 只解决“原本想去哪个受保护页面”
- 邀请、找回密码、邮箱验证、magic link 这类一次性业务入口，不应直接塞进普通 `redirect` 语义

### 会话恢复中

应用启动后若正在恢复 session：

- `router` 或更高层 session gate 先进入短暂的“恢复中”状态
- 这时既不应提前渲染完整 `public entry shell`，也不应提前渲染 `workbench shell`
- 恢复成功后进入已登录分支
- 恢复失败后回退到未登录态，再跳 `/login`
- public / protected 分支分流与受保护页拦截，应优先收口在各分支根路由的 loader 中，通过 `redirect()` 完成，而不是在页面组件内用 `useEffect` 补跳

这里的关键不是 loading UI 长什么样，而是避免路由在首屏出现“先未登录页闪一下，再跳回工作台”的语义抖动。

### 已登录态

已登录访问 `/` 时：

- 进入 `workbench shell`
- index route 渲染 `pages/home`
- `pages/home` 承接首页工作台内容，而不是全局壳层

这一步延续现有规则：

- 顶栏、开始按钮、Sidecar、第三工作区继续属于 layout
- 首页工作台内容继续属于 `pages/home`

## 登录成功后的默认跳转

当前推荐顺序如下：

1. 若登录页带有合法 `redirect` 参数，优先跳回该目标
2. 若没有 `redirect`，默认跳到 `/`
3. 不把登录成功默认跳转写死为某个 labs / sandbox / 业务子页面

这意味着：

- `/` 是统一的登录后默认落点
- 具体业务页面跳回只在“用户原本就是从那个受保护页被拦下”时发生
- 首页工作台继续承担登录后的稳定第一落点

`redirect` 合法性约束：

- 只接受站内相对路径
- 不接受完整外部 URL
- 不接受 `//example.com` 这类协议相对地址
- 不接受 `javascript:` 等异常 scheme
- 若 `redirect` 不合法，统一回退到 `/`

## verification code 入口语义

对以下类型的一次性动作入口：

- 邀请
- 邮箱验证
- 密码重置
- magic link
- 账号绑定

当前推荐不复用普通 `redirect` 语义，而采用独立的 verification intent 流程。

一句话说：

- `redirect` 解决“回原页面”
- `verification code` 解决“带目的的一次性业务入口”

### 当前推荐流程

```txt
站内入口命中 verification path
  -> 前端先进入公共入口或登录入口
  -> 调后端校验该 verification code 对应的 intent
  -> 后端返回：动作类型、是否需要登录、是否要求目标账号匹配、下一步站内流程
  -> 前端再决定：
       直接进入后续页面
       或先跳登录，再在登录后继续该 intent
```

### 当前约束

- verification code 不等于自由跳转地址
- 不通过开放 `redirect` 来承接邀请、找回密码、magic link 等业务语义
- verification / invitation 入口默认优先使用 path，而不是 `?verificationCode=...`
- verification code 先校验 / 预解析，再跳转
- 不建议在刚打开入口时就直接消费一次性记录
- 更稳的做法是：满足条件后再消费，避免登录失败、切账号或中途退出导致票据被过早用掉

### 与 `/login` 的关系

- `/login` 可以承接普通 `redirect` 参数
- `/login` 可以承接由 verification path 分流过来的 intent 上下文
- 当 verification intent 需要先登录时，登录成功后应优先继续该 intent，而不是简单回到普通 `redirect`
- 当 verification intent 不需要登录时，不必强迫用户先经过工作台入口

当前状态补充：

- 这组 verification intent path 仍未在当前代码中展开
- 但当前代码已经明确 `redirect` 只承接普通受保护页回跳，不承接 verification business intent
- 因此 verification path-first 扩展属于 P0-3 之后的增量接入，不阻塞本阶段默认入口分流闭环

## 未登录拦截路径

### `/`

- 目标路径：`/login?redirect=%2F`
- 理由：`/` 是登录后默认工作台入口，未登录时不应再尝试渲染工作台壳层

### 其他受保护正式页面

- 目标路径：`/login?redirect=<original-path-and-search>`
- 理由：统一登录后回跳机制，避免页面各自发明跳转语义

### verification intent 入口

- 推荐路径：`/invite/:inviteType/:verificationCode`
- 推荐路径：`/verify/email/:verificationCode`
- 推荐路径：`/reset-password/:verificationCode`
- 推荐路径：`/magic-link/:verificationCode`
- 理由：把一次性动作入口做成显式 path 语义，而不是混进普通 query 参数组合

### 公开页

- `/login`
- `/welcome`
- 后续注册、找回密码等 public entry 页面

这些页面不需要工作台守卫，继续停留在 `public entry shell`。

## 当前推荐的路由结构

```txt
router root
  app providers / session bootstrap

  public entry branch
    /login
    /welcome
    /invite/:inviteType/:verificationCode
    /verify/email/:verificationCode
    /reset-password/:verificationCode
    /magic-link/:verificationCode

  protected workbench branch
    /
    其他登录后正式页面

  governed experiment branch
    labs routes
    sandbox routes
```

补充约束：

- `public entry branch` 不复用完整 `workbench shell`
- `protected workbench branch` 统一消费已恢复的 session
- `labs / sandbox` 保留各自既有暴露规则，不因 `/` 默认入口决策被改写成同一种产品语义
- `governed experiment branch` 表达的是环境与暴露治理，不预设另一套视觉壳层
- 命中各自环境、access 与登录态规则后，`labs / sandbox` 仍可复用 `workbench shell` 作为登录后页面的统一呈现壳层
- 因此这里拆的是“路由治理语义”，不是强制拆成“另一套 layout 产品”
- verification intent routing 属于 public entry / login 前后分流的一部分，不并入普通 `redirect` 机制
- path-first 继续用于业务入口；query-first 继续只用于 `redirect` 等附加导航状态

## `labs / sandbox` 与 `/` 的关系

P0-3 不把 `labs / sandbox` 重写成默认入口的一部分。

当前结论：

- `/` 只回答“登录后的默认工作台首页在哪里”
- `labs` 是否可达，继续由 access list 与环境控制决定
- `sandbox` 是否可达，继续由 `dev / test` 暴露规则决定
- 不通过“把它们都挂在 `/` 下面”来表达入口治理
- 即使它们最终复用同一套 `workbench shell` 呈现，也仍分别遵守自己的暴露规则

如果用户直接访问某个实验路由：

- 先服从该实验路由自身的环境与暴露规则
- 再按需要叠加登录态守卫

不要因为默认入口治理，就把实验路由改写成“必须先经过 `/` 再分发”。

## `app/router` 的接入职责

- 负责启动时触发 session restore
- 负责判断当前请求进入 public branch 还是 protected branch
- 负责在未登录时生成 `/login?redirect=...` 跳转
- 负责识别 verification intent 入口并进入对应分流
- 负责在登录后阻止用户继续停留在 `/login`
- 负责将登录前后分流、受保护路由守卫与回跳控制优先收口到 Data Mode loader / redirect，而不是下沉到页面副作用中

`app/router` 不负责：

- 发登录请求
- 解析后端登录 DTO
- 维护 token 持久化
- 决定首页模块细节

## P0-3 完成判断

当前将 P0-3 标记完成，依据如下：

- 已存在独立的 `public entry shell`，未登录入口不再默认进入完整 `workbench shell`
- 已存在最小可恢复 session 基础，根路由分流不再依赖页面副作用补跳
- `/` 已稳定为登录后默认工作台入口，未登录访问时统一跳转登录页
- 登录成功后已具备统一回跳到原受保护目标或 `/` 的闭环
- `labs / sandbox` 没有被并入 `/` 默认入口语义，而继续保留各自治理边界

本阶段不要求：

- verification intent path 已全部实现
- 首页正式模块 contract 已定稿
- 默认工作台模板已完成业务化承载

## `pages/login` 的接入职责

- 只负责登录页呈现与提交
- 成功后读取 `redirect`
- 成功后若存在 verification intent，优先继续该 intent
- 若不存在 verification intent，且 `redirect` 合法，导航到该目标
- 若两者都缺失，导航到 `/`

`pages/login` 不负责：

- 自己恢复 session
- 决定 workbench shell 长相
- 承担首页工作台内容

## `pages/home` 的接入职责

- 只在已登录的 `workbench shell` 下渲染
- 承接首页工作台内容
- 从认证切片和 workbench entry 拥有者消费已整理好的 session 与默认模板结果

`pages/home` 不负责：

- 判断用户是否已登录
- 决定跳登录页还是欢迎页
- 直接读取 token 或 URL 身份模拟参数

## `/login` 的反向分流

为避免用户已登录后仍停留在登录页，当前建议：

- 已登录访问 `/login` 时，直接跳到 `redirect` 指定目标
- 若没有 `redirect`，跳到 `/`

这一步能保证：

- 登录页只作为未登录入口，而不是登录后可长期停留的正式页面

## 当前实现顺序建议

1. 在 `router` 中引入 session restore 与公开/受保护分支判断
2. 将 `/` 从“当前直接渲染过渡态首页”改为“仅在已登录态进入 workbench branch”
3. 新增 `/login` 公共路由，并支持 `redirect`
4. 为 verification code 增加独立的 path-first intent 分流，不与普通 `redirect` 混写
5. 让登录成功后的默认跳转统一回到 `/`，但 verification intent 优先继续原业务流程
6. 再让 `pages/home` 从过渡态首页逐步演进为正式工作台首页

## 完成标准

- `/` 的正式语义明确收束为“登录后的默认工作台入口”
- 未登录访问 `/` 时不再渲染完整 `workbench shell`
- 登录成功后的默认跳转路径明确为 `/`，并支持回跳原始受保护目标
- 普通 `redirect` 与 verification intent 的入口语义明确分开
- verification / invitation 等一次性业务入口默认采用 path-first
- `public entry shell`、`workbench shell` 与 `/` 的职责边界明确
- `labs / sandbox` 的环境与暴露规则没有被 `/` 默认入口治理误改写
