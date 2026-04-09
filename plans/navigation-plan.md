<!-- plans/navigation-plan.md -->

# Navigation Plan

> 状态：`-plan`（由 `navigation-direction.md` 升级）

## 已锁定决策

### 1. 菜单属于 `AppLayout` 的 layout capability

正式菜单不做成独立 "导航页" 或首页替代物，而是 `AppLayout` 的可选能力：

- 以 `none / rail / full` 档位存在，不是全站默认前提
- 第一批启用范围只收 `admin` 域
- 首页、轻工作台、AI 强协作页保持 `none`
- 菜单回归后，首页仍是摘要与入口，不退化为普通菜单落地页
- Sidecar 与协作入口保留独立角色，不被侧边菜单吞并

以下规则已落入 `docs/layout.md` §3.1，此处不重复：顶/左分工、`full` 允许退化为 `rail`、Sidecar 空间竞争优先级、`hydrating` 中性骨架、Breadcrumb 禁止。

### 2. 一级骨架按 4 个主身份独立设计

| 主身份    | 说明                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| `ADMIN`   | 独立骨架，当前第一批启用目标                                                  |
| `STAFF`   | 独立骨架，与 `ADMIN` 不默认做成继承关系；跨身份共享入口通过 manifest 投影实现 |
| `STUDENT` | 独立骨架                                                                      |
| `GUEST`   | 第一版保持 `none` 或极轻量导航；具体形态在实现前单独收口                      |

附注：

- `REGISTRANT` 不进入正式菜单，只保留最小壳层与资料补全入口
- `GUEST` 处于 authenticated shell 内，与未登录公开页不是一回事

### 3. `slotGroup` 承接增量全局职责，不改写主身份骨架

- `slotGroup` 只往全局菜单插入职责型入口，不改变一级骨架所属身份
- 第一版示例锚点：`CLASS_ADVISER`（正式进入 token / `me` contract 前先作示例）
- 第一版默认一级平铺，不嵌入其他业务父节点；活跃 slot 超数量阈值时重新评估分组策略
- context switcher 只在以下条件全部满足时再评估：有独立 landing page、有成体系二级菜单、与主骨架心智边界足够清晰

**进入全局菜单的准入门槛（同时满足）：**

- 有明确职责边界，有独立 landing page
- 能跨页面持续存在，不是单对象临时能力

不满足时，优先留在页面级 action、首页模块入口或 Sidecar / command 入口。

### 4. 菜单状态机

**状态：** `none` · `rail` · `drawer / flyout` · `full`

- `rail`：约一个图标列宽，有独立交互节奏；`full` 发起的默认起点
- `drawer / flyout`：`rail` 下 click / focus 触发的临时展开态，不长期占位，**不是** `full` 的别名
- `full`：用户显式 `pin` 后的真正占位态；受 `main` 最小宽度约束，可自动退化为 `rail`

**合法转移：**

- `rail → drawer`：click / focus（不以 hover 作为唯一默认语义）
- `drawer → rail`：失焦 / 关闭
- `drawer → full`：用户显式 pin
- `full → rail`：用户折叠 / layout 自动折叠（main 宽度不足时）
- `full / rail → none`：页面级 capability 配置

**v1 明确不做：** 左栏 / Sidecar 拖拽调宽、拖拽磁吸折叠、顶栏透明 / 毛玻璃材质。

### 5. 菜单交互基线

- 图标在 manifest 中记录 `iconKey`，由渲染层统一映射；默认线性风格，选中态按需强调
- 状态层次至少包含 `default / hover / selected / disabled`；推荐保留约 2px 主色左侧 active indicator
- 菜单只承载有稳定 landing page 的全局入口；页面动作继续留在 Header / 工具栏
- 顶栏 command 入口持续提供快捷键暗示（当前基线：`Alt+K`）；command 可投影菜单入口，但范围不限于菜单
- `hydrating`：有可信 snapshot 时骨架可接近最终态；无时保持中性空态，不伪造权限层级或入口数量

### 6. 路由与菜单关系

- route = 页面可达真相；menu = 可导航入口的受控投影
- 各业务域导出自己的 `navigation meta`，壳层挂载时聚合，结合 authenticated snapshot 过滤投影
- manifest 保持纯数据，不过早内嵌渲染组件；页面归属保持单一

**navigation meta 最小字段（实现前确认字段名）：**

- 是否进入菜单 / 属于哪个 `primaryAccessGroup`
- 是否受 `slotGroup` 控制 / 导航能力档位（`none / rail / full`）
- 默认 landing page，二级菜单归属

### 7. JWT / 会话结构补充

不改写 `docs/project-convention/identity-access-session.md` 已有规则，仅补充菜单相关方向：

- `accessGroup` 只承载主入口授权语义（ADMIN / GUEST / REGISTRANT / STAFF / STUDENT）
- `slotGroup` 承载增量全局职责，值应进受控枚举，后续补 canonical 枚举表
- 资源关系不进 JWT；页面内对象临时权限继续留在上下文
- 菜单渲染消费完整 `me snapshot`，不在 `hydrating` 阶段用未完成 token 推断正式菜单
- `primaryAccessGroup` 前端当前可基于 `identity + accessGroup` 推导，暂不强制进 JWT；跨端需统一时再评估

## 开放项（实现前需收口）

- [ ] `GUEST` 第一版轻导航形态与文案
- [ ] `slotGroup` canonical 枚举表
- [ ] `admin` 域各页面 `none / rail / full` 精确启用原则
- [x] 左栏 / 主画布 / Sidecar 空间竞争的精确宽度阈值与折叠优先级表 → 已落 `NAV_MAIN_MIN_WIDTH_WITH_FULL = 480`，见 `docs/navigation.md`
- [x] 菜单状态机持久化策略 → v1 不持久化，每次从 `none` 起始
- [x] navigation manifest 最小字段名与承载位置 → 已落 `docs/navigation.md`

## 行动项

### P1 — 文档补全

- [x] `docs/project-convention/identity-access-session.md`：补充 `slotGroup` 进入全局菜单的正式语义
- [x] 新增 `docs/navigation.md`：沉淀菜单准入规则、状态机规则、manifest 约定

### P1 — 收口为实现基准

- [ ] `ADMIN` 一级菜单骨架草案（具体菜单项待 admin 路由建立时填入）
- [ ] `GUEST` 第一版轻导航形态（当前已决定保持 `none`，文案待页面存在时收口）
- [ ] `CLASS_ADVISER` 插槽示例挂载位置
- [ ] `admin` 域页面 `rail / full` 精确启用原则
- [x] 菜单状态机合法转移表 → 已落入 `docs/navigation.md`
- [x] navigation manifest 最小字段定义 → 已落入 `docs/navigation.md`
- [ ] `STAFF + CLASS_ADVISER` 合并菜单投影示例
- [ ] 跨主身份共享入口的 manifest 归属示例
- [ ] 菜单尺寸基线、active indicator 与 hydrating 骨架的视觉基线

### P2 — 实现

1. [x] `AppLayout` 补 `sidebar / nav-rail` capability 开关 → `src/app/providers/nav-capability.ts`、`nav-capability-provider.tsx`，已接入 AppLayout
2. [ ] `admin` 域按业务域逐步启用正式菜单，不一次性全站铺开
3. [ ] 各业务域导出自己的 navigation meta，接入壳层聚合

## 结论

以 `layout capability` 方式补回受控菜单能力：用 4 个主身份决定一级骨架，用 `slotGroup` 承接附加职责插槽，用页面上下文权限承接单对象临时能力，用完整 session snapshot 驱动正式菜单渲染。
