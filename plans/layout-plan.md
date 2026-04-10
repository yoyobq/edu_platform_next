# Layout Plan

本文件记录 layout 当前仍在推进的计划、已拍板决策与后续行动项。
已完成的历史主线不再在此重复展开。

## 当前结论

当前这轮 layout 验证可以视为阶段性完成。

已确认的前提：

- 当前 `/` 已是登录后默认工作台入口，但首页信息架构仍只是最小基线
- `PublicEntryLayout` 与 `AppLayout` 两套壳层已经存在并稳定运行
- Sidecar、Overlay、第三工作区和 Omni trigger 的最小结构都已验证过
- `labs/demo` 仍是第三工作区 demo 语义的受控实验域

因此下一阶段不再继续扩展当前基线首页上的 layout 复杂度，而是优先处理 authenticated 壳层细分、第三工作区正式状态来源与 Omni 角色定义。

## 已确认风险

以下提醒仍然有效，后续进入下一轮实现时应继续遵守：

### 1. 键盘与焦点竞争仍是高风险区

- `main` 内阻断型 Modal 优先于所有其他快捷键
- `main` 内局部浮层优先于 Sidecar
- Sidecar 高于页面级全局快捷键
- 页面级全局快捷键最低

### 2. `Session State` 与 `View State` 不能重新混写

- 会话、消息、错误、生成状态继续留在会话层
- Sidecar、第三工作区、未来 Omni 的开关与形态继续留在视图层

### 3. 业务响应式仍应优先看真实可用宽度

- Sidecar / 第三工作区对 `main` 的挤压不能退回成只看 viewport
- 优先继续使用容器宽度或等效观测方式

### 4. E2E 继续默认禁用动效

- 后续只要引入新的 layout 动效，测试环境仍必须可统一关闭

## 决策前置项

以下事项已完成方向性决策；本文件后续只继续保留对应的收尾动作与后续评估点。

### [x] 1. `AppLayout` 当前不再继续拆第二套 authenticated shell

当前决策：

- 保持单一 `AppLayout` 继续演进
- 若某些 authenticated 页面不需要顶栏局部元素、Sidecar、开始按钮或第三工作区挂载位，优先使用同一壳层内的受控显隐 / capability 开关
- 不为这类差异单独再拆第二套 authenticated shell

保留的触发条件：

- 只有当页面差异已经超出 host 显隐，开始涉及完全不同的头部结构、滚动模型或主骨架时，才重新评估是否拆子壳

后续动作：

- 继续把可选 host 能力收成明确的 layout capability 开关
- 避免页面直接依赖布局私有状态

### [x] P1. 侧边导航能力回归为底座能力

当前结论：

- 不把“完全不给左侧导航”继续写成底座前提
- `AppLayout` 已补受控的 `sidebar / nav-rail` capability，代码已落 `src/app/providers/nav-capability.ts`、`src/app/providers/nav-capability-provider.tsx`、`src/app/layout/app-layout.tsx`
- 这项能力是底座可选项，不是新的默认统治布局

当前固定边界：

- 默认仍保持当前轻导航方向
- 侧边导航能力与 `main`、Sidecar、第三工作区并存，不替代它们
- public entry 与其他尚未拆出的轻壳页面可以继续不启用侧边导航
- 信息架构更深、模块更多的业务域可按需启用侧边导航

当前落地范围：

- capability 已按 `none / rail / full` 三档接入
- 当前 admin 导航 capability 按 `accessGroup` 中是否包含 `ADMIN` 启用；首页 `/` 已纳入首批 admin 菜单投影
- 首批菜单投影已集中落在 `src/app/layout/navigation-meta.ts`，覆盖首页与 `Labs` 分组下的实验入口
- `full -> rail` 自动折叠与 `rail -> full` 恢复阈值已落地（`480 / 680`）

保留的提醒：

- 不把左栏重新升级成所有页面的默认主导结构
- 不让侧边导航与 Sidecar 争夺主协作层角色
- 不因为补回常见底座能力，就把首页工作台退化成普通菜单落地页

