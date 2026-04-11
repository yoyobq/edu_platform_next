# Admin User List Follow-up

`/admin/users` 的稳定规则已经移入 [../docs/project-convention/admin-user-list.md](../docs/project-convention/admin-user-list.md)。

本文件只保留当前列表页落地后的剩余事项，不再作为主规则来源。

## 已对齐结论

- 详情页正式路由固定为 `/admin/users/:id`
- 详情页继续挂在当前 authenticated shell 内，权限策略与 `/admin/users` 保持一致，并复用现有 `adminUsersLoader`
- 列表进入详情页的主入口固定为 `账户 ID` 单元格，不新增独立“详情”列
- 不采用整行点击进入详情，避免与账户状态快捷切换等行内操作冲突
- 列表当前默认仅看 `staff`，不再保留“全部用户”筛选项
- 列表继续保持扫读优先；登录名、登录邮箱、昵称、手机号、职务、部门、用户状态、staff 在职状态等细节字段继续下沉到详情页
- 详情页首版已拆到独立 page / feature，不继续把详情逻辑塞回列表 feature

## 当前实现状态

- `/admin/users/:id` 已可浏览，页面入口与路由已打通
- `/admin/users` 当前默认仅看 `staff`，并已在列表内展示 `在职状态`
- 列表内当前支持两类快捷修改：
  - 账户状态
  - `staff` 在职状态
- 列表当前已支持多选，并可批量修改账户状态与 `staff` 在职状态
- 列表当前已将搜索、筛选、分页、排序同步到 URL search params；进入详情页和返回列表会保留上下文
- 当前页面位置：
  - `src/pages/admin-user-detail/`
  - `src/features/admin-user-detail/`
- 当前 GraphQL 对接位置：
  - `src/features/admin-user-detail/infrastructure/admin-user-detail-api.ts`
- 首版详情页已正式消费以下数据：
  - `account(id)`
  - `userInfo(accountId)`
- 页面当前已展示以下信息块：
  - 账户信息
  - 用户信息
  - 最近登录
- `staff` 区域当前保留占位，不伪造前端假数据；完整 staff 详情仍待详情页查询契约补齐
- 页面最小反馈面已具备：
  - `isForbidden`
  - 非法账户 ID
  - loading
  - 请求失败重试

## P1 收尾范围

### 1. 细化“账户不存在 / 无法读取”语义

当前实现里，详情请求失败会统一落到通用错误态；但“账户不存在”“账号存在但 userInfo 不可读”“后端临时错误”这几类场景还没有拆开。

因此 P1 还需要补一层明确约定：

- GraphQL 在这些场景下分别返回什么
- 前端是否需要区分文案和空态
- 哪些情况允许继续展示部分详情，哪些情况直接视为失败

### 2. 补最小 E2E 与 mock

当前仓内还看不到详情页对应的 E2E / mock 收口。

最小主线仍建议固定为：

- 未登录访问详情页，跳登录且带 `redirect`
- 非 admin 访问详情页，显示 `403`
- admin 可从列表进入详情，并看到列表中已下沉的字段
- 请求失败时能看到错误反馈并重试

同时需要补的测试基建仍包括：

- `e2e/fixtures/routes.ts` 增加 `adminUserDetail(id)` 路由 helper
- `e2e/helpers/app.ts` 为详情 query 增加 mock 分支
- 默认 seed 尽量继续复用现有 admin user 数据，避免列表与详情两套假数据漂移

### 3. 等待 staff / identity 契约补齐后再扩展详情块

当前仓内能稳定消费的详情来源已经明确为：

- `account(id)`
- `userInfo(accountId)`

但要把 `staff` 区域从占位变成正式信息块，仍缺稳定来源，例如：

- `staff.id`
- `staff.name`
- `staff.jobTitle`
- `staff.departmentId`
- `staff.employmentStatus`

在后端补齐按 `accountId` 读取 identity / staff 的能力之前，首版详情页继续接受只展示 `account + userInfo + recentLoginHistory`。

## P2

- 评估是否需要为当前“默认仅看 staff”的 admin 用户列表补独立空态文案或结果摘要文案细化
- 若后端后续补强聚合查询，再决定是否引入 staff 更多上下文而不回涨列表宽度

## 当前结论

admin 用户列表主线已经完成，admin 用户详情页首版也已经落地；当前不再需要讨论页面脚手架或基础路由方案。

接下来真正需要收口的是三件事：

- 把“账户不存在 / 无法读取”的语义与前端反馈拆清楚
- 补齐详情页的 E2E 与 mock，并等待 staff / identity 契约成熟后再扩展示例页
