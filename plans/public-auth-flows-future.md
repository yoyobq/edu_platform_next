# Public Auth Flows Future

本计划现在只保留当前不默认推进、且更受产品策略影响的部分。

这些内容不应继续混入 `public-auth-flows-now.md`。

## 后续范围

- 是否需要开放 `/register`
- 公开注册成功后的邮箱验证续接
- invite-first 与 self-signup 的正式边界
- 账户中心与资料编辑
- 若当前阶段拿不到 session 契约，magic-link 可回落到这里继续等待

## 为什么继续延后

- 开放注册是否存在，取决于产品到底是 `invite-first` 还是 `self-signup`
- 公开注册一旦放开，就会连带影响邮箱验证续接、默认落点与权限边界
- 账户资料与账户中心不属于当前 public entry 验证入口主线
- magic-link 若无法直接建立 session，继续强推实现只会制造伪闭环

## 后续建议顺序

### 1. 是否需要开放注册

只有在明确出现公开自注册场景时，才单独补：

- `/register`
- 注册成功后的邮箱验证续接
- 公开注册与 invite-first 的边界

### 2. 账户中心与资料编辑

这不是 public entry 当前阶段的默认目标。

只有在登录后账户域边界稳定后，再单独补：

- 账户基本资料编辑
- 安全设置与密码管理的登录后入口
- 账户中心与公开认证入口之间的职责边界

### 3. Magic Link 回落场景

若当前阶段仍拿不到“验证成功后直接建立 session”的后端契约，则：

- 不伪造 magic-link 成功登录
- 不把临时回跳方案写成正式规则
- 继续把 magic-link 视为等待契约的延后项

## 后续开发前再确认的事项

- 产品最终是 `invite-first` 还是允许 `self-signup`
- 开放注册后是否需要额外的组织、角色或 workspace 选择
- 注册成功后的邮箱验证是否必须强制完成
- 账户中心未来是否由独立 feature 承接
- magic-link 是否拿到了可直接建立 session 的稳定接口

## 一句话结论

下一阶段先把 verification intent 主线推进完；更靠后的开放注册、账户中心与仍缺契约的 magic-link 继续留在 future。