检查后确认的剩余缺口：

- `rail -> drawer / flyout` 目前只有状态字段，壳层 UI 尚未接线
- navigation meta 仍是集中 registry，尚未切到“各业务域导出、壳层聚合”
- 还没有看到导航状态机专项 E2E 覆盖

后续动作：

- 收口 `admin` 域页面 `none / rail / full` 精确启用原则
- 按业务域拆出 navigation meta，并接入壳层聚合
- 补 `rail -> drawer / flyout -> pin -> full` 的真实交互
- 补菜单尺寸基线、active indicator 与 hydrating 骨架的视觉基线
- 为导航 capability 增加专项 E2E 覆盖

当前不进入第一版基线的后续方向：

- 左栏 / Sidecar 的自由拖拽调宽
- 拖拽过程中的磁吸折叠
- 顶栏透明 / 毛玻璃材质

### [x] 2. 第三工作区正式态不再继续以 URL 作为默认状态来源

当前决策：

- `workspaceDemo` 继续只保留在 `/labs/demo` 等受控实验域
- 第三工作区正式态应进入独立 `View State`
- URL 只保留 demo 验证或未来少量真正有分享价值的稳定入口参数

保留的提醒：

- 现在 URL 方案很适合 demo 验证与跨页面触发
- 但正式第三工作区不应把打开态、当前 artifact、退出路径默认塞进 URL

后续动作：

- 正式第三工作区落地时，优先设计独立 view state
- 未来若要把个别状态映射到 URL，必须单独证明其分享价值与稳定语义

### [x] 3. Omni 入口当前先收敛为轻命令入口

当前决策：

- 当前 Omni 先定义为轻命令入口
- 不在这一轮把它直接扩成“全局搜索 + 命令 + 最近操作”的复合中枢

保留的提醒：

- 当前实现里只有 trigger 占位，没有独立 Omni host
- 若后续要并入全局搜索、最近操作或更重的导航语义，需要再单独立项

后续动作：

- 继续把 Omni 与 Sidecar 视为补充关系，而不是立即做功能分流
- 先围绕轻命令入口建立最小交互，再决定是否扩展职责

## 构建治理

### [x] 4. 构建 chunk 拆分进入轻量治理阶段

当前决策：

- 前置条件已满足，可以开始做轻量治理
- 先做高确定性的 route-level lazy 和小范围拆分
- 暂不做重型、长期绑定的手工 chunk 架构

当前约定：

- 实施口径已落到 `docs/chunk-strategy.md`

保留的提醒：

- 当前 `/` 已是正式入口，但首页内容与 authenticated 壳层仍在演进
- 当前主包体积分布不应被过早当作长期最终拆分基线

后续动作：

- 先识别最重且稳定的入口依赖块
- 优先处理收益明确的小拆分
- 等首页模块和 authenticated 壳层进一步稳定后，再决定是否需要更长期的 chunk 方案

## 探索后置项

以下事项继续保留，但默认排在上述决策项之后。

### [ ] 5. Omni-bar 真正落地

前提：

- 先完成 Omni 角色定义

### [ ] 6. Artifacts Canvas 默认分屏平移方案

前提：

- 先完成第三工作区正式状态来源决策

### [ ] 7. 渐进式披露 AI 能力层级

### [ ] 8. 近场微干预

### [ ] 9. 视觉牵引线 / 接地增强

前提：

- 保持基于现有 Overlay root 演进，不反向侵入业务 DOM

### [ ] 10. 动效状态语言

### [ ] 11. 在场感旋钮 / 撤离速度

## 当前推荐顺序

1. 按业务域拆出 navigation meta，并替换当前集中 registry
2. 收口 `admin` 域页面 `none / rail / full` 启用原则与一级骨架
3. 在 `AppLayout` 内继续补 capability 开关，而不是拆第二套 authenticated shell
4. 为第三工作区正式态设计独立 view state
5. 以轻命令入口推进 Omni 的最小交互
6. 进入高确定性的轻量 chunk 治理，再进入 P3 探索实现
