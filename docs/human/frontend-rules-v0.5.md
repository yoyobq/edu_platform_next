# 前端分区规则（草案 v0.5）

本文件是当前前端规则的完整汇编版。

按主题读取时，优先使用 `docs/` 下的拆分文档；需要一次性查看完整规则时，再阅读本文件。

## 1. 总体目标

本项目采用三层结构：

- `stable`：正式稳定区
- `labs`：实验发布区
- `sandbox`：开发试验区

目标不是追求“纯粹 FSD”，而是实现：

- 正式区可维护、可演进
- AI 可快速生成实验结果
- 实验代码与正式代码隔离
- 在人工确认与监督下，实验能力可由 AI 协助整理后迁入正式区

当前补充：

- 项目采用二维治理
- 第一维是 `stable / labs / sandbox` 与 `app / pages / widgets / features / entities / shared`
- 第二维只作用于 `stable`，用于在高复杂度稳定业务切片内部按需引入 Clean Architecture / Hexagonal Architecture
- `labs` 与 `sandbox` 默认不采用第二维，避免把实验区过早工程化

界面语言提醒：

- 当前首批用户以中文用户为主，默认用户可见界面文案应优先使用中文
- 英文优先保留给代码标识、协议字段、第三方产品名与必要术语

说明：

- `stable` 不是单独目录名，而是指 `src/app`、`src/pages`、`src/widgets`、`src/features`、`src/entities`、`src/shared` 这一组正式区目录
- `labs` 和 `sandbox` 为独立顶层目录

完整视角示例：

```txt
src/
  app/
    providers/
    router/
  pages/
  widgets/
  features/
  entities/
  shared/
    ui/
    lib/
    types/
  labs/
    <lab-name>/
      index.tsx
      access.ts
      meta.ts
      ui/
      lib/
  sandbox/
    <prototype-name>/
      index.tsx
      mock.ts
      assets/
```

## 2. 三类区域定义

### 2.1 stable

正式业务区，用于长期保留和持续维护的功能。

特征：

- 可以进入生产
- 遵守正式目录规则与依赖方向
- 允许被其他正式模块复用
- 进入前必须经过人工确认；整理过程可由 AI 在人工监督下执行

适用内容：

- 核心页面
- 长期存在的业务功能
- 公共业务组件
- 稳定的数据访问逻辑
- 稳定的 UI 组合结构

### 2.2 labs

实验发布区，用于有实际价值、但尚未完全正式化的功能。

特征：

- 可以进入生产
- 必须受 access list 控制
- 允许快速验证真实效果
- 不默认等同于正式功能
- 后续要么删除，要么在人工确认下迁入 `stable`

适用内容：

- 已有明确用途的实验功能
- AI 快速生成后，经过初步人工筛选的页面或功能
- 小范围试用的工具页
- 暂未完全工程化，但值得观察的能力

### 2.3 sandbox

开发试验区，用于纯开发期快速试错。

特征：

- 只允许出现在 `dev`
- 不进入生产
- 不纳入正式菜单
- 不承诺复用
- 不承诺长期存在

适用内容：

- prompt 直接生成的原型页
- UI 试玩
- 交互验证
- 一次性试验代码
- 尚未确认是否有价值的想法

## 3. 基本原则

### 3.1 stable 优先治理，labs 优先验证，sandbox 优先试错

- `stable` 关注长期演进
- `labs` 关注真实使用效果
- `sandbox` 关注快速出结果

三者目标不同，不要求同一标准。

### 3.2 AI 生成代码可以进入项目，但不能默认进入 stable

AI 生成结果可以：

- 临时想法、一次性原型或纯开发期试错：先进入 `sandbox`
- 有明确用途、准备进入真实观察：优先进入 `labs`（`labs` 本身应具备基本分层）
- 在人工确认下，由 AI 协助整理后进入 `stable`

禁止把 AI 初稿直接视为正式模块。

### 3.3 迁入 stable 必须是一次人工确认的治理动作

从 `labs` 进入 `stable` 时，不应“原地毕业”。

- 是否迁入 `stable` 必须由人工确认
- 整理、迁移、重构动作可以由 AI 在人工监督下执行

