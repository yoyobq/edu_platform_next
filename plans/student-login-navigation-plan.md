<!-- plans/student-login-navigation-plan.md -->

# Student Login Navigation Plan

> 状态：`P0 部分落地`（student navigation、student account menu、学期校历测试入口已接入）

## 背景

学生注册链路已经从旧 invite 流程拆出，并引入邮箱验证后登录：

- 注册入口：`/invite/student-registration/:token`
- 注册成功账号状态：`PENDING`
- 登录邮箱验证完成后，学生才能登录

下一步要完善 student 登录后的站内体验。这里最重要的边界是：

**student 和 staff/admin 的菜单、账户菜单、默认落点必须分开建模，不在同一套业务组件上堆角色分支。**

## 决策

- `NavSidebar` 这类纯渲染器可以共享；它只负责把 `NavigationMetaItem[]` 渲染成 antd `Menu`。
- staff/admin 导航继续走现有 provider 体系：
  - `academic-affairs`
  - `upstream-data-sync`
  - `admin`
  - `labs`
  - `sandbox`
- student 导航新增独立 provider，不把学生菜单塞进 staff/admin provider。
- 账户菜单按身份族拆开：
  - staff/admin：保留现有复杂账号切换、主题、字体、个人资料入口
  - student：新建 student 专用账户菜单，先保持轻量
- `AppLayout` 只做身份族选择，不承载大量 `isStudent ? ... : ...` 菜单内容分支。
- 共享只能发生在无业务语义的小组件或工具函数层，例如头像、主题切换、字体切换、登出按钮。

## 目标

P0 目标：

- 学生登录后不会看到 staff/admin 的任何菜单项。
- staff/admin 菜单不因为 student 支持引入学生分支。
- 学期校历作为 student 第一条真实菜单项，用于验证 student 登录后的导航、权限和布局。
- student 有独立默认落点，登录恢复、路由 guard、导航高亮一致。
- 未验证邮箱学生登录失败仍在登录页展示明确文案。

P1 目标：

- student 账户菜单具备独立 UI 与操作列表。
- student 首页/工作台可独立演进，不受 staff 首页信息架构限制。
- 测试覆盖 student 登录后可见菜单与 staff/admin 隔离。

非目标：

- 不在本计划中设计完整学生业务门户。
- 不把 staff/admin 现有账户切换功能迁移给 student。
- 不为了复用而建立“大一统 AccountMenu”。

## 建议结构

### Navigation

新增：

```text
src/app/navigation/providers/student.ts
```

职责：

- 只返回 student 可见的导航目录。
- 只依赖 `NavigationFilter` 和稳定 access 判断。
- 不导入 staff/admin provider。

初始菜单建议保持极简：

- 首页：`/`
- 学期校历：`/calendar-schedule/semester-calendar`
- 我的课表：待真实学生课表页面稳定后挂入
- 我的资料：可先指向 `/profile` 或后续 student profile 页面

学期校历首版处理：

- 复用现有页面与 route：`/calendar-schedule/semester-calendar`
- 不复制 `SemesterCalendarPageContent`
- 在 student provider 中单独声明同一路径的 student 菜单项
- 不把 `STUDENT` 加进 staff/admin 的 `academic-affairs` provider 作为捷径
- 如果后端当前只允许 staff/admin 读取学期和校历事件，需要后端放开学生登录态的只读权限

`src/app/navigation/catalog.ts` 聚合 provider 时，student provider 独立加入：

```text
home -> student -> academic-affairs -> upstream-data-sync -> labs/sandbox -> admin -> errors
```

是否允许 `home` 继续共享：

- 可以。`home` 是跨身份入口，不包含 staff 业务菜单。
- 首页内容本身需要按身份族在页面层分开渲染。

### Account Menu

建议拆成：

```text
src/app/layout/staff-account-menu.tsx
src/app/layout/student-account-menu.tsx
src/app/layout/account-menu-trigger.tsx        // 可选，无业务语义
src/app/layout/account-menu-shared-controls.tsx // 可选，主题/字体/登出等小控件
```

迁移策略：

- 现有 `account-menu.tsx` 可先重命名为 `staff-account-menu.tsx`。
- `AppLayout` 根据 session 身份族选择 `StaffAccountMenu` 或 `StudentAccountMenu`。
- 如果为了降低一次性 diff，也可以先保留文件名，但导出 `StaffAccountMenu`，新增 `StudentAccountMenu` 后再重命名文件。

student 账户菜单首版内容建议：

- 头像 + 昵称/登录邮箱
- 个人资料
- 主题切换
- 字体大小
- 退出登录

