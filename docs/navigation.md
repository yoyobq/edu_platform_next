<!-- docs/navigation.md -->

# Navigation

本文件记录 `AppLayout` 菜单 capability 系统的稳定规则。

与 `layout.md` 的关系：`layout.md §3.1` 已沉淀顶/左分工、全让位规则、Sidecar 空间竞争优先级、`hydrating` 中性骨架与 Breadcrumb 规则，本文不重复，只补充菜单 capability 自身的规则。

## 菜单 capability 档位

正式菜单以 `AppLayout` 可选能力形式存在，不是全站默认前提。

| 档位   | 宽度  | 含义                                     |
| ------ | ----- | ---------------------------------------- |
| `none` | 0     | 无侧向菜单，保持当前轻导航               |
| `rail` | 48px  | 图标列；click / focus 触发 drawer flyout |
| `full` | 240px | 用户显式 pin 后的真正占位态              |

`drawer / flyout` 是 `rail` 下的临时展开态，不是独立档位，不长期占位。

当前启用范围：第一批只收 `admin` 域；首页、轻工作台、public entry、AI 强协作页保持 `none`。

## 菜单状态机

代码位于 `src/app/providers/nav-capability.ts`。

**状态集：** `none` · `rail` · `full`

**运行时辅助态：** `isDrawerOpen`（仅在 `rail` 下有效）

| 转移                       | 触发                                   | 类型             |
| -------------------------- | -------------------------------------- | ---------------- |
| `none / rail / full` → any | `setMode(mode)`                        | 受控（页面配置） |
| `rail` → drawer open       | click / focus（不以 hover 为唯一默认） | 用户显式         |
| drawer open → `rail`       | 失焦 / 关闭                            | 用户显式         |
| drawer open → `full`       | `pinToFull()`                          | 用户显式         |
| `full` → `rail`            | 点击折叠按钮                           | 用户显式         |
| `full` → `rail`            | main 可用宽度 < 480px                  | layout 自动      |

**持久化策略（v1）：** 不持久化 pin 状态；每次进入壳层从 `none` 起始，由页面配置通过 `setMode` 声明。

## 主身份菜单骨架

由 `primaryAccessGroup` 决定一级骨架框架，各身份独立设计，不默认做成继承关系。

| 主身份       | 默认档位      | 状态                   |
| ------------ | ------------- | ---------------------- |
| `ADMIN`      | `rail / full` | 第一批启用，骨架待实现 |
| `STAFF`      | `rail / full` | 骨架待实现             |
| `STUDENT`    | `none / rail` | 骨架待实现             |
| `GUEST`      | `none`        | 第一版保持 `none`      |
| `REGISTRANT` | `none`        | 不进入正式菜单         |

跨主身份共享入口通过 navigation manifest 投影实现，不在多个身份骨架下重复声明同一页面。

## `slotGroup` 插槽入口规则

详见 [project-convention/identity-access-session.md](./project-convention/identity-access-session.md) — `slotGroup 导航语义` 节。

**进入全局菜单必须同时满足：**

- 有明确职责边界，有独立 landing page
- 能跨页面持续存在，不是单对象临时能力

不满足时，优先留在页面级 action、首页模块入口或 Sidecar / command 入口。

**第一版呈现策略：**

- 默认一级平铺，不嵌入其他业务父节点
- 不默认做成 context switcher
- 活跃 slot 超导航密度阈值时，触发重新评估分组策略

## Navigation Manifest 最小字段

各业务域导出自己的 `navigation meta`，壳层挂载时聚合，结合 authenticated snapshot 过滤投影。

```typescript
type NavigationMetaItem = {
  /** 是否进入全局菜单 */
  inMenu: boolean;
  /** 属于哪个主身份的一级骨架 */
  primaryAccessGroup: 'ADMIN' | 'STAFF' | 'STUDENT' | 'GUEST';
  /** 受 slotGroup 控制（填入 slotGroup 值；null 表示不受 slot 控制） */
  slotGroup: string | null;
  /** 启用的导航能力档位 */
  navMode: 'none' | 'rail' | 'full';
  /** 稳定的 landing page 路径 */
  path: string;
  /** 显示文案 */
  label: string;
  /** 图标标识（由渲染层统一映射，不直接存 JSX 组件） */
  iconKey: string | null;
  /** 二级菜单 */
  children?: NavigationMetaItem[];
};
```

manifest 保持纯数据，不过早内嵌渲染组件；页面归属保持单一。

## 菜单交互基线

- **图标**：manifest 中记录 `iconKey`，渲染层统一映射；默认线性风格，选中态按需强调
- **状态层次**：至少包含 `default / hover / selected / disabled`
- **Active indicator**：推荐约 2px 主色左侧竖条，帮助用户在路由切换后快速定位当前页
- **菜单职责**：只承载有稳定 landing page 的全局入口；页面动作继续留在 Header / 工具栏
- **Command**：顶栏 command 入口持续提供快捷键暗示（当前基线：`Alt+K`）；command 可投影菜单入口，但范围不限于菜单

## Hydrating 骨架规则

- `hydrating` 期间不得渲染错误身份的正式菜单
- 有可信 snapshot：骨架可接近最终态（结构兼容，不伪造精确权限层级或入口数量）
- 无可信 snapshot：显示中性骨架或空态
- 避免：无菜单 → 突然跳变成完整菜单；应保持渐进可见

## 空间分配

代码常量位于 `src/app/providers/nav-capability.ts`：

- `NAV_RAIL_WIDTH = 48`
- `NAV_FULL_WIDTH = 240`
- `NAV_MAIN_MIN_WIDTH_WITH_FULL = 480`

当 `full` 左栏与 Sidecar 同时打开时，优先保护 `main` 最小宽度：

- main 可用宽度 < 480px → layout 自动从 `full` 折叠到 `rail`，不同时关闭 Sidecar
- 同时保留用户显式折叠按钮（不替代手动控制）

v1 明确不做：左栏 / Sidecar 拖拽调宽、拖拽磁吸折叠、顶栏透明 / 毛玻璃材质。
