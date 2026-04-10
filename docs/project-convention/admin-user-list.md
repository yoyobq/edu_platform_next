<!-- docs/project-convention/admin-user-list.md -->

# Admin User List

本文件定义当前 `admin` 用户列表的稳定前端约定。

后端字段、筛选参数和返回结构，以 [../backend/admin-user-list-current.md](../backend/admin-user-list-current.md) 与 `schema.graphql` 为准；本文件只收口前端已经落地的页面、分层和展示规则。

## 路由与权限

- 正式路由固定为 `/admin/users`
- 页面继续挂在当前 authenticated shell 内，不新增独立 admin layout
- 未登录访问时，跳转到 `/login?redirect=/admin/users`
- 非 admin 访问时，返回 `403`
- 该页面属于 admin 正式入口，不放入 `Labs`

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

## 查询规则

- 默认分页固定为：
  - `page = 1`
  - `limit = 10`
- 默认排序固定为：
  - `sortBy = id`
  - `sortOrder = DESC`
- 前端只允许以下排序字段：
  - `id`
  - `createdAt`
  - `loginName`
- `hasStaff` 采用三态语义：
  - 未设置
  - `true`
  - `false`
- 搜索、筛选变化时，列表重置到第一页

## 当前列表字段

当前列表固定按以下顺序展示：

1. 账户 ID
2. 工号
3. 姓名
4. 访问组
5. 账户状态
6. 创建时间

补充约定：

- `账户 ID` 支持排序，并作为当前默认排序列
- `工号` 对应 `staff.id`
- `姓名` 对应 `staff.name`
- `staff = null` 时，`工号` 与 `姓名` 显示为 `—`
- `访问组` 与状态类字段使用 `Tag`
- `创建时间` 不直接输出原始时间串，列表中按本地时间显示到“分”

以下字段当前不放在列表内，应留给后续详情页承接：

- 登录名
- 登录邮箱
- 昵称
- 手机号
- 职务
- staff 部门 ID
- user state
- staff 在职状态
- 其他补充字段

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

`/admin/users` 现在是正式 admin 业务页面；当前主线是先稳定列表页本身，再在后续阶段补 `/admin/users/:id` 详情页，而不是继续把细节型字段塞回列表。
