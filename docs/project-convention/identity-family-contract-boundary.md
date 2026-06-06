<!-- docs/project-convention/identity-family-contract-boundary.md -->

# Identity Family Contract Boundary

本文件记录当前教务产品中 `staff / student` 身份族的前端入口、页面语义与后端契约对齐约定。

它不是通用权限系统规则，也不要求所有 capability、slot 或非教务场景都按身份族拆分。

## 适用范围

本约定适用于：

- 一个功能区原先主要服务 `staff`，现在需要接入 `student`。
- 一个功能区原先主要服务 `student`，现在需要接入 `staff`。
- 页面、菜单、工作台、测试或后端契约需要表达 `staff / student` 不同用户心智。
- 同一底层数据在 `staff / student` 视角下可能有不同字段、默认过滤、错误文案或可见性。

本约定不适用于：

- 只有细碎权限点、没有明确 `staff / student` 产品语义的能力。
- 同一页面在 `staff / student` 下确实共享同一套业务视图、字段和交互。
- `ADMIN` 系统管理入口、`slotGroup` 增量职责、临时页面 action 或对象级权限判断。
- labs / sandbox 中尚未进入稳定语义收敛的实验代码。

## 核心判断

`staff / student` 在当前项目里不是普通字符串权限，而是清晰的教务身份族语义。

因此，新身份族接入已有功能区时，不应只理解为“给已完成接口补权限”。更准确的判断是：

- 既有入口当初承载的是哪个身份族的业务语义。
- 新身份族看到的是否仍然是同一份对外契约。
- 如果不是同一份契约，是否需要独立入口、独立页面语义或独立后端 adapter 契约。

需要重新确认：

- 权限边界是否只是放行，还是需要新的可见性约束。
- 默认过滤是否仍适合新身份族。
- 返回字段是否包含另一身份族的管理字段、内部状态或审计信息。
- 错误文案与 failure reason 是否会暴露不该暴露的信息。
- URL、菜单名称、页面标题、类型和 E2E 名称是否还能表达用户实际理解的业务动作。
- 测试 mock 是否把真实后端还不支持的身份族接口访问误当作已落地能力。

## 前端边界

当 `staff / student` 的产品语义不同，前端入口应优先保留身份族边界：

- 导航 provider 可以按身份族独立。
- 账户菜单可以按身份族独立。
- 默认工作台和首页内容可以按身份族独立演进。
- 页面路由和页面组件可以复用，但必须先确认页面语义、后端契约和可见性对两个身份族都成立。
- 若页面语义已经分化，应建立独立页面入口，而不是在一个页面里堆大量身份分支。

可以共享：

- 纯渲染器。
- 头像、主题、字号、布局容器等无业务语义的小组件。
- 标准化表单、URL normalize、GraphQL transport 等基础工具。
- 业务语义完全一致的 feature use case 或 infrastructure adapter。

需要谨慎共享：

- 已经隐含某一身份族业务文案、字段视图或默认查询条件的组件。
- 会让 `student` 误进入 `staff` 管理视角，或让 `staff` 误使用 `student` 自助视角的 API。
- 只靠 `allowedAccessGroups: ['STAFF', 'STUDENT']` 扩权就完成接入的页面。

## 后端契约对齐

前端不应要求后端把 `staff / student` 差异折叠进同一个接口，只为了减少接口数。

如果两个身份族的可见性、默认过滤、字段暴露、错误口径或业务动作语义不同，后端可以选择：

- adapter 对外契约独立表达身份族语义。
- DTO / Result 按身份族输出不同视图。
- usecase 在语义一致时复用。
- QueryService、纯 mapper、纯 access / visibility policy 作为更底层的共享能力。

如果两个身份族确实共享同一份业务语义，也可以共用同一后端入口。判断标准不是底层数据是否相同，
而是对外契约是否相同。

前端 E2E mock 应体现这个边界：

- 已确认 `student` 可用的接口可以 mock 成功。
- 尚未确认 `student` 可用的 `staff` 视角接口，不应在学生链路里默默 mock 成功。
- 如果某个学生页面不应调用 `staff` 视角接口，测试应让这类调用暴露出来。

## 与其他文档的关系

- [identity-access-session.md](./identity-access-session.md)：定义 session、`accessGroup`、`slotGroup`、`identity` 与登录态水合语义。
- [navigation.md](../navigation.md)：定义导航 capability、provider、manifest 和 route access check。
- [workbench-entry-rules.md](../workbench-entry-rules.md)：定义登录后工作台和首页模块边界。
- [public-auth-staff-invite.md](./public-auth-staff-invite.md)：定义 `staff` invite 公共认证流程。
- [public-auth-student-registration.md](./public-auth-student-registration.md)：定义 `student` 注册与初始登录邮箱验证流程。

## 简短结论

在当前教务语义下，`staff / student` 是代码需要保留的产品边界。

新增身份族接入已有功能时，先判断是否拥有独立对外契约语义；若有，前端入口和后端 adapter
契约独立更安全。复用应落在语义一致的 usecase、QueryService、纯 mapper 或 policy 上。
