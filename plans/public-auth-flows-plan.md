# Public Auth Flows Plan

本主题拆成两份计划：

- [public-auth-flows-now.md](./public-auth-flows-now.md)：当前就做，拿着步骤即可直接开始编码
- [public-auth-flows-future.md](./public-auth-flows-future.md)：后续再做，保留方向与前置条件

拆分原则：

- 当前计划只保留不会阻塞实现、且已足够明确的部分
- 未来计划保留 invite、verify-email、magic-link 等仍受后端契约影响较大的部分
- 稳定规则仍继续服从 `public entry shell + path-first` 的现有约束，不在本计划重复展开

当前阶段的一句话结论：

- 先补用户自助恢复闭环：`/forgot-password` + `/reset-password/:verificationCode`
- 邀请激活、邮箱验证、magic-link 延后到下一阶段
