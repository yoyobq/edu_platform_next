# Identity Access Model Now

本文件只记录当前已收束、可直接用于前端实现准备的身份与权限基线。

若某条边界未来已稳定，应移入 `docs/`；若属于后续演进或解释性背景，分别见：

- [identity-access-model-future.md](/var/www/platform_next/plans/identity-access-model-future.md)
- [identity-access-model-explainer.md](/var/www/platform_next/plans/identity-access-model-explainer.md)

## 当前结论速记

- `account` 是认证主体
- `userInfo` 是账户下的公共资料层
- `identityHint` 负责默认身份提示
- `staff` / `student` 是 `userInfo` 之下的业务实体分支
- `accessGroup` 表达当前有效的全局身份集合
- `slotGroup` 表达当前有效的全局增量授权摘要
- `teacher` 不作为独立授权身份
- 课程、班级等资源访问由业务关系判断
- `activeRole` 只作为前端本地展示偏好

## 主链路

当前理解的主链路为：

```text
account
  -> userInfo
    -> staff | student
```

更具体地说：

- `account` 负责登录、凭证、账户状态等认证层语义
- `userInfo` 负责昵称、头像、邮箱等公共资料
- `identityHint` 指示当前账户默认沿哪条身份链路理解
- 具体业务实体落到 `staff` 或 `student`

前端当前应坚持两条原则：

- 不能把“是否有 `staff` / `student` 实体”与“能否登录”混为一谈
- 登录与身份补齐流程，本质上是在帮助账户补齐或挂接到正确身份链路

## 登录态处理原则

正常情况下，登录后后端应尽量返回：

- `account`
- `userInfo`
- `staff` 或 `student` 相关数据

若 `staff/student` 链路暂未补齐，仍允许登录，但前端不能把这类用户当成普通完整身份用户继续放行，而应进入特殊处理分支。当前可接受的特殊处理包括：

- 继续注册
- 补充信息
- 受控兜底流程

具体交互仍待后续再定。

## Schema 与 Token 基线

### Schema 侧已看到的锚点

当前本地 `schema.graphql` 里可见：

- `LoginResult` 含 `identity`、`userInfo`
- `UserAccountDTO` 含 `identityHint`
- `UserInfoDTO` 含 `accessGroup`

这说明后端已经在区分：

- 默认身份提示
- 全局身份集合
- 具体身份实体

### JWT 基线

当前 access token 包含：

- `sub`
- `username`
- `email`
- `accessGroup`
- `slotGroup`
- `type: 'access'`
- 标准声明：`iat`、`exp`、`iss`、`aud`

当前 refresh token 包含：

- `sub`
- `type: 'refresh'`
- `tokenVersion`，默认 `1`
- 标准声明：`iat`、`exp`、`iss`、`aud`

前端当前应按下面方式理解：

- `accessGroup` 是前端权限判断最直接的来源
- `slotGroup` 是前端增量授权判断的直接来源
- `sub / username / email` 用于基础会话与展示
- refresh token 不参与前端权限建模
- `identityHint` 的来源与更新由后端负责
- 前端可在本地维护 `activeRole`，但它只用于工作台组织方式
- `activeRole` 不参与授权判断，也不回写后端身份事实
- `accessGroup` 属于当前会话必需字段；若缺失，应按认证有效性异常处理
- `slotGroup` 字段为非必填；若 JWT 中未出现 `slotGroup`，或其值为空数组，前端只按基础身份能力理解，不做额外 slot 增权

## Token 异常处理基线

当前前端还应补充一组生产可用的 token 异常处理兜底规则：

- Token 过期：清除会话并跳转登录
- 认证有效性异常：强制登出
- 仅当后端明确给出 `GUEST` 身份时，前端才进入 `GUEST` 流程

这组规则的目标是：

- 避免前端继续使用失效会话
- 避免把异常 token 误降级成仍可继续使用的会话
- 避免异常 token 状态在前端停留成不确定中间态

### 1. 认证有效性异常

- 签名校验失败
- token 结构不合法
- 关键 claim 缺失，包括 `accessGroup`
- 无法通过后端校验

以上情况统一强制登出，不进入 `GUEST` 流程。

这类异常应尽量由后端统一返回稳定错误码，避免前端自行推断原因。当前至少应保证：

- token 过期可被统一识别
- token 无效可被统一识别
- 关键 claim 缺失优先并入 token 无效，或由后端单独提供稳定错误码

前端的职责是根据后端错误码执行固定动作，例如清除会话、跳转登录或强制登出，而不是自行判断某个 token 是否只是“兼容问题”。

