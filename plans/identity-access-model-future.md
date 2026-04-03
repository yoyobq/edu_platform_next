# Identity Access Model Future

本文件只记录 `identity-access` 当前未完成、明确留到后续推进的事项。

当前已稳定口径见：

- [docs/project-convention/identity-access-session.md](/var/www/platform_next/docs/project-convention/identity-access-session.md)

当前轮计划入口见：

- [identity-access-model-now.md](/var/www/platform_next/plans/identity-access-model-now.md)

## Future

### 1. 登录后身份补齐交互

当前已确定：

- 若 `staff / student` 链路暂未补齐，仍允许登录
- 这类用户不能按普通完整身份继续放行
- 退避身份必须由后端显式给出

后续仍需明确：

- 继续注册
- 补充信息
- 进入受控兜底流程

### 2. slot 摘要层与产出链路

后续继续明确：

- `post_*` 事实表与 slot 摘要层的职责边界
- `base_identity_binding` 如何产出 `slotGroup`
- `binding_status` 与当前授权输入的关系

### 3. 页面访问配置何时考虑 DB 化

当前页面访问映射仍以静态配置为主。

只有在明确出现下面需求时，才继续讨论 DB 化：

- 多租户差异化映射
- 后台动态配置
- 不发版调整页面权限映射
- 映射审计

### 4. slotGroup 正式进入页面消费后的补测

当前前端已能承接 `slotGroup`，但页面与模块还没有正式基于 `slotGroup` 暴露行为。

等页面开始真正消费 `slotGroup` 后，再补：

- 有 `slotGroup` 的页面或模块曝光 E2E
- 无 `slotGroup` 的页面或模块曝光 E2E
- 页面级与内容级的正反路径

### 5. token 存储介质与会话安全收敛

当前前端仍使用本地存储承接会话快照与 token。

这条链路当前能满足：

- 前端直接恢复会话
- 前端直接解析 access token 中的 `accessGroup / slotGroup`
- 前端独立完成 `me / refresh` 链路

但仍有明确隐患：

- `localStorage` 对 XSS 更敏感
- `refreshToken` 不适合长期继续由前端明文持有
- 纯本地退出不等于服务端全局失效

后续需要单独评估并收敛：

- `refreshToken` 迁移到 `HttpOnly cookie`
- access token 与 refresh token 的分层存储策略
- cookie 模式下的 `refresh / me` 调用口径
- CSRF、跨域与服务端会话吊销语义
