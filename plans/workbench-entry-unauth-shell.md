# Workbench Entry Unauthenticated Shell Proposal

本文件是 `workbench entry` 主题下 P0-1 的当前产出物。

它只回答一件事：

- 未登录入口应采用什么独立壳层方案

它不回答：

- 最小登录链路的具体字段与前端接入细节
- `/` 的最终登录前后跳转实现
- 首页模块 contract 与默认工作台模板

这些内容仍分别属于 P0-2、P0-3 和后续阶段。

## 目标

- 让未登录入口不再默认复用完整工作台壳层
- 明确 public entry 与 workbench shell 的挂载边界
- 为后续登录接入与 `/` 路由治理提供稳定前提
- 避免当前 `AppLayout` 继续同时承担“未登录入口”和“登录后工作台”两种语义

## 当前判断

- 当前 `AppLayout` 已明显带有登录后工作台语义
- 顶栏中的环境、角色、Omni 预留位、开始按钮、Sidecar、第三工作区挂载位，都更接近登录后协作工作台，而不是未登录入口
- 因此未登录展示页 / 登录页不应继续直接挂到当前 `AppLayout` 下

## 结论

采用“两套壳层 + 一套路由分流”的方案：

- `public entry shell`：承接未登录展示页、登录页，以及未来可能出现的注册、找回密码等入口页
- `workbench shell`：承接登录后的 `/`、正式页面、当前 Sidecar 协作层与第三工作区
- 路由层负责在两套壳层之间分流，壳层本身不互相冒充

补充约定：

- `stable`、`labs`、`sandbox` 在进入登录后页面后，可以采用一致的 `workbench shell` 呈现方式
- 三者的差异首先体现在“是否可达、在哪个环境可达、是否受 access 控制”，而不是强制体现在页面壳层长相上
- 因此 P0-1 要拆的是“未登录入口壳层”和“登录后工作台壳层”，不是再额外为 `stable / labs / sandbox` 强拆三套视觉壳层

当前推荐方向不是“把 `AppLayout` 继续硬撑成通吃壳层”，而是把它收敛为明确的 `workbench shell`。

## 路由挂载位置

推荐将路由树拆成以下结构：

```txt
router root
  public entry branch
    /login
    /welcome
    /invite/:inviteType/:verificationCode
    /verify/email/:verificationCode
    /reset-password/:verificationCode
    /magic-link/:verificationCode
    未来其他 path-first 的未登录入口页

  workbench branch
    /
    其他登录后正式页面
    需要登录后工作台壳层承载的正式页面

  governed experiment branch
    labs routes
    sandbox routes
```

其中：

- 路由组合与分流继续放在 `src/app/router`
- 两套壳层都放在 `src/app/layout`
- 登录页、未登录展示页、首页工作台内容继续分别放在 `src/pages/*`
- `labs` / `sandbox` 是否挂到哪套壳层下，仍需继续服从各自现有暴露规则
- 业务入口默认优先走 path-first；普通回跳或附加导航状态再使用 query

这样不会把页面内容塞回 `app/`，也不会让路由判断下沉到页面内，符合当前 `app / pages` 职责边界。

补充：

- `labs` 不等于稳定正式页面；若要出现在 `prod`，仍必须受 access list 控制
- `sandbox` 仅限 `dev / test` 暴露，不应被表述成 `prod` 工作台的一部分
- 因此在 P0-1 中，真正需要先稳定的是“未登录态不进入完整 workbench shell”，而不是提前把 `labs / sandbox` 的最终壳层归属一并拍死

## `/` 的当前职责建议

在 P0-1 阶段，先只确定壳层分流方向，不把 `/` 的最终产品形态写死。

当前建议：

- 登录后访问 `/`：进入 `workbench shell` 下的首页工作台
- 未登录访问 `/`：先由路由入口层分流，不直接渲染完整 `workbench shell`
- 在 P0-2 与 P0-3 完成前，未登录访问 `/` 可以先重定向到 `/login`，或进入 `public entry shell` 下的独立展示页

这里真正需要稳定的是“未登录态不进入完整工作台壳层”，而不是现在就拍死未登录首屏文案或营销形态。

## 是否复用现有 `AppLayout`

结论：不复用完整 `AppLayout`，只允许复用与 workbench 语义无关的中性能力。

### 不应直接复用的部分

- 顶栏中的工作台导航结构
- 开始按钮
- `EntrySidecar`
- 第三工作区挂载位与 `ThirdWorkspaceDemoHost`
- 与协作入口直接绑定的 provider 或状态宿主
- 只服务工作台骨架的布局宽度让渡逻辑

这些能力都已经带有明确“登录后协作工作台”语义，不应前置到未登录入口。