### 2. 已认证但退避为 `GUEST`

- 仅当后端明确返回已认证且身份为 `GUEST`
- 例如 `identityHint === 'GUEST'`

只有这类情况，前端才进入 `GUEST` 兜底流程。

## 身份模型

### 基础主身份

当前前端讨论里，基础主身份可先理解为：

- `ADMIN`
- `GUEST`
- `STAFF`
- `STUDENT`

### accessGroup 当前目标枚举

`accessGroup` 当前目标枚举为：

- `ADMIN`
- `GUEST`
- `STAFF`
- `STUDENT`

这四项表达的是会影响全局入口授权面的正式身份。

`accessGroup` 在数据结构上是一个数组。

当前不建议进入 `accessGroup` 的，包括：

- `ACADEMIC_OFFICER`
- `TEACHING_GROUP_LEADER`
- `COUNSELOR`
- `CLASS_ADVISER`
- `CLASS_CADRE`
- `teacher`

这些更适合作为：

- slot
- `slotGroup`
- 资料语义
- 业务关系语义

### slotGroup 的定位

在 `accessGroup` 继续保持简化的前提下，可以引入一层更细的全局增量授权摘要：

- `slotGroup`

它的职责是：

- 承接账号当前可用的 slot 摘要
- 为模块内 `slotGroup` 判断提供统一输入
- 避免前端在第一阶段逐页现查 slot

当前实现还应明确：

- `slotGroup` 将作为 JWT 字段出现
- 若 JWT 中未出现 `slotGroup`，或其值为空数组，则视为当前没有额外 slot 增权

它的边界是：

- 比 `accessGroup` 更细
- 比具体资源关系更粗
- 不替代课程、班级等资源级关系判断

一句话说：

- `accessGroup` 决定能进哪些大区
- `slotGroup` 决定这些大区里还能多做什么

当前 `slotGroup` 更适合承载：

- `ACADEMIC_OFFICER`
- `TEACHING_GROUP_LEADER`
- `COUNSELOR`
- `CLASS_ADVISER`
- `CLASS_CADRE`

### GUEST 的定位

当前讨论已明确：

- `GUEST` 是正式账号身份
- `GUEST` 需要登录
- 未登录用户不允许访问系统

因此需要明确区分：

- `unauthenticated`：未登录，不能进入系统
- `GUEST`：已登录，但当前退避到最小正式身份

`GUEST` 的典型用途包括：

- 用户自称是 `staff`，但后端暂未找到对应资料链路
- 注册或绑定流程中断，尚未形成稳定 `staff/student` 身份
- 系统需要给用户一个安全、最小、可登录的兜底身份

并且：

- `GUEST` 与 `STAFF/STUDENT` 互斥
- `GUEST` 是退避身份，不是与正常业务身份并存的附加身份
- `GUEST` 当前只允许访问两个页面：首页引导页、信息完善页

### GUEST 的认定来源

当前 `GUEST` 的认定按下面优先级处理：

1. 若 `identityHint === 'GUEST'`，直接按 `GUEST` 处理
2. 即使 `accessGroup` 内容更丰富，只要 `identityHint === 'GUEST'`，前端仍优先把该用户视为 `GUEST`
3. 若 `staff` 与 `student` 实体都缺失，也自动推断为 `GUEST`

由此还应直接补一条前端归一化规则：

- 当 `identityHint === 'GUEST'` 时，`accessGroup` 直接退避为 `['GUEST']`
- 路由守卫与页面判断消费的是归一化后的身份快照，而不是未经收束的原始 token claim

### STAFF 与 STUDENT 的关系

当前讨论已明确：

- `STAFF` 与 `STUDENT` 互斥
- 用户一旦进入正式业务身份面，必然落在二者之一

因此：

- 不存在在 `STAFF` 与 `STUDENT` 之间自由切换默认主身份的问题
- 用户当前业务主视角可直接由 `accessGroup` 中存在的那一项推出
- 若 `accessGroup` 含 `STAFF`，业务主视角默认按 `STAFF` 理解
- 若 `accessGroup` 含 `STUDENT`，业务主视角默认按 `STUDENT` 理解

## slot、teacher 与 activeRole

### Staff 侧 slot

`staff` 不是单一岗位，而是一条基础身份链路。当前 `staff` 侧 slot 包括：

- `ACADEMIC_OFFICER`
- `TEACHING_GROUP_LEADER`
- `COUNSELOR`
- `CLASS_ADVISER`

