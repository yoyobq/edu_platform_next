# Workbench Entry Demo Semantics Isolation Proposal

本文件是 `workbench entry` 主题下 P1-2 的当前产出物。

它只回答以下问题：

- 当前首页、Sidecar、第三工作区里，哪些语义仍属于 demo / 过渡验证
- 这些 demo 语义分别应通过什么方式隔离
- 哪些能力可以继续留在正式 `workbench shell` 骨架中，哪些不应继续向正式首页模块体系扩散

它不回答：

- 第三工作区的正式状态模型
- Sidecar 的最终正式产品形态
- 第一批正式首页模块名单

这些内容继续分别属于后续实现、P2 与更后阶段。

## 目标

- 把当前已经存在的过渡验证逻辑从“像正式能力”收束成“被明确标识的验证能力”
- 避免首页、Sidecar、第三工作区之间的 demo 桥接继续被误读成正式产品契约
- 保留已经验证有效的壳层骨架，同时阻止 demo 细节继续长进正式语义层

## 当前判断

- `pages/home` 当前只渲染 `ApiHealthStatusPanel`，它仍是过渡态首页内容，不等于正式工作台模块体系已经确定
- `AppLayout` 中的开始按钮、Sidecar 常驻、第三工作区挂载位，主要在验证登录后工作台壳层骨架
- 但其中混入了一条 demo 桥接链路：首页 Sidecar 输入触发词后，可直接通过 query 打开第三工作区 demo
- `/labs/demo` 作为实验页本身是合理隔离的；真正容易外扩的是“stable 首页 / stable Sidecar / stable query 参数”对 demo 语义的直接承接

## 结论

P1-2 需要明确区分三类东西：

1. 可以继续保留的正式壳层骨架
2. 明确属于 demo / 过渡验证的桥接逻辑
3. 后续若要转正，必须重新建模而不能直接继承当前 demo 语义的部分

一句话说：

- `workbench shell` 骨架可以继续保留
- demo 桥接链路必须被显式标记与限流
- demo 不直接毕业为正式首页模块或正式第三工作区契约

## 当前清单

### A. 首页

当前涉及文件：

- `src/pages/home/index.tsx`
- `src/features/api-health-status/ui/api-health-status-panel.tsx`
- `src/app/lib/local-entry-catalog.ts`

当前现象：

- 首页仍只有 API 状态面板
- Sidecar 本地入口卡片里，`首页` 仍被描述为“返回 API 状态面板与默认入口页”

当前判断：

- `ApiHealthStatusPanel` 可以继续作为过渡态首页内容存在
- 但它不应被表述成“正式默认首页模块模板”
- 更不应因为当前首页只有它，就反推“正式工作台首页 = API 状态面板”

隔离要求：

- 文案上，把当前首页明确表述为“过渡态首页”或“当前验证页”，而不是正式默认入口定义
- 模块语义上，不把 `ApiHealthStatusPanel` 直接当作 P1-1 contract 的事实标准
- 路由语义上，`/` 继续只承接“登录后默认工作台入口”，不承接“当前 demo 首页长什么样”的产品承诺

后续去向：

- 若这块内容最终进入正式首页，应按 P1-1 contract 重新整理为正式首页模块
- 若它最终只承担技术观察或环境检查，应留在受控验证语义中，而不是继续占据正式首页叙事中心

### B. Sidecar

当前涉及文件：

- `src/app/layout/app-layout.tsx`
- `src/app/layout/entry-sidecar.tsx`
- `src/app/providers/collaboration-session-provider.tsx`

需要保留的正式骨架：

- 开始按钮
- Sidecar 打开 / 关闭与跨路由保持
- 快捷键打开
- 本地入口卡片兜底

这些能力目前更接近登录后 `workbench shell` 的验证骨架，而不是单独的 demo 页面。

当前混入的 demo 语义：

