<!-- docs/project-convention/my-profile.md -->

# My Profile

本文件定义当前个人资料页的稳定前端约定。

## 适用范围

- 路由：`/profile`
- page owner：`src/pages/profile`
- feature owner：`src/features/my-profile`
- layout：`AppLayout`

## 数据来源

- 基础资料读取：`myProfileBasic`
- 身份信息读取：`myProfileIdentity`
- 系部名称映射：`departments`
- 壳层、首页和账号菜单里的当前登录人姓名不从 `myProfileIdentity` 反查，统一来自 `me.identity.name`
- `me.userInfo.nickname` 只作为展示退避源，不作为 staff / student 真实姓名来源

`myProfileIdentity` 当前可返回：

- `MyProfileStaffIdentityDTO`
- `MyProfileStudentIdentityDTO`

两类身份 DTO 当前都包含 `slotGroup`，可作为个人资料页里的只读职责槽位摘要；授权、菜单和页面分流仍以 `me` 水合后的当前会话快照为准。

## 身份信息展示

身份信息页签应展示：

- 主身份基本字段
  - staff：工号、姓名、在职状态、职务、主归属系
  - student：学号、姓名、学籍状态、当前班级 ID、当前班级编码、上游学生 ID
- `slotGroup` 摘要若展示，只能作为只读职责信息

`slotGroup` 展示规则：

- 作为只读职责摘要展示，推荐使用 `Tag`
- 空数组时显示“暂无职责槽位”
- 不把 `slotGroup` 当成完整任职事实
- 不在个人资料页里根据 `slotGroup` 自行推断资源权限

学生身份字段口径：

- `currentClassId`、`currentClassCode` 都可能为 `null`
- 两者只作为当前读侧投影展示，不代表班级归属真相
- 不再使用旧 `classId`

## 任职事实明细

若后续需要在个人资料页展示更完整的 staff 任职事实，可读取：

- `staffCurrentSlotPosts(accountId)`

展示边界：

- 只读展示当前任职事实、scope、时间和状态
- 不在个人资料页提供插入、结束、reconcile 或批量治理
- 插拔与治理继续归 admin 用户详情页或未来 Staff Slot 工作台

## 边界

- 个人资料页不承担授权判定
- `accessGroup / slotGroup` 的会话语义以 [identity-access-session.md](./identity-access-session.md) 为准
- Staff Slot 管理规则以 [admin-user-list.md](./admin-user-list.md) 的 `Staff Slot` 小节为准