最低完成线：

- 重新判断归属层级
- 对齐正式目录
- 清理试验性代码
- 删除实验暴露控制

若要进一步提升长期维护性，建议继续完成共享部分抽离与命名整理。

### 3.4 跨模块依赖必须走公开出口

- 跨层或跨模块导入只允许走公开 API，例如 `index.ts`
- 禁止深层引用其他模块内部文件
- `labs` 和 `sandbox` 不得依赖正式区私有实现

“公开内容”的定义：

- 公开内容指模块根目录公开出口文件导出的内容，例如 `index.ts`
- 只有从公开出口导入，才算合法依赖
- 文件存在且可被 import，不等于它是公开 API
- 直接引用其他模块内部文件，视为违规

示例：

- 合法：`import { UserCard } from '@/entities/user'`
- 违规：`import { UserCard } from '@/entities/user/ui/UserCard'`

## 4. 目录职责

```txt
src/
  app/
  pages/
  widgets/
  features/
  entities/
  shared/
  labs/
  sandbox/
```

新项目初期推荐目录：

- 早期可以只使用 `app/ + pages/ + shared/ + sandbox/`
- 当某个页面越来越臃肿，或某些组件需要在多个 `pages` 之间复用时，再引入 `features/` 或 `widgets/`
- 如无必要，勿增实体
- 目录分层服务于维护成本，不应为了形式完整而过早拆分

高混淆边界判断：

- `features` vs `widgets`：
  - `features` 关注“用户做什么”或“业务要完成什么”
  - `widgets` 关注“页面上有哪一块稳定结构”
- `entities` vs `features`：
  - `entities` 关注“业务对象本身如何被稳定表达”
  - `features` 关注“对业务对象执行什么动作”

快速判断：

- 名字像名词对象展示，优先判断是否属于 `entities`
- 名字像动词动作能力，优先判断是否属于 `features`
- 名字像页面区块、信息面板、布局组合，优先判断是否属于 `widgets`

示例：

- `UserCard`、`UserAvatar`、`NewsMeta`：更接近 `entities`
- `LoginForm`、`SwitchAccount`、`UpdateUserProfile`：更接近 `features`
- `Header`、`Sidebar`、`DashboardOverview`：更接近 `widgets`

### 4.1 app/

放全局级内容。

允许内容：

- provider
- router
- layout 骨架
- 全局配置
- 主题接入
- 应用启动逻辑

环境配置约定：

- Vite 相关环境变量统一放在仓库根下的 `env/`
- 按 mode 区分配置文件，例如 `development`、`production`、`e2e`
- 进入版本控制的应是 `*.example`
- 本地实际值使用 `*.local`，不提交到 git
- 具体变量与测试约定见 `docs/testing.md`

当前人工确认例外：

- `app/router` 可读取 `labs` 与 `sandbox` 的公开入口，仅用于路由注册、暴露控制与环境隔离
- 这不代表正式区其他模块可直接依赖 `labs` 或 `sandbox`

边界提醒：

- `app/` 负责 provider、router、应用壳层与全局 layout
- `app/` 的职责是“把页面挂起来”，不是承载页面内容本身
- 像 `HomePage` 这种正式页面内容应放在 `pages/`
- `app/lib` 放纯逻辑、纯数据结构与纯计算；去掉 React context / state / effect 后仍成立的实现，优先归入 `app/lib`
- `app/providers` 放状态宿主、Context、跨树共享状态与应用级挂载
- `providers` 应尽量薄；复杂计算和纯逻辑应优先下沉到 `app/lib`

禁止内容：

- 具体业务规则
- 页面私有实现细节
- 临时实验逻辑

### 4.2 pages/

放正式页面级组合。

允许内容：

- 页面组装
- 页面级布局组织
- 调用 `widgets`、`features`、`entities` 进行拼装

边界提醒：

- `pages/` 承载页面本身的内容与页面级组合
- 若一个实现删掉路由后，仍然明显是在表达某个正式页面，它应优先放在 `pages/`
- 不要把正式页面内容长期留在 `app/`，即使当前只有一个页面也一样

禁止内容：

- 大量重复业务实现
- 直接堆积可复用逻辑
- 把页面当成所有逻辑的收纳箱

