# Identity Access Model Explainer

本文件只负责解释“为什么当前模型这样收束”，不承载第一优先级的实现基线。

当前基线见 [identity-access-model-now.md](/var/www/platform_next/plans/identity-access-model-now.md)。  
后续演进项见 [identity-access-model-future.md](/var/www/platform_next/plans/identity-access-model-future.md)。

## 为什么不用扁平 role 列表

当前项目已经明确：

- `STAFF` / `STUDENT` 是基础业务身份
- `GUEST` 是退避身份
- `ADMIN` 是额外全局身份面
- 许多岗位语义只是在基础身份上增加能力，而不是新的顶层主身份

因此，如果继续把所有概念压成一个扁平 `role enum`，会很快混淆：

- 主身份
- 增量能力
- 业务称谓
- 资源关系
- 前端展示偏好

当前模型就是为了解开这几层。

## 为什么拆成 identityHint、accessGroup、slotGroup、activeRole

### identityHint

`identityHint` 用来表达：

- 默认从哪个身份分支理解当前账户
- 默认沿哪条身份链路落点

它不是权限集合。

### accessGroup

`accessGroup` 用来表达：

- 当前有效的全局身份集合
- 粗粒度入口授权

它回答的是“能进哪里”，而不是“所有细节上还能多做什么”。

### slotGroup

`slotGroup` 用来表达：

- 在基础身份之外追加的全局增量授权摘要

它回答的是“在这个大区里还能多做什么”。

### activeRole

`activeRole` 只保留为前端本地展示偏好。

它回答的是：

- 当前工作台按哪种方式组织

它不改变后端身份事实，也不参与授权。

## 为什么 teacher 不进入 accessGroup 或 slotGroup

当前模型下：

- `teacher` 不增加独立的全局授权面
- 它更像业务称谓或关系语义
- 课程、班级访问更适合按真实业务关系判断

所以：

- 不把 `teacher` 提升成主身份
- 不把 `teacher` 强行塞进 `slotGroup`

这能避免“只要是 teacher 就能看所有课程或所有班级”这种错误推导。

## 为什么 GUEST 要有硬退避

`GUEST` 不是未登录，也不是普通附加身份，而是：

- 已登录
- 但当前必须退避到最小正式身份

因此当前规则要求：

- 若 `identityHint === 'GUEST'`，前端直接按 `GUEST` 处理
- 路由与页面判断消费的是归一化后的身份快照

这里的核心不是“前端更强”，而是“后端事实优先于前端摘要”。

## 为什么 slot 只能增权

当前 slot 的目标是：

- 在基础身份上叠加能力
- 不改变主身份归属
- 不引入反向减权

所以文档里把这条定成了红线：

- 后端新增任何 slot 时，授权逻辑必须是纯增量
- 如果需要屏蔽、降级或反向剔除，必须由后端接口层直接处理
- 前端拒绝基于 slot 做反向剔除逻辑

这条边界可以避免 `slotGroup` 从“增量能力摘要”退化成“复杂负权限系统”。

## 理论映射

当前这套模型更接近几种成熟方法的组合。

### 1. 粗粒度入口授权仍可归到 RBAC

当 `accessGroup` 用于决定：

- 能否进入 staff 侧页面
- 能否进入 student 侧页面
- 能否进入 sys-admin 侧页面

这部分仍可理解为粗粒度 RBAC。

### 2. slot / slotGroup 更接近 capability / permission 增量

当 slot 的意义是：

- 在基础主身份上继续增加能力
- 不改变主身份归属
- 默认只增权、不减权

它更接近 capability-based 或 permission-based 思路。

### 3. 课程与班级访问更接近 relationship-based authorization

当前更准确的理解不是“`teacher` 自身就是一个上下文授权身份”，而是：

- `STAFF` 提供全局基础访问面
- 某门课能不能看，取决于是否负责该课程
- 某个班能不能看，取决于是否在该班任课

这类判断更接近 relationship-based 或 resource-level authorization。

### 4. activeRole 属于前端本地展示偏好

当前基线下，`activeRole` 只属于前端本地展示偏好。

它更适合服务于：

- `ADMIN` 与业务身份并存时的首页切换
- `ADMIN` 与业务身份并存时的工作台组织切换

## 一句话简化表述

为了方便后续前后端讨论，可以把当前体系简化表述为：

- 全局入口授权使用粗粒度 RBAC
- 细粒度功能增量使用 capability / permission 思路
- 课程、班级等资源访问使用 relationship-based authorization
- 默认身份提示由 `identityHint` 提供，且其来源与更新由后端负责

同时：

- `STAFF/STUDENT` 的业务主视角由 `accessGroup` 直接决定
- 纯 `ADMIN` 用户的默认工作台在前端布局与模块组织上复用 `STAFF` 视角，但不表示身份等同于 `STAFF`
- 若仍保留额外前端展示偏好，则由本地 `activeRole` 负责 `ADMIN` 与业务身份之间的首页或工作台组织切换

一句话总结：

- `accessGroup` 管“能进哪里”
- `slotGroup` 管“还能多做什么”
- 业务关系管“对哪门课、哪个班、哪类资源能做什么”
- `identityHint` 管“当前默认按哪条身份链路理解用户”
- `activeRole` 管“当前工作台按哪种方式组织”
