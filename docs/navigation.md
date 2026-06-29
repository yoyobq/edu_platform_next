<!-- docs/navigation.md -->

# Navigation

本文件记录 `AppLayout` 菜单 capability 系统的稳定规则。

与 `layout.md` 的关系：`layout.md §3.1` 已沉淀顶/左分工、全让位规则、Sidecar 空间竞争优先级、`hydrating` 中性骨架与 Breadcrumb 规则，本文不重复，只补充菜单 capability 自身的规则。

## 菜单 capability 档位

正式菜单以 `AppLayout` 可选能力形式存在，不是全站默认前提。

| 档位   | 宽度  | 含义                         |
| ------ | ----- | ---------------------------- |
| `none` | 0     | 无侧向菜单，保持当前轻导航   |
| `rail` | 80px  | 图标列；当前壳层以收折态存在 |
| `full` | 240px | 用户显式 pin 后的真正占位态  |

`drawer / flyout` 仍是保留中的临时展开态设计；当前代码只保留状态接口，尚未接到壳层 UI。

当前启用范围：

- `ADMIN` 账号：只要当前会话 `accessGroup` 包含 `ADMIN`，即可启用正式侧栏；菜单可包含首页、校历课表、教务助手、班务管理、学工管理、教务管理、上游数据同步、labs / sandbox 与系统管理等入口，其中 sandbox 仅在 dev / test 暴露。
- `STAFF` 账号：当前已通过 `academic-affairs` provider 启用正式侧栏；普通 staff 可见首页、校历课表、教务助手、班务管理与 staff labs，部分 `slotGroup` 会增加每周课表、成绩汇总、学工管理、教务管理等入口。
- 纯 `STUDENT` 入口：当前已有独立轻量导航与账户菜单，最终导航树至少包含首页 `/`、`/calendar-schedule/semester-calendar` 学期校历与学生可见 labs；它不是 staff/admin 那套完整分组骨架。
- public entry 与其他尚未拆出的轻壳页面仍保持无正式侧栏导航。

## 导航真相归属

当前导航真相已收敛到 `src/app/navigation/`，不再由 `layout` 目录直接维护业务导航目录。

固定边界如下：

- `src/app/navigation/` 是当前唯一导航聚合入口
- `layout` 只负责 capability、渲染与壳层编排，不再拥有业务目录真相
- 各业务域以静态 provider 形式导出自己的 `navigation meta`
- 壳层通过聚合层统一收集、过滤并输出最终菜单树

当前已落地的 provider 归属为：

- `home`：首页 `/`，当前对 `ADMIN / STAFF / STUDENT` 等登录身份开放
- `student`：纯 `STUDENT` 账号的独立业务入口，当前贡献 `/calendar-schedule/semester-calendar`；首页仍由 `home` provider 贡献
- `academic-affairs`：
  - `校历课表`：`/calendar-schedule/semester-calendar`、`/calendar-schedule/weekly-timetable`、`/calendar-schedule/semester-timetable`
  - `教务助手`：`/academic-affairs/my-teaching-logs`、`/academic-affairs/my-curriculum-plan-homepage`、`/academic-affairs/integrated-plan-corrections`、`/academic-assistant/academic-workload`
  - `班务管理`：`/academic-affairs/student-roster-membership-reconciliation`、`/class-affairs/student-profile-filing`、`/class-affairs/course-results-summary`
  - `学工管理`：`/student-affairs/class-adviser-governance`
  - `教务管理`：`/academic-affairs/academic-calendar`、`/academic-affairs/staff-semester-profiles`、`/academic-affairs/academic-workload-report`、`/academic-affairs/academic-workload-deduction-summary`、`/academic-affairs/external-teacher-compensation`
- `upstream-data-sync`：贡献一级分组 `上游数据同步`，当前包含 `/upstream-data-sync/major-sync`、`/upstream-data-sync/class-sync`、`/upstream-data-sync/semester-course-schedule-sync`
- `admin`：贡献到最后一个一级分组 `系统管理`，当前包含 `/admin/users`、`/admin/verification-issuance`、`/system/payload-crypto`
- `errors`：贡献到最后一个一级分组 `系统管理`，当前包含 `/errors/preview`
- `labs`：
  - admin：`/labs/invite-issuer`、`/labs/upstream-session-reference`、`/labs/upstream-session-demo`、`/labs/student-course-results-pull`、`/labs/student-course-results-view`
  - admin / staff：`/labs/zquiz-activity-builder`、`/labs/zquiz-exam-teacher-gradebook`
  - student：`/labs/zquiz-exam-activities`、`/labs/zquiz-practice-activities`
- `sandbox`：`/sandbox/playground`；provider 复用结构分组 key `labs`，因此 dev / test 下合并进 Labs 分组，不单独生成顶层 Sandbox 分组

补充约束：

- `admin user detail` 当前不是导航叶子项，仍通过列表页进入
- `src/app/layout/navigation-meta.ts` 当前只作为兼容 shim，不再承载真实导航数据
- 新导航项应优先落到对应业务域 provider，而不是回填到 `layout`

