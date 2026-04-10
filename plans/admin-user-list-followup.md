# Admin User List Follow-up

`/admin/users` 的稳定规则已经移入 [../docs/project-convention/admin-user-list.md](../docs/project-convention/admin-user-list.md)。

本文件只保留当前列表页落地后的剩余事项，不再作为主规则来源。

## P1

- 新增 `/admin/users/:id` 详情页，承接当前未放入列表的账户与用户详情字段
- 明确列表到详情页的进入方式，避免继续堆叠列表列
- 为详情页补最小 E2E 主线

## P2

- 评估是否把筛选与分页状态同步到 URL search params
- 评估是否需要为 admin 用户列表补独立的空态文案或结果摘要文案细化
- 若后端后续补强聚合查询，再决定是否引入 staff 更多上下文而不回涨列表宽度

## 当前结论

admin 用户列表当前主线已经完成；后续应优先推进详情页，而不是把更多细节字段重新塞回列表。