- 仅在首页路径上，通过特定触发词直接命中第三工作区 demo
- system reply 直接把这条链路描述为“打开第三工作区 demo”
- 这条桥接逻辑放在 stable 的 session provider 中，容易被误读成正式 Sidecar 语义

隔离要求：

- 命名隔离：明确这是“demo trigger”或“过渡验证触发词”，不是正式自然语言入口 contract
- 文案隔离：任何由该触发词打开的结果，都必须继续明确写出 `demo` / `验证` / `过渡`
- 行为隔离：不把“输入触发词即可打开第三工作区”写成正式 Sidecar 能力说明
- 语义隔离：保留 Sidecar 作为全局壳层能力，但不把这条 demo 触发链路并入正式首页模块体系

后续去向：

- 若将来真的存在“Sidecar 产出长结果物后切入第三工作区”的正式能力，应重新定义正式 intent、状态来源与退出路径
- 当前触发词桥接只负责验证“是否值得跳层”，不直接升级为正式语义

### C. 第三工作区

当前涉及文件：

- `src/app/layout/third-workspace-demo-host.tsx`
- `src/shared/third-workspace-demo/model.ts`
- `src/shared/third-workspace-demo/canvas.tsx`
- `src/labs/demo/page.tsx`

需要保留的正式骨架：

- `AppLayout` 中的第三工作区挂载位
- layout 为更宽结果物预留独立层的能力

这些东西属于工作台壳层结构验证，可继续存在。

当前明确属于 demo 的部分：

- `ThirdWorkspaceDemoHost`
- `workspaceDemo` query 参数
- demo artifact 数据
- `ThirdWorkspaceDemoCanvas`
- `/labs/demo` 页面上的“跳到第三工作区”验证流程

隔离要求：

- 路由隔离：正式 demo 入口继续留在 `/labs/demo`，不把 demo 页面语义并回 `/`
- query 隔离：`workspaceDemo` 只作为当前 demo 状态来源，不升级为正式第三工作区 URL 契约
- 文案隔离：Canvas、Sidecar reply、labs 页面继续明确写出 `Demo` / `验证`
- 目录隔离：不继续扩大 `src/shared/third-workspace-demo` 的复用面，避免看起来像稳定共享能力

后续去向：

- 若第三工作区被验证为正式能力，应重新确定正式 view state、导航语义与宿主边界
- 当前隔离 demo 语义，不只是为了“去 demo”，也是为了给后续正式的 Artifacts Canvas / 第三工作区体系让出正确的语义空间
- 若它继续只是过渡验证，则应逐步把桥接入口收回到 `/labs/demo` 等受控场景，而不是继续从正式首页侧向触发

## 哪些能力不应被一并打成 demo

P1-2 的目标不是把整个 `AppLayout` 都打回实验态。

以下能力当前仍可视为正式壳层骨架验证的一部分：

- `AppLayout` 作为当前 `workbench shell` 雏形
- 开始按钮与 Sidecar 常驻位
- Sidecar 对主区的宽度让渡
- 第三工作区挂载位
- 全局 overlay root

真正需要隔离的是：

- demo trigger
- demo artifact
- demo query 状态来源
- demo canvas 文案与桥接流程
- 把过渡态首页误表述成正式工作台模板的命名与文案

## 四类隔离方式

### 1. 命名隔离

- 继续保留带有 `Demo` 的名称，不去掉该标识
- 对当前首页过渡内容，避免使用“正式首页模块”“默认首页模板”这类命名
- 若某逻辑只服务当前验证，不放在会被自然理解为长期复用语义的名字下

### 2. 路由隔离

- `/labs/demo` 继续承担第三工作区 demo 的正式试验入口
- `/` 不继续承诺 demo 首页内容
- 不把 demo query 参数写进登录后默认入口语义

### 3. 文案标识隔离

- 凡是命中 demo 触发链路的文案，都显式说明这是 demo / 验证 / 过渡能力
- 凡是描述当前首页的文案，都避免把过渡态页面写成“默认正式工作台已经定稿”