### 4.3 widgets/

放跨页面复用的大块 UI 组合。

允许内容：

- 页面中反复出现的结构块
- 由多个 `features` / `entities` 组成的 UI 区块

禁止内容：

- 纯工具函数
- 与具体页面完全绑定的临时块

### 4.4 features/

放用户动作或明确业务意图。

允许内容：

- 登录表单
- 切换身份
- 发布新闻
- 修改资料
- 提交查询条件

特征：

- 有明确动作
- 有业务目的
- 可被页面或 `widgets` 组合使用

禁止内容：

- 泛化成所有东西都塞这里
- 无业务语义的纯展示组件

### 4.5 entities/

放稳定业务对象相关内容。

允许内容：

- `user` / `account` / `news` 等实体相关 UI
- 实体基础类型
- 实体字段展示
- 实体基础查询封装

禁止内容：

- 跨实体业务编排
- 明显属于 `feature` 的行为逻辑

### 4.6 shared/

放真正通用、无业务归属或业务弱相关内容。

允许内容：

- 通用 UI
- hooks
- lib
- types
- 工具方法

请求相关说明：

- `shared` 可以放请求基础能力，但不负责集中承载全站业务请求
- 通用请求客户端、鉴权注入、错误归一化可放在 `shared`
- 具体业务请求应按归属放在 `entities`、`features`、`labs` 或 `sandbox` 内
- 不建议把 `shared/api` 作为默认全站请求目录

禁止内容：

- 放具体业务逻辑
- 放某个页面专属实现

放入 `shared` 的判断标准：

- 与具体业务无关
- 可被两个及以上业务模块复用
- 即使未来业务变化，语义仍然成立
- 不依赖具体页面、具体实验、具体实体命名

不应放入 `shared` 的内容：

- 只被一个页面使用，且明显服务于该页面
- 只为某个 `labs` 实验临时存在
- 名称中带明显业务语义，如 `user`、`account`、`news`
- 依赖某个页面状态、页面路由或局部流程
- 只是“暂时不知道放哪里”

放置判断顺序：

- 只服务一个页面：先放页面附近
- 有明确业务动作：放 `features/`
- 有明确业务对象：放 `entities/`
- 跨页面复用的大块组合：放 `widgets/`
- 只有在无业务归属或业务归属很弱时，才放 `shared/`

`shared` 是“确认无明显业务归属后”的放置点，不是“暂时没想好放哪里”的默认位置。

### 4.7 labs/

放可受控进入生产的实验功能。

允许内容：

- 实验页面
- 小范围试用功能
- 尚未完全正式化但有实际用途的能力

要求：

- 必须有 `access list`
- 必须有用途说明
- 必须有负责人
- 必须有复查时间
- 必须说明撤回方式
- `reviewAt` 到期后必须复查，并给出“删除 / 延期 / 迁入 stable”之一的结论
- 不默认视为正式能力

目录建议：

- 按实验单元组织，不要求复制正式区分层
- 推荐形态：

```txt
src/labs/<lab-name>/
  index.tsx
  access.ts
  meta.ts  # 含 purpose / owner / reviewAt / rollback / exception?
  ui/
  lib/
```

`meta.ts` 最小模板：

```ts
export const demoLabMeta = {
  name: 'demo',
  purpose: '用于验证某个实验功能的真实使用效果',
  owner: 'frontend',
  reviewAt: '2026-04-30',
  rollback: '移除实验路由并隐藏入口',
  exception: ['依赖 @/entities/user 的公开内容'],
} as const;
```

字段说明：

- `name`：实验标识
- `purpose`：实验用途说明
- `owner`：负责人
- `reviewAt`：复查时间，使用 `YYYY-MM-DD`
- `rollback`：撤回方式
- `exception`：可选，记录经过确认的例外依赖或特殊规则

例外声明位置：

- 若 `labs` 需要使用规则之外的例外依赖，必须记录在该实验自己的 `meta.ts` 中
- 不使用文档尾部集中例外列表，也不依赖单独 `README.md` 口头说明
- `exception` 只记录已确认例外，不作为默认字段滥用

禁止内容：