## 导航与权限的关系

导航只做入口投影，不另建权限体系。

当前稳定口径：

- 具体权限能力 helper 集中归 `src/entities/auth-access/index.ts`，并通过
  `@/entities/auth-access` 消费
- `src/shared/auth-access/index.ts` 只保留 access group / slot group 常量、类型与弱业务语义约定
- router loader / guard 负责登录态、profile completion 与直达路由准入
- navigation provider 使用同一批 helper 产出正式区菜单候选
- labs provider 只为 `menu: true` 的 lab 镜像各自 `access.ts` 的 `allowedAccessLevels`
  做菜单暴露投影，不在导航层另写 lab 业务准入规则
- 受“稳定区不得依赖 labs”的单向依赖限制，navigation 不 import `labs/*/access.ts`；
  菜单可见的 lab 暴露范围变更必须同步 provider 与导航测试
- `canAccessNavigationPath()` 使用过滤后的 navigation leaf 判断路由是否可通过导航体系访问
- 页面 / feature 不应因为菜单可见而跳过自己的业务视角分流或后端接口权限

当前不允许：

- 菜单里写一套 slot 判断，router loader 再写另一套不同判断
- 页面组件内硬编码 slot 字符串来决定全局入口权限
- 只隐藏菜单但允许同一身份手输 URL 进入

导航层允许的 `accessGroup` / `slotGroup` 直接读取只限于：

- 聚合层按 manifest 的 `allowedAccessGroups` / `slotGroup` 做通用过滤
- provider 把已集中的 capability helper 或菜单可见 lab 的 `access.ts` 暴露范围投影成菜单项
- 纯 student 这类壳层导航形态分流；命名必须体现 navigation/session projection

如果菜单可见的 lab 需要在 `access.ts`、provider、router guard 之外再加业务条件，
三处必须同步同一能力口径，并补导航测试。

## 菜单状态机

代码位于 `src/app/providers/nav-capability.ts`。

**状态集：** `none` · `rail` · `full`

**运行时辅助态：** `isDrawerOpen`（仅在 `rail` 下有效；当前未接到壳层 UI）

| 转移                       | 触发                                     | 类型             |
| -------------------------- | ---------------------------------------- | ---------------- |
| `none / rail / full` → any | `setMode(mode)`                          | 受控（页面配置） |
| `rail` → `full`            | `pinToFull()`                            | 用户显式         |
| `full` → `rail`            | 点击折叠按钮                             | 用户显式         |
| `full` → `rail`            | main 可用宽度 < 480px                    | layout 自动      |
| `rail` → `full`            | main 可用宽度 >= 680px 且已记录 pin 偏好 | layout 自动恢复  |

**持久化策略（当前实现）：** `prefersPinnedFull` 持久化到 `localStorage`；进入壳层后仍先由 capability 决定基础档位，再结合可用宽度恢复到 `full`。

## 主身份菜单骨架

由 `primaryAccessGroup` 决定一级骨架的主身份语义，各身份独立设计，不默认做成继承关系。

当前实现补充：

- admin 导航 capability 以授权为准，只要 `accessGroup` 包含 `ADMIN` 即可启用
- staff 导航 capability 已启用，当前由 `academic-affairs` provider 贡献 staff 可见入口，并按 `slotGroup` 增量开放部分管理入口
- 纯 student 导航 capability 已启用独立轻量入口，当前最终菜单树包含首页、学生学期校历与学生可见 labs；其中学期校历由 `student` provider 贡献
- 账户菜单已按身份族拆分，纯 student 使用 `StudentAccountMenu`，staff/admin 继续使用 staff 账户菜单
- `primaryAccessGroup` 仍保留为主身份语义，不因 admin 入口能力而被改写

| 主身份       | 规划档位      | 当前状态                                            |
| ------------ | ------------- | --------------------------------------------------- |
| `ADMIN`      | `rail / full` | 已启用正式侧栏入口                                  |
| `STAFF`      | `rail / full` | 已启用正式侧栏入口，部分入口按 `slotGroup` 增量开放 |
| `STUDENT`    | `none / rail` | 已启用独立轻量入口：首页、学期校历、学生 labs       |
| `GUEST`      | `none`        | 第一版保持 `none`                                   |
| `REGISTRANT` | `none`        | 不进入正式菜单                                      |

跨主身份共享入口通过 navigation manifest 投影实现，不在多个身份骨架下重复声明同一页面。

## `slotGroup` 插槽入口规则

详见 [project-convention/identity-access-session.md](./project-convention/identity-access-session.md) — `slotGroup 导航语义` 节。

本节只约束菜单项与全局入口的曝光，不约束页面内部自助 / 管理视角分流。页面同时存在自助 query 与管理 query 时，必须按功能级 capability helper 判定，不能用“菜单项是否命中某个 `slotGroup`”替代页面权限。

**进入全局菜单必须同时满足：**

- 有明确职责边界，有独立 landing page
- 能跨页面持续存在，不是单对象临时能力