### 4. 目录归属隔离

- 中性的壳层 host 继续留在 `src/app/layout`
- 正式首页内容继续留在 `src/pages/home` 与对应 `feature`
- 当前允许 `src/shared/third-workspace-demo` 作为过渡实现继续存在，不要求在 P1-2 立刻搬迁目录
- 但 demo 结果物、demo trigger、demo canvas 不应继续扩大成通用 `shared` 事实标准
- 该目录当前只表示“已存在的过渡实现”，不构成稳定共享能力先例
- 若后续仍需保留这套桥接，但又尚未形成正式能力，应把它收束成更明确的过渡实现，而不是继续伪装成稳定共享模块

## 当前最值得优先修正的误导点

1. `src/app/lib/local-entry-catalog.ts` 中把 `首页` 描述为“默认入口页”，容易让当前过渡态首页被误解为正式默认模板
2. `src/app/providers/collaboration-session-provider.tsx` 中首页触发词直接打开第三工作区 demo，容易让 demo 桥接看起来像正式 Sidecar 合同
3. `src/shared/third-workspace-demo/*` 当前名字虽然带 `demo`，但目录位置过于接近稳定共享能力，后续需要避免继续外扩

## 当前隔离映射清单

- `src/app/lib/local-entry-catalog.ts`：首页入口卡片文案不得把当前过渡态首页表述成正式默认模板
- `src/app/providers/collaboration-session-provider.tsx`：demo bridge 的触发回复必须继续显式标明 `demo / 验证 / 过渡`，不伪装成正式 Sidecar 合同
- `src/shared/third-workspace-demo/model.ts`：demo trigger 与 `workspaceDemo` 只保留 demo 语义，不扩展为正式第三工作区入口契约
- `src/app/layout/third-workspace-demo-host.tsx`：继续作为 demo host，而不是第三工作区正式状态宿主
- `src/shared/third-workspace-demo/canvas.tsx`：文案与展示继续明确属于 demo canvas，不冒充正式 Artifacts Canvas
- `src/labs/demo/page.tsx`：实验页继续作为受控验证入口，文案上明确其验证性质

## 当前暂行口径

- demo trigger 只接受显式 demo 语义，不再使用容易被误解为正式能力的宽泛触发词
- `workspaceDemo` 继续只作为当前 demo bridge 的临时状态来源，不升级为正式第三工作区 URL 契约
- 在 P2 / P3 重新建模前，不扩大 demo trigger 与 `workspaceDemo` 的触发面和复用面
- 若未来需要正式化第三工作区入口，应通过新的正式 route / intent / view state 重新定义，而不是直接沿用当前 demo 参数
- 当前腾出的“第三工作区”语义空间，预留给后续正式的 Artifacts Canvas / 更宽结果物挂载体系，而不是继续被 demo 参数占用

## 当前推荐实现顺序

1. 先修正文案与命名，防止过渡态首页继续被误表述成正式默认模板
2. 再明确 Sidecar 中哪些输入触发只属于 demo bridge，哪些属于正式入口能力
3. 再决定第三工作区 demo query 是否继续只留在受控验证链路
4. 最后在 P1-3 中准备最小默认工作台兜底，不让 demo 内容继续填补正式首页空位

## 完成标准

- 已列出首页、Sidecar、第三工作区中哪些属于 demo / 过渡验证
- 已明确哪些壳层骨架可以继续保留，哪些桥接逻辑不应继续扩散
- 已给出命名、路由、文案、目录四类隔离方式
- 已给出文件路径级隔离映射，能逐项验收当前 demo 语义是否仍被正确限制在受控范围内
- 已标明后续哪些能力可以转正，哪些必须重建而不能直接继承当前 demo 语义
- `P1-2` 可以在命名、文案、触发面与 `workspaceDemo` 用途都已隔离后先关闭
- `P1-2` 不要求在本阶段完成第三工作区正式建模，也不要求立刻迁移现有 demo 目录