暂不包含：

- 增加另一个账号
- 多账号切换
- upstream 相关重认证
- staff/admin 专属工作台入口

### Layout Selection

`AppLayout` 中新增明确身份族判断：

```text
isStudentSession = accessGroup includes STUDENT and not ADMIN/STAFF
isStaffWorkspaceSession = ADMIN or STAFF
```

边界：

- 不能让 `StudentAccountMenu` 接收 staff/admin 专属 props。
- 不能让 `StaffAccountMenu` 内部出现 student 菜单项。
- `AppLayout` 可以选择组件，但不直接拼 student 菜单内容。

若后续出现混合身份账号：

- ADMIN/STAFF 优先进入 staff workspace。
- 单纯 STUDENT 进入 student workspace。
- 混合身份切换如果需要用户手选，应另设身份切换模型，不在本计划首版处理。

## 路由与 Guard

当前 `navigationPageLoader` 通过 `canAccessNavigationPath` 判断导航路径访问权限。

落地 student provider 后：

- student 页面必须有对应 navigation item，才能通过现有导航权限模型。
- staff/admin 页面不应把 `allowedAccessGroups` 扩给 `STUDENT`，除非该页面确实是跨身份公共页面。
- student 默认落点需要和登录成功 redirect 对齐。

建议新增或确认：

- student 登录成功默认进入 `/`
- `/` 的页面内容按身份族分流
- student 不可访问 staff/admin 导航路径，返回 403 或被 redirect 到合适入口

## 测试计划

P0 测试：

- student 登录成功后可进入首页。
- student 登录成功后可从 student 菜单进入“学期校历”。
- student 登录后侧栏/顶部菜单只出现 student 目录，不出现：
  - 系统管理
  - 教务/教学 staff 管理项
  - Labs
  - 上游数据同步
- student 可访问 `/calendar-schedule/semester-calendar`，但不可访问同组 staff/admin 课表与教务页面。
- staff/admin 登录后现有菜单不变。
- 未验证邮箱学生登录失败展示 `请先验证登录邮箱`。

P1 测试：

- student account menu 不展示“增加另一个账号”与 staff/admin 专属切换逻辑。
- student 点击退出登录回到 `/login?skipRestore=1` 或现有登录入口约定。
- staff/admin account menu 仍保留账号切换能力。

测试层级建议：

- navigation provider 过滤规则用 unit test。
- 登录后菜单可见性用 e2e。
- 未验证邮箱登录错误可以继续在 login e2e 中覆盖。

## 后端契约依赖

本计划默认依赖现有 session/me 结果能表达：

- `userInfo.accessGroup` 包含 `STUDENT`
- 学生账号邮箱未验证时登录失败返回：
  - `AUTH_LOGIN_EMAIL_NOT_VERIFIED`
- 学生登录态可只读查询学期与校历事件：
  - `academicSemesters`
  - `academicCalendarEvents`

若后续 student 首页需要展示班级、学籍、课表摘要，需要后端另给 student profile / dashboard 查询。

首版菜单拆分不等待这些业务查询；但学期校历作为第一条 student 菜单项，需要先确认或补齐上述只读权限。

## 分步实施

### P0：边界先落地

- 新增 student navigation provider。
- `catalog.ts` 接入 student provider。
- 新增 `StudentAccountMenu`。
- `AppLayout` 按身份族选择 account menu。
- 增加 navigation/provider unit test。
- 增加 student 登录后菜单隔离 e2e。

### P1：体验补齐

- 独立 student 首页内容。
- student account menu 视觉和信息层级细化。
- 学生个人资料入口明确到稳定页面。

### P2：业务菜单扩展

- 我的课表。
- 我的课程/成绩/通知等真实学生业务入口。
- 这些入口逐个由业务 owner 提供 route、loader 和 access guard。

## 风险与约束

- 不要让 `allowedAccessGroups: ['ADMIN', 'STAFF', 'STUDENT']` 成为偷懒默认值。
- 不要把 student 菜单挂在 `academic-affairs` 这类 staff/admin 语义 provider 下。
- 不要把 student account menu 做成现有 account switch 菜单的配置版。
- 不要为了减少文件数牺牲身份族边界；后续菜单会快速分化。

## 完成标准

- student 登录后导航与账户菜单有独立组件/数据入口。
- staff/admin 原有导航与账号切换不回归。
- 至少有一条 e2e 证明 student 看不到 staff/admin 菜单。
- 相关稳定规则在实现落地后迁移到 `docs/project-convention/`，本计划只保留后续事项。