这些 slot 的授权语义是：

- `STAFF` 提供 staff 侧基础权限
- 各类 slot 默认是在基础身份上继续增加权限
- slot 默认只增权，不承担减权语义

因此：

- `staff` 与其下挂 slot 不宜按互斥角色建模
- 若某个 slot 不增加权限，就不必强行当成独立授权身份

**契约红线：后端在新增任何 slot 时，必须确保其授权逻辑是纯增量的。若出现针对特定 slot 的屏蔽、降级或反向剔除需求，必须由后端在接口层面直接过滤数据，前端拒绝基于 slot 做反向剔除逻辑。**

### Student 侧 slot

`student` 是另一条基础身份链路。当前理解里：

- 用户首先是 `student`
- `CLASS_CADRE` 是 `student` 侧 slot

### teacher 的定位

当前可先记录为：

- `teacher` 在当前体系里基本可认为与 `staff` 基础权限一致
- `teacher` 更像业务语义、资料侧称谓或业务关系语义
- `teacher` 不进入当前 slot 体系
- `teacher` 不进入当前 `accessGroup` 或 `slotGroup`

而当页面需要判断：

- 能否查看某门课程
- 能否查看某个班级

应优先去对应业务体系判断真实关系，例如：

- 是否负责该课程
- 是否在该班任课

### activeRole 的定位

当前应明确：

- `accessGroup` 才是权限判断主依据
- `identityHint` 负责默认身份提示
- `activeRole` 只负责前端工作台组织方式
- `activeRole` 只保留为前端本地展示偏好
- 当前前端基线不依赖 `activeRole` 做授权判断
- 当前前端基线也不依赖 `activeRole` 组织身份事实

## 前端权限分层

当前第一阶段的权限分层建议为：

- 路由守卫主要消费 `accessGroup`
- 模块、页面入口、菜单曝光与页面内部判断都可消费 `slotGroup`
- 课程、班级、作业等资源级权限继续消费业务关系

一句话说：

- `accessGroup` 管授权入口
- `identityHint` 管默认身份提示
- `activeRole` 管工作台组织方式
- `slotGroup` 管全局增量授权
- 业务关系管资源级访问

## 前端会话最小集合

登录后前端持久化的 session snapshot，当前更适合只保留最小必要信息，例如：

- `accountId`
- `identityHint`
- `accessGroup`
- 基础展示信息，例如昵称、头像
- 必要的 token

而不应无差别把完整业务实体大对象长期塞进本地状态。

## 页面访问静态配置草案

页面映射表当前更适合作为：

- 文档中的访问策略草案
- 前端代码中的静态配置

### 配置目标

这份静态配置的职责是：

- 描述某个路由或页面的最小访问要求
- 描述页面是否需要 `slotGroup`
- 描述页面在布局中的可见性策略
- 描述不满足条件时的回退行为

它不负责：

- 取代后端真实授权
- 取代课程、班级、作业等资源级关系判断
- 表达所有按钮级细粒度授权

### 最小配置结构

第一版可先收束为：

- `routeKey`
- `authRequirement`
- `requiredAccessGroups`
- `slotGroups`
- `slotGroupMatch`
- `slotGroupScope`
- `slotGroupFailureBehavior`
- `layoutVisibility`
- `fallbackBehavior`

### 字段语义

`routeKey`

- 唯一标识一个路由、页面或页面入口
- 建议使用稳定业务键，而不是展示文案

示例：

- `home.admin`
- `home.staff`
- `home.student`
- `staff.course.list`
- `student.assignment.list`

`authRequirement`

- 表示该路由是否要求当前用户已认证
- 它负责表达“认证门槛”，与 `requiredAccessGroups` 的“身份门槛”分离

第一阶段可先收敛为：

- `required`
- `optional`
- `forbidden`

当前项目基线是未登录用户不能进入业务系统，因此大多数系统内页面都应为 `required`。

`requiredAccessGroups`

- 表示进入该路由或页面所需的最小 `accessGroup` 条件
- 它只在 `authRequirement` 允许当前用户进入认证态页面后继续生效
- 按“满足其一即可”解释
- 当 `requiredAccessGroups` 为空时，表示该页面不要求额外的身份门槛；是否要求登录仍由 `authRequirement` 决定

`slotGroups`

- 表示该页面在基础 `accessGroup` 之外，还可能依赖的 `slotGroup` 条件
- 没有则表示只靠 `accessGroup`
- 有则表示页面入口、菜单曝光、首页模块或页面内部内容都可能继续受 `slotGroup` 影响
- 这里使用的值，直接对应 JWT 中的 `slotGroup` 枚举值

