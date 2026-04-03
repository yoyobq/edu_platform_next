# Identity Access Model Now

本文件只保留当前仍在推进、但尚未完全转入正式文档的事项。

已稳定的当前口径见：

- [docs/project-convention/identity-access-session.md](/var/www/platform_next/docs/project-convention/identity-access-session.md)

后续待推进事项见：

- [identity-access-model-future.md](/var/www/platform_next/plans/identity-access-model-future.md)

## 当前范围

本轮 `identity-access` 主线已经收敛到：

- 前端会话按 `login / refresh / me / logout` 运行
- 前端只消费 `ADMIN / GUEST / STAFF / STUDENT`
- 登录恢复失败统一走强制登出

## 当前仍在计划内但未转入正式文档的项

当前无额外 `P0` 待办。

若后续出现新的当前轮事项，再补回本文件；稳定后继续迁入 `docs/`。
