<!-- docs/project-convention/route-url-semantics.md -->

# Route URL Semantics

本文件是当前路由 URL 语义主题的直接约定文档。

## 一句话原则

- 业务入口、动作类型、资源标识优先使用 path
- 附加导航状态优先使用 query

## Path 优先承接的语义

以下语义默认优先进入 path：

- 入口类型
- 动作类型
- 资源标识
- 一次性业务入口 token / verification code

示例：

- `/login`
- `/welcome`
- `/invite/teacher/:verificationCode`
- `/invite/student/:verificationCode`
- `/invite/leader/:verificationCode`
- `/verify/email/:verificationCode`
- `/reset-password/:verificationCode`
- `/magic-link/:verificationCode`

原因：

- 入口意图更显式
- 页面拥有者更清楚
- 更适合与路由职责、guard 和壳层分流对齐

## Query 优先承接的语义

以下语义默认继续使用 query：

- `redirect`
- 搜索条件
- 排序
- 分页
- 过滤条件
- 临时调试开关
- 不改变页面主入口语义的附加导航状态

示例：

- `/login?redirect=/projects/123`
- `/projects?page=2&sort=createdAt`

## 当前约束

- 不把主要业务入口语义塞进一组隐式 query 组合
- 不要求把所有状态都硬塞进 path
- 同一类语义不要今天放 path、明天放 query
- 若某类入口已经被定义为 path-first，后续实现默认沿同一模式继续扩展

## 对 verification / invitation 场景的直接约束

- verification code、邀请链接、密码重置、magic link 这类入口，默认使用 path-first
- 不把它们伪装成普通 `redirect` 参数
- 若它们需要登录后继续流程，应由登录前后分流逻辑保留该业务 intent，而不是把业务语义折叠进普通回跳机制