- 长期替代 `stable`
- `reviewAt` 已过且无复查结论仍长期保留
- 依赖正式区私有实现

### 4.8 sandbox/

放纯开发试验代码。

允许内容：

- 原型页
- 一次性验证
- UI 草稿
- AI prompt 直出结果

要求：

- 仅 `dev` 可见
- 不进入 `prod`
- 不进入正式菜单
- 尽量自包含
- 不要求复制正式区分层

“自包含”的含义：

- `sandbox` 可依赖 `shared` 的通用基础能力
- 原型专用的 API 封装、数据映射、临时 mock、字段兼容逻辑应保留在 `sandbox` 内
- 只有当某段能力已脱离原型语义，且可被多个正式模块复用时，才考虑迁入 `shared`

目录建议：

- 按原型或想法组织
- 推荐形态：

```txt
src/sandbox/<prototype-name>/
  index.tsx
  mock.ts
  assets/
```

禁止内容：

- 被正式页面依赖
- 被 `labs` / `stable` 反向依赖
- 长期保留不处理

## 5. 依赖方向

采用轻量依赖约束：

- `pages -> widgets, features, entities, shared`
- `widgets -> features, entities, shared`
- `features -> entities, shared`
- `entities -> shared`
- `shared -> 不依赖业务层`

补充规则：

- `labs` 只允许依赖 `shared`，必要时可依赖 `entities` 的公开内容
- `labs` 默认不得依赖 `pages`、`widgets`、`features`
- 如确有必要，必须在该 `labs` 模块的 `meta.ts` 中声明 `exception`，而不是默认放开
- `sandbox` 只允许依赖 `shared`，必要时可有限依赖 `entities` 的公开内容做验证
- `sandbox` 默认不得依赖 `pages`、`widgets`、`features`
- `sandbox` 和 `labs` 都不得依赖 `stable` 内部私有实现
- 正式区不得依赖 `sandbox`
- 正式区不得依赖 `labs`
- 小项目允许先少分层，不要求为了对齐目录而强行拆分

规则执行方式：

- 依赖方向：由 ESLint 的 `boundaries` 插件自动检查
- 深层 import 与公开出口约束：由 ESLint 的 `no-restricted-imports` 规则检查
- `exception`：必须人工确认后才能写入 `meta.ts`，ESLint 不会自动根据 `exception` 放行
- 其余尚未工程化的规则，当前仍以文档约束和人工评审为主

人工判定提醒：

- ESLint 负责拦截默认违规依赖，但不会自动根据 `labs/<name>/meta.ts` 中的 `exception` 放行
- 若某次依赖确属例外，必须先由人工确认，再写入对应 `labs` 模块的 `meta.ts`
- 不允许为了通过 ESLint，直接改成深层 import、相对路径绕过或临时关闭规则
- 若未来出现 `app/router` 这类组合根需要接入 `labs` 或 `sandbox` 的场景，必须单独人工评审并明确写入规则，不能默认放开

## 6. access list 规则（仅用于 labs）

`labs` 中的功能若要出现在 `prod`，必须带轻量 access list。

access list 只解决三件事：

- 哪些环境可见
- 哪些角色可访问
- 是否显示在菜单中

访问语义：

- 未命中 access list 时，不得暴露入口
- 未命中 access list 时，不得直接访问成功
- access list 不是“只隐藏菜单”，而是实验功能的暴露控制

统一结构：

```ts
{
  env: ['dev', 'prod'],
  roles: ['admin', 'teacher'],
  menu: false,
}
```

要求：

- access list 只用于 `labs`
- access list 不代替正式权限系统
- access list 只做实验功能暴露控制

推荐落地方式：

- `labs` 的 access list 以独立 `access.ts` 作为唯一配置源
- 页面级实验默认由路由表读取该配置，并通过路由 `meta` 或等价字段完成入口控制与路由拦截
- 若实验能力以局部模块形式嵌入页面，可复用同一套 access 判断逻辑进行组件级控制
- 初期以路由级控制为主，组件级控制为补充，不要求一开始同时实现完整抽象

## 7. 上线规则

### 7.1 sandbox

