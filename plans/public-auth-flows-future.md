# Public Auth Flows Future

本计划保留当前不急着做、且仍受后端契约或产品策略影响较大的部分。

这些内容不阻塞当前编码，不应混入 `public-auth-flows-now.md`。

## 后续范围

- 邀请式注册 / 激活
- 邮箱验证真实化
- magic-link 真实化
- 是否需要开放 `/register`

## 为什么延后

- invite 的真实返回字段仍可能受组织、角色、workspace 语义影响
- verify-email 的接口语义可能是“只校验”或“调用即消费”
- magic-link 是否能成立，强依赖后端是否能直接返回 session
- 开放注册是否存在，取决于产品到底是 `invite-first` 还是 `self-signup`

## 后续建议顺序

### 1. 邀请式注册 / 激活

目标：

- `/invite/:inviteType/:verificationCode` 不再只是展示参数
- 有效时展示最小激活 / 注册表单
- 失败时区分 `invalid / expired / used`

当前默认判断：

- 继续优先 `invite-first`
- 不先做开放 `/register`
- 若后端不直接返回 session，则成功后回 `/login`

### 2. 邮箱验证真实化

目标：

- `/verify/email/:verificationCode` 能给出明确成功 / 失败闭环

当前需要保持：

- 路径仍是 `/verify/email/:verificationCode`
- 不改成 `/verify-email/:verificationCode`
- 不与普通 `redirect` 语义混写

### 3. Magic Link 真实化

目标：

- `/magic-link/:verificationCode` 能决定“直接建 session”还是“回登录继续”

当前默认判断：

- 只有在后端明确支持直接建立 session 时才推进
- 若后端不支持，继续保留壳页即可

### 4. 是否需要开放注册

这不是当前阶段默认要做的事情。

只有在明确出现公开自注册场景时，才单独补：

- `/register`
- 注册成功后的邮箱验证续接
- 公开注册与 invite-first 的边界

## 后续开发前再确认的事项

- 后端是否已有 invite / verify-email / magic-link 对应接口
- 这些接口是 GraphQL 还是 REST
- invite 成功后是否会直接返回 session 信息
- verify-email 的 code 校验是“只校验”还是“调用即消费”
- magic-link 成功后是否会直接返回 session 信息

## 一句话结论

后续优先顺序继续按：

1. invite 激活
2. verify-email
3. magic-link
4. 视业务再决定是否开放注册
