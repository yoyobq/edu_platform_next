# Identity Access Model Future

本文件只记录当前模型的后续演进方向、待后续细化的实现项，以及暂不进入基线的内容。

当前已收束的基线见 [identity-access-model-now.md](/var/www/platform_next/plans/identity-access-model-now.md)。  
解释性背景见 [identity-access-model-explainer.md](/var/www/platform_next/plans/identity-access-model-explainer.md)。

## 后续演进方向

### 1. 登录后身份补齐交互

当前已确定：

- 若 `staff/student` 链路暂未补齐，仍允许登录
- 这类用户不能按普通完整身份继续放行

但具体交互仍待后续细化，例如：

- 继续注册
- 补充信息
- 进入受控兜底流程

这里的重点不是再改身份模型，而是补一条清晰的产品流转。

### 2. 页面访问配置何时考虑 DB 化

当前页面映射表更适合作为：

- 文档中的访问策略草案
- 前端代码中的静态配置

只有在明确出现下面需求时，才值得进一步 DB 化：

- 多租户差异化映射
- 后台动态配置
- 不发版调整页面权限映射
- 映射审计

在这些条件未出现前，不建议优先 DB 化。

### 3. slot 摘要层方向

当前后续演进方向可先理解为：

- `post_*` 表继续承载任职或关系事实
- `base_identity_slot` 继续承载统一职责目录
- `base_identity_binding` 可作为账号职责摘要表

在这层结构下：

- `base_identity_binding` 不替代 `post_*` 事实表
- 它用于汇总“某账号当前或历史上拥有哪些职责槽位”
- `slotGroup` 可以由该摘要层进一步产出

### 4. binding_status 与 slotGroup 的关系

- `ACTIVE`：参与当前 `slotGroup`
- `INACTIVE`：允许展示给用户自己或内部查看，但默认不参与当前授权与 `slotGroup`
- `ENDED`：历史结束记录，默认不参与当前 `slotGroup`

这意味着：

- 展示层可以比授权层更宽
- `INACTIVE` 可以看见，不代表当前可用
- `slotGroup` 只汇总当前有效 slot

## 当前仍待后续明确的项

当前仍未完全定稿的只剩：

- schema 中最终采用哪些命名
- 已注册与未注册在后端返回语义中如何明确区分

## 当前建议顺序

在当前基线基础上，建议后续按以下顺序继续推进：

1. 先收束前端对 `identity / identityHint / accessGroup / staff/student` 的最小理解
2. 再讨论前端最小路由权限模型
3. 最后才进入更细的页面级、动作级权限体系

## 迁移建议

后续若出现下列情况，应把内容从 `plans/` 迁入 `docs/`：

- `identity`、`accessGroup`、`slotGroup`、`identityHint` 命名与语义稳定
- Token 错误码与会话异常处理稳定
- 路由静态配置字段稳定
- `base_identity_binding` 与 `slotGroup` 产出链路稳定
