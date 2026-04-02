# Public Auth Flows Plan

本主题仍拆成两份计划：

- [public-auth-flows-now.md](./public-auth-flows-now.md)：当前阶段继续推进，拿着步骤即可开始收敛实现
- [public-auth-flows-future.md](./public-auth-flows-future.md)：暂不默认推进，保留更靠后的产品策略项

拆分原则：

- 旧的“用户自助恢复”阶段已经完成，不再继续占用 `now`
- 新的 `now` 聚焦剩余公开认证入口里最接近落地的 verification intent 流程
- `future` 只保留公开注册、账户资料等仍明显受产品策略影响的部分
- 稳定规则仍继续服从 `public entry shell + path-first` 的现有约束，不在本计划重复展开

当前阶段的一句话结论：

- `/forgot-password` + `/reset-password/:verificationCode` 已完成，可视为当前基线
- 下一阶段优先推进 `/invite/:inviteType/:verificationCode` 与 `/verify/email/:verificationCode`
- `/magic-link/:verificationCode` 已提升到当前规划，但是否真实化仍取决于后端能否直接建立 session