`slotGroupMatch`

- 表示 `slotGroups` 的匹配语义
- `any`：命中任一项即满足
- `all`：命中全部项才满足
- 若未显式声明，第一阶段默认按 `any` 理解

`slotGroupScope`

- 表示 `slotGroup` 约束作用在什么层级
- `page`：不满足时，页面入口本身不应开放
- `content`：允许进入页面，但页面中的入口、菜单、首页模块或内容区域继续受 `slotGroup` 影响
- 第一阶段默认优先使用 `content`

`slotGroupFailureBehavior`

- 表示用户不满足 `slotGroup` 条件时，前端应如何处理
- `hide-entry`：不展示入口
- `show-disabled`：入口展示但不可用
- `show-forbidden`：允许进入后显示无权限状态
- `degrade-content`：允许进入，但只展示基础内容

`layoutVisibility`

- 表示该入口在布局层如何参与导航、菜单、首页模块或工作台曝光

第一阶段可先收敛为：

- `hidden`
- `menu`
- `home-module`
- `menu-and-home`

`fallbackBehavior`

- 表示当用户不满足页面访问条件时，前端应如何处理

第一阶段可先收敛为：

- `redirect-home`
- `redirect-login`
- `show-forbidden`
- `show-not-found`
- `degrade-to-guest-flow`

### 示意结构

```ts
type RouteAccessConfig = {
  routeKey: string;
  authRequirement: 'required' | 'optional' | 'forbidden';
  requiredAccessGroups: readonly ('ADMIN' | 'GUEST' | 'STAFF' | 'STUDENT')[];
  slotGroups?: readonly string[];
  slotGroupMatch?: 'any' | 'all';
  slotGroupScope?: 'page' | 'content';
  slotGroupFailureBehavior?: 'hide-entry' | 'show-disabled' | 'show-forbidden' | 'degrade-content';
  layoutVisibility: 'hidden' | 'menu' | 'home-module' | 'menu-and-home';
  fallbackBehavior:
    | 'redirect-home'
    | 'redirect-login'
    | 'show-forbidden'
    | 'show-not-found'
    | 'degrade-to-guest-flow';
};
```

### 统一判定算法

为避免前后端或不同前端模块在实现顺序上产生漂移，当前应明确一套统一判定顺序。

判定顺序固定为：

1. 校验会话有效性
2. 归一化身份快照
3. 先过认证门槛，再过 `accessGroup` 门槛
4. 再做 `slotGroup` 判定
5. 最后做资源关系判定
6. 根据回退策略执行回退

可用下面的伪代码理解：

```ts
function resolvePageAccess(session, routeConfig, resourceContext) {
  if (!isSessionValid(session)) {
    return { allowed: false, action: 'redirect-login' };
  }

  const snapshot = normalizeIdentitySnapshot({
    identityHint: session.identityHint,
    accessGroup: session.accessGroup,
    slotGroup: session.slotGroup ?? [],
    staff: session.staff,
    student: session.student,
  });

  if (!matchAuthRequirement(snapshot, routeConfig.authRequirement)) {
    return { allowed: false, action: routeConfig.fallbackBehavior };
  }

  if (!matchAny(snapshot.accessGroup, routeConfig.requiredAccessGroups)) {
    return { allowed: false, action: routeConfig.fallbackBehavior };
  }

  if (
    !matchSlotGroups(
      snapshot.slotGroup,
      routeConfig.slotGroups ?? [],
      routeConfig.slotGroupMatch ?? 'any',
    )
  ) {
    return {
      allowed: routeConfig.slotGroupScope !== 'page',
      action:
        routeConfig.slotGroupFailureBehavior ??
        (routeConfig.slotGroupScope === 'page' ? 'show-forbidden' : 'degrade-content'),
    };
  }

  if (!matchResourceRelation(snapshot, resourceContext)) {
    return { allowed: false, action: routeConfig.fallbackBehavior };
  }

  return { allowed: true, action: 'render' };
}
```

这里的关键约束是：

- 会话有效性失败优先级最高，直接登出，不进入 `GUEST` 流程
- 归一化后的身份快照才是路由守卫与页面判断的输入
- `requiredAccessGroups` 按“满足其一即可”解释
- `slotGroup` 判定使用 `slotGroupMatch`
- 资源关系判定永远晚于全局身份与 `slotGroup` 判定
- 不满足条件时，统一按配置中的回退策略处理
