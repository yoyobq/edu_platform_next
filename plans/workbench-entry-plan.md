# Workbench Entry Plan

本文件保留 `workbench entry` 主题的单页计划。

稳定约束已迁入 [docs/workbench-entry-rules.md](../docs/workbench-entry-rules.md)。
本文件只保留三类信息：

- 当前已完成到哪里，便于回溯排错
- 当前不打算继续做什么，避免主题再次发散
- 下一阶段若有业务接入，应优先处理哪些任务

## 当前状态

截至当前，`workbench entry` 主线已完成首阶段最小闭环：

- 未登录入口已与登录后工作台壳层分开
- `/` 已稳定为登录后默认工作台入口
- public / protected / governed experiment 分流已形成可运行闭环
- 首页已从过渡态单面板收口为默认工作台模块编排
- 首页模块 contract、最小默认模板、demo 语义隔离都已落地
- 当前首页模板已稳定为 `admin-default / member-default / minimal-default`
- 当前首页最小模块组合已落地为：
  - 状态总览模块
  - 主动作入口模块
  - 最近上下文模块

这意味着：

- 后续不需要再回到“`/` 是否默认进入工作台”这一层重新讨论
- 后续不应再把 demo bridge、demo query 或实验入口拿来填正式首页空位
- 后续若有业务接入，应直接按 rule 判断“是否进入首页”“是否上升到壳层”
- 后续若 layout 引入 sidebar / nav-rail，也不应反向改写首页模块 contract 与 workbench 准入规则

## 历史收口摘要

保留以下历史信息，方便后续回溯查错：

### 已关闭的阶段

- `P0` 已完成：
  - public entry shell / workbench shell 分开
  - 最小登录链路与会话恢复闭环已形成
  - `/` 默认入口与 `redirect` 回跳已收口

- `P1` 已完成：
  - 首页模块 contract 已收口为统一消费面
  - `shared/home-modules` 已收敛为 contract / guards / constructors 出口，页面级 view model 不再停留在 shared
  - 默认工作台已形成 `admin-default / member-default / minimal-default` 三档模板映射
  - demo trigger 已收回到 `/labs/demo`
  - `workspaceDemo` 已限制在 demo 实验域内，不再污染正式首页路径

### 当前仍刻意保留但尚未正式化的部分

- 第三工作区挂载位继续保留在壳层中
- Sidecar 继续作为全局壳层能力存在
- sidebar / nav-rail 能力若回归，应视为 layout capability，而不是 workbench 自己的平行导航体系
- verification intent 已有 public path-first 入口，但 intent 预解析与续接流程尚未展开
- 个人偏好、默认编排细化、Sidecar 深层写入联动都还未进入当前主线

## 当前不做的事

在没有新的明确业务需求前，当前不单独推进：

- 第一批正式首页模块清单的扩张讨论
- 哪些首页能力要上升为全局壳层能力
- 第三工作区的正式状态模型
- Sidecar 的深层页面写入联动
- 把 sidebar / nav-rail 直接当作首页模块扩张的一部分来做
- 默认编排编辑器与个人偏好细化机制

原因：

- 当前更高优先级是具体业务页面与业务流程接入
- 这些主题需要真实业务使用模式出现后再判断，过早推进只会重新发散

## 下一阶段任务

当前下一阶段不单开新的 `workbench entry` 大阶段，转为“业务接入时按需推进”。

若接下来开始做具体业务，优先按以下顺序处理：

1. 先做业务页面本身，而不是先扩首页。
2. 业务页面稳定后，再判断它是否满足首页模块准入理由。
3. 若满足准入理由，再补对应 feature 的首页摘要 use case 与模块 contract 输出。
4. 若某项能力需要跨页面持续存在，再单独评估是否值得上升到 `layout`。
5. 若某业务域更适合侧边导航，不要把它错误下沉成首页模块问题，而应回到 `layout-plan.md` 中的 sidebar capability 处理。

### 业务接入时的检查清单

- 该能力是否已有正式页面，而不是只存在 demo 入口
- 该能力进入首页是否有明确准入理由
- 该能力进入首页后，是否仍只承载摘要与入口
- 该能力若要打开 Sidecar 或触发协作动作，是否走受控 action
- 该能力是否误复用了 demo route、demo trigger 或 demo query
- 该能力若更适合通过侧边导航进入，是否应优先作为 layout capability 处理，而不是挤进首页模块

## 文档约束

- `workbench entry` 主题只保留本页作为 plan
- 稳定规则只写入 [docs/workbench-entry-rules.md](../docs/workbench-entry-rules.md)
- 后续若再出现新的稳定边界，应优先补 rule，而不是重新拆出多份 plan 文档
