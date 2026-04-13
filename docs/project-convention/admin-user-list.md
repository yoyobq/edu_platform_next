<!-- docs/project-convention/admin-user-list.md -->

# Admin User List

本文件定义当前 `admin` 用户列表与详情页的稳定前端约定。

后端字段、筛选参数和返回结构，以 [../backend/admin-user-list-current.md](../backend/admin-user-list-current.md) 与 [../backend/schema.graphql](../backend/schema.graphql) 为准；本文件只收口前端已经落地的页面、分层和展示规则。

## 路由与权限

- 正式路由固定为 `/admin/users`
- 详情页正式路由固定为 `/admin/users/:id`
- 页面继续挂在当前 authenticated shell 内，不新增独立 admin layout
- 未登录访问时，跳转到 `/login?redirect=/admin/users`
- 非 admin 访问时，返回 `403`
- 该页面属于 admin 正式入口，不放入 `Labs`
- 列表与详情继续复用当前 `adminUsersLoader` 权限守卫口径

## 导航

- admin 导航中保留“用户管理”正式入口
- 该入口直达 `/admin/users`
- 当前仍由集中 `navigation-meta` registry 承载

## Feature 边界

当前列表页保持在独立 feature 内：

```txt
src/features/admin-user-list/
  application/
  infrastructure/
  ui/
```

固定职责如下：

- `application`
  - 定义查询参数类型、默认值与白名单
  - 编排列表查询状态
  - 对 `ui` 暴露稳定可消费的页面状态
- `infrastructure`
  - 调用 `adminUsers(...)`
  - 负责 GraphQL 输入输出适配
- `ui`
  - 负责筛选条、表格、空态、错误态、分页排序交互
  - 不直接依赖 GraphQL 或具体请求 adapter

详情页当前保持在独立 feature 内：

```txt
src/features/admin-user-detail/
  application/
  infrastructure/
  ui/
```

固定职责如下：

- `application`
  - 负责详情 section 的领域类型、读取与更新 use case
  - 对 `ui` 暴露稳定可消费的详情页状态
- `infrastructure`
  - 负责 `account(id)`、`userInfo(accountId)` 与 section update 的 GraphQL 适配
- `ui`
  - 负责详情页头部、各 section、错误反馈与返回列表交互
  - 不直接拼接 GraphQL 细节

## 查询规则

- 默认分页固定为：
  - `page = 1`
  - `limit = 10`
- 默认排序固定为：
  - `sortBy = id`
  - `sortOrder = DESC`
- 默认筛选固定为：
  - `hasStaff = true`
- 前端只允许以下排序字段：
  - `id`
  - `createdAt`
  - `loginName`
- 当前筛选控件只暴露以下两档：
  - `true`：仅看 `staff`
  - `false`：仅看无 `staff`
- 搜索、筛选变化时，列表重置到第一页
- 已应用的搜索、筛选、分页、排序同步到 URL search params
- 从列表进入详情页、再返回列表时，应保留当前 search params 上下文

## 当前列表字段

当前列表固定按以下顺序展示：

1. 账户 ID
2. 工号
3. 姓名
4. 访问组
5. 账户状态
6. 在职状态
7. 创建时间

补充约定：

- `账户 ID` 支持排序，并作为当前默认排序列
- `工号` 对应 `staff.id`
- `姓名` 对应 `staff.name`
- `在职状态` 对应 `staff.employmentStatus`
- `staff = null` 时，`工号` 与 `姓名` 显示为 `—`
- `staff = null` 时，`在职状态` 显示为 `—`
- `访问组` 与状态类字段使用 `Tag`
- `创建时间` 不直接输出原始时间串，列表中按本地时间显示到“分”
- `账户状态` 与 `在职状态` 当前都支持单条快捷修改与多选批量修改

以下字段当前不放在列表内，应留给后续详情页承接：

- 登录名
- 登录邮箱
- 昵称
- 手机号
- 职务
- staff 部门 ID
- user state
- 其他补充字段

## 详情页

- 列表进入详情页的主入口固定为 `账户 ID` 单元格
- 不新增独立“详情”列
- 不采用整行点击进入详情，避免与状态快捷切换等行内操作冲突
- 从列表进入详情页、再返回列表时，应保留当前 search params 上下文

当前详情页首版固定为以下结构：

1. 页面头部与返回动作
2. 账户信息
3. 用户信息
4. 最近登录
5. `staff` 区域

当前稳定数据来源：

- `account(id)`
- `userInfo(accountId)`

固定约束：

- 详情页当前已正式承接登录名、登录邮箱、昵称、手机号、职务、用户状态等细字段
- `staff` 区域允许存在，但在后端按 `accountId` 的 identity / staff 契约未补齐前，不伪造前端假数据
- 详情页最小反馈面必须稳定覆盖：
  - `403`
  - 非法账户 ID
  - loading
  - 请求失败后的重试
- 不因为详情页已落地，就把扫读优先的细字段重新塞回列表
- 列表与详情仍保持“列表扫读、详情承接细节”的分工

## 页面结构与反馈

- 页面结构固定为：
  - 页面标题区
  - 筛选区
  - 列表区
- 筛选区采用 inline 方案，不做 Drawer 筛选
- 加载中使用表格级 loading 或 `Skeleton`
- 空列表使用稳定空态
- 请求失败使用 `Alert` + 重试动作
- 不使用全页 `Spin` 覆盖
- 不使用 toast 充当主错误反馈

## 宽度与响应式

- 列宽应以常规桌面宽度为基线，优先避免出现横向滚动条
- 若后续字段增加，应优先评估是否下沉到详情页，而不是直接恢复高密度横向滚动表格
- 窄屏下允许表格自然收缩；若确实无法容纳，再按实际字段情况评估降级方案

## 当前阶段结论

`/admin/users` 与 `/admin/users/:id` 当前都已是正式 admin 业务页面；列表继续负责扫读与快捷操作，详情页继续承接细字段与更完整的信息块，而不是把细节型字段重新塞回列表。
