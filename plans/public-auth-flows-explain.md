# Public Auth Flows Explain

本主题当前拆成三份文档：

- [public-auth-flows-explain.md](./public-auth-flows-explain.md)：解释当前 public auth 主线的背景、分工和拆分原则
- [public-auth-flows-now.md](./public-auth-flows-now.md)：当前还可继续推进的公开认证入口主线
- [public-auth-flows-future.md](./public-auth-flows-future.md)：更受产品策略影响、暂不默认推进的后续项

拆分原则：

- 当前真实可用的 public-auth 主线只有“密码恢复闭环”，由 `/forgot-password -> /reset-password` 两段组成
- `now` 只保留剩余 verification intent 入口从壳页升级为真实流程的事项
- `future` 只保留公开注册、账户资料、仍缺契约的 magic-link 等后续项
- 稳定规则继续服从现有 `PublicEntryLayout + path-first + public-auth 不接管 session 主权` 的约束，不在本组文档重复改写

当前阶段的一句话结论：

- 密码恢复闭环已完成，当前基线由 `/forgot-password` 发起阶段与 `/reset-password` 完成阶段组成
- `/invite/staff/:verificationCode` 已升级为真实流程：先读 invite 信息，再做上游教职工身份核对，最后提交 `consumeVerificationFlowPublic`
- `/verify/email/:verificationCode` 与 `/magic-link/:verificationCode` 当前仍是 shell 页面
- 当前下一阶段不再重做 password recovery 或 staff invite，而是继续补 `verify-email` 契约、明确 `magic-link` go / no-go，并为后续联调继续复用 `/labs/invite-issuer` 生成邀请链接