- 仅 `dev` 可见
- 不允许进入生产
- 不参与正式菜单
- 不作为正式交付内容
- 路由只在 `dev` 注册

### 7.2 labs

- 允许进入生产
- 必须有 access list
- 必须可被快速撤回
- 不应默认面向全部用户开放

### 7.3 stable

- 正式上线
- 按正常权限和菜单体系管理
- 作为长期维护对象存在

## 8. AI 参与规则

### 8.1 允许 AI 快速生成页面和功能草稿

AI 可用于：

- 页面原型
- 交互草稿
- 小工具页
- 实验功能初稿
- 布局草稿

### 8.2 AI 生成结果默认先落 sandbox 或 labs

默认原则：

- 更常见路径：先以有基本分层的 `labs` 形态落地，验证通过后再迁入 `stable`
- `sandbox` 主要承接临时想法、一次性原型、交互试玩和纯开发期试错
- 未验证价值，且暂时不准备进入真实观察：进 `sandbox`
- 有明确用途、准备进入真实观察：优先进 `labs`（`labs` 本身应具备基本分层）
- 长期保留：在人工确认下，由 AI 协助整理后进 `stable`

### 8.3 AI 生成代码不得绕过目录与边界规则

即使是 AI 生成，也不能：

- 让 `stable` 直接依赖 `sandbox`
- 让 `labs` / `sandbox` 反向污染正式区私有实现
- 把实验代码伪装成正式公共模块
- 通过深层 import、相对路径或临时关闭规则来规避约束

### 8.4 从 sandbox 到 labs

`sandbox` 中的原型若验证有效、需要进入真实观察，可考虑重建为 `labs`。

- 不要求保留 `sandbox` 的原始结构
- 应按 `labs` 要求重新组织代码，并补充 `access list`
- 若原型中存在临时 mock、试玩 UI 或一次性验证逻辑，应在迁入前清理或隔离

## 9. 转正规则

以下情况可考虑从 `labs` 迁入 `stable`：

- 已有持续存在的使用对象，而不是只为一次验证、一次活动或一次汇报临时存在
- 即使移除 `labs` 的 access list，也能纳入正式权限、菜单或路由体系进行管理
- 入口、用途、保留原因已经明确，且已确认会继续保留
- 数据输入输出已基本确定，不再频繁改字段含义
- 页面或模块边界已清晰，能够判断应放入 `pages`、`widgets`、`features`、`entities` 或 `shared`
- 交互主流程已确定，不再频繁推翻页面结构、核心流程或主要区块划分
- 已完成一次受人工确认约束的整理，而不是保留 AI 初稿直接转入

不建议迁入 `stable` 的情况：

- 仍在频繁改用途，或仍无法说明会保留多久
- 仍依赖大量临时 mock、硬编码或实验开关
- 仍说不清它属于哪个正式层级
- 移除 `labs` 的 access list 后，就无法控制暴露范围或无法承担默认开放后的影响
- 仍没有明确负责人

`stable` 的进入标准应严格于 `labs` 和 `sandbox`，不能把建议项当作最低完成线。

迁移时必须完成：

- 重新判断归属层级
- 对齐正式目录
- 清理试验性代码
- 删除实验暴露控制

迁移时建议完成：

- 抽离共享部分
- 调整命名

若某次迁移确实暂时无法完成建议项，仍应保证不影响正式区边界清晰、依赖方向和长期维护。

## 10. 禁止事项

- 禁止把“暂时没想好放哪里”的内容直接塞进 `shared`
- 禁止把 `pages` 当业务逻辑总入口
- 禁止把 `labs` 当永久正式区
- 禁止让 `sandbox` 混入生产
- 禁止 `stable` 依赖 `sandbox`
- 禁止 `reviewAt` 已过且无复查结论的 `labs` 模块长期保留

## 11. 一句话版本

本项目采用 `stable / labs / sandbox` 三层结构：

- `stable` 负责正式业务与长期演进
- `labs` 负责可受控进入生产的实验功能，并通过轻量 access list 控制暴露范围
- `sandbox` 负责仅开发期可见的快速试验与 AI 原型验证

AI 可以高速生成结果；进入 `stable` 必须经过人工确认，整理过程可由 AI 在人工监督下执行。