不满足时，优先留在页面级 action、首页模块入口或 Sidecar / command 入口。

**第一版呈现策略：**

- 默认一级平铺，不嵌入其他业务父节点
- 不默认做成 context switcher
- 当活跃 slot 已明显压缩一级导航的可扫读性时，触发一次 IA review，再决定是否需要分组

## Navigation Manifest 最小字段

各业务域导出自己的 `navigation meta`，壳层挂载时聚合，结合 authenticated snapshot 过滤投影。

```typescript
type NavigationLocalEntryMeta = {
  description: string;
  keywords: readonly string[];
};

type NavigationBaseItem = {
  key: string;
  label: string;
  iconKey: string;
  navMode: 'none' | 'rail' | 'full';
};

type NavigationLeafItem = NavigationBaseItem & {
  path: string;
  primaryAccessGroup: 'ADMIN' | 'STAFF' | 'STUDENT' | 'GUEST' | 'REGISTRANT';
  allowedAccessGroups?: readonly AuthAccessGroup[];
  slotGroup: string | null;
  localEntry?: NavigationLocalEntryMeta;
};

type NavigationGroupItem = NavigationBaseItem & {
  allowedAccessGroups: readonly AuthAccessGroup[];
  children: readonly NavigationLeafItem[];
};

type NavigationMetaItem = NavigationGroupItem | NavigationLeafItem;

type NavigationFilter = {
  accountId?: number;
  primaryAccessGroup: AuthAccessGroup;
  accessGroup: readonly AuthAccessGroup[];
  slotGroup: readonly string[];
  appEnv: 'dev' | 'test' | 'prod';
};
```

补充约束：

- 叶子项必须有稳定 landing path
- 分组项只负责结构聚合，不带 `path`，不可点击
- 导航事件只应落到 leaf；route access check 也只匹配 leaf `path`
- leaf 可通过 `localEntry` 投影到首页本地入口或 command/local entry
- 同一结构性分组若由多个业务域共同贡献子项，聚合层允许按相同 `key` 合并 children
- provider 保持纯数据或纯函数，不内嵌渲染组件，不直接依赖壳层状态

manifest 保持纯数据，不过早内嵌渲染组件；页面归属保持单一。

## 聚合出口与过滤

当前对外稳定出口统一由 `@/app/navigation` 提供，包括：

- `getNavigationItems()`
- `getNavigationLeafItems()`
- `canAccessNavigationPath()`
- `resolveNavMode()`

调用方边界固定为：

- `AppLayout` 使用 `getNavigationItems()` 与 `resolveNavMode()`
- router navigation loader 使用 `canAccessNavigationPath()`
- local entry catalog 使用 `getNavigationLeafItems()`

当前聚合层固定负责：

1. 收集各业务域 provider 导出的候选项
2. 合并同 key 的结构性分组项
3. 基于当前 `NavigationFilter` 递归过滤 children
4. 输出菜单树、叶子项列表与路径访问判断

当前稳定过滤输入为：

- `accountId`
- `primaryAccessGroup`
- `accessGroup`
- `slotGroup`
- `appEnv`

当前稳定过滤规则为：

- group 必须显式声明 `allowedAccessGroups`
- leaf 的 `allowedAccessGroups` 未显式声明时，默认只允许 `primaryAccessGroup`
- `slotGroup` 命中失败时，项或分组不进入最终树
- 分组项若过滤后没有任何 child，应整体移除
- route access check 与 sidebar 菜单树使用同一套聚合结果，不允许出现两套访问真相

当前已确认的特殊规则包括：

- `payload-crypto`：稳定页位于 `/system/payload-crypto`，只对特定 admin 账号开放
- `sandbox/playground`：只在 `dev / test` 暴露
- `sandbox/playground`：路径仍保持 `/sandbox/...`，只是导航展示合并进 Labs 分组
- `student-course-results-pull` / `student-course-results-view`：只对 admin 暴露，不对 staff labs 暴露
- `zquiz-activity-builder`：对 admin / staff 暴露，不要求教务 slot
- `class-affairs/course-results-summary`：只对 `STAFF + CLASS_ADVISER` 或 `STAFF + COUNSELOR` 暴露

这些特殊规则应继续跟随业务域 provider 归属，不回流到 layout 层。

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

- `NAV_RAIL_WIDTH = 80`
- `NAV_FULL_WIDTH = 240`
- `NAV_MAIN_MIN_WIDTH_WITH_FULL = 480`
- `NAV_MAIN_MIN_WIDTH_TO_RESTORE_FULL = 680`

当 `main` 可用宽度跌破阈值时，优先保护 `main` 最小宽度：

- main 可用宽度 < 480px → layout 自动从 `full` 折叠到 `rail`，不同时关闭 Sidecar
- 同时保留用户显式折叠按钮（不替代手动控制）

v1 明确不做：左栏 / Sidecar 拖拽调宽、拖拽磁吸折叠、顶栏透明 / 毛玻璃材质。