### 可按需复用的部分

- 主题 token、全局 CSS 变量、基础 `ConfigProvider`
- 与具体壳层无关的纯工具函数、媒体查询 hook、宽度观测能力
- 后续若确实出现重复，再抽离出来的中性 header / brand wrapper

补充约束：

- 若未登录入口页需要完整视觉主题能力，`public entry shell` 也应挂载足够的中性主题上下文，例如基础 `ConfigProvider`、theme token 与全局 CSS 变量
- 这类主题上下文应独立于登录用户的个人偏好，不默认依赖已登录 session
- 若未登录态需要暗色模式或主题切换，优先采用系统偏好或独立 guest 持久化，而不是复用登录后用户偏好

这里的原则是：

- 先拆语义，再谈复用
- 先保持两套壳层显式存在，再决定是否抽公共片段
- 不为了“少写一点壳层代码”而让 public entry 被 workbench 反向污染

## Host 归属边界

### 继续常驻于应用根的能力

- 路由容器本身
- 真正跨两套壳层共享的主题提供层
- 与具体壳层无关的应用级 provider

这类能力应挂在比 public / workbench 分支更高的位置，但自身不表达“工作台”语义。

### 只属于 `workbench shell` 的 host

- `EntrySidecar`
- 开始按钮及其焦点流
- 第三工作区根节点与 `artifacts-canvas` 挂载位
- `ThirdWorkspaceDemoHost`
- 为协作增强服务的 overlay root
- 与 Sidecar / 第三工作区直接耦合的 provider

这些 host 都应在进入登录后工作台时再挂载，而不是在未登录入口阶段常驻。

### `labs / sandbox` 的当前壳层归属约束

- `labs` 与 `sandbox` 可以复用 `workbench shell` 作为登录后页面的统一呈现壳层
- `labs` 是否可达，仍需继续服从 access list 与环境控制
- `sandbox` 当前只在 `dev / test` 暴露，不应因为壳层复用被误写成 `prod` 默认可达能力
- 复用 `workbench shell` 不代表 `labs` / `sandbox` 已经并入 `stable`，三者的发布治理和暴露语义仍分别成立

### 不应在 P0-1 提前决定为常驻的能力

- Omni 的最终正式 host 位置
- 更深层的跨页面协作挂载点
- 未来是否存在 public / workbench 共用的全局通知层

这些仍可留给后续更成熟的入口与使用模式再判断。

## 对目录分层的直接影响

为避免违反当前分层规则，后续实现应遵守：

- `src/app/router` 只做路由树、分流 loader / guard、分支注册
- `src/app/layout` 只做 public shell 与 workbench shell 的壳层组织
- `src/pages/login`、`src/pages/public-entry`、`src/pages/home` 分别承接页面内容
- 未登录页不直接 import workbench 私有实现
- `pages` 不反向承担登录分流判断；分流仍应停留在 `app/router`

这意味着 P0-1 的落地重点是“壳层拆分”，而不是“把登录页面堆进 `app/layout`”。

补充约定：

- `public entry shell` 下的业务入口默认优先采用 path-first 形式
- 例如邀请、验证、重置密码、magic link 这类入口，优先使用 `/xxx/:code`，而不是 `/?verificationCode=...`
- query 继续保留给 `redirect` 这类附加导航状态

## 对现有 `AppLayout` 的收敛建议

后续实现时，当前 `AppLayout` 应按以下方向收敛：

- 语义上收敛为 `workbench shell`
- 保留当前顶栏、开始按钮、Sidecar、第三工作区等登录后能力
- 不再承担未登录入口页的外壳角色

若未来命名调整，优先把“工作台壳层”的名字改得更准确，而不是继续让 `AppLayout` 维持模糊语义。

## 当前推荐实现顺序

1. 在 `app/router` 先拆出 public branch 与 workbench branch
2. 为 `labs / sandbox` 保留独立的暴露控制判断，不在 P0-1 提前改写它们的产品语义
3. 为未登录入口准备独立 public shell
4. 将当前 `AppLayout` 收敛为 workbench shell
5. 再在 P0-2 中接入最小登录态与用户信息来源
6. 最后在 P0-3 中接通 `/` 的登录前后分流与默认入口职责

## 完成标准

- 未登录展示页 / 登录页不再默认挂到当前完整工作台壳层下
- public entry 与 workbench shell 的路由挂载边界明确
- `AppLayout` 不再继续承担双重语义
- Sidecar、第三工作区与协作相关 host 的归属边界明确
- `labs` / `sandbox` 的现有环境与暴露控制语义没有被 P0-1 误改写
- 后续登录接入可以在不推翻 layout 骨架的前提下继续推进
