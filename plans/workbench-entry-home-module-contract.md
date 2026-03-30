# Workbench Entry Home Module Contract Proposal

本文件是 `workbench entry` 主题下 P1-1 的当前产出物。

它只回答以下问题：

- 首页工作台上的单个模块，最少要提供哪些 contract
- 这些 contract 分别服务摘要数据、主动作、空态、错误态、可见性规则与跳转位中的哪一部分
- 这些 contract 在前端应由谁拥有、由谁消费

它不回答：

- 第一批最终上线模块名单
- 角色模板与个人偏好的覆盖关系细节
- 某个具体模块的真实接口字段

这些内容继续分别属于 P2、P3 与具体实现阶段。

## 目标

- 让 `pages/home` 有一套足够稳定、又不会过度工程化的首页模块最小 contract
- 让首页模块继续保持“摘要与入口”，而不是退化成正式页面缩略图
- 让模块数据、动作、可见性与跳转位可以在不同 feature 间保持一致表达
- 为后续第一批正式首页模块清单提供统一落点

## 当前判断

- 当前首页仍只有过渡态的 `ApiHealthStatusPanel`
- 现有首页内容尚未进入“多个正式模块并列编排”的阶段
- 但如果不先定义最小 contract，后续每加一个首页模块都容易各写各的字段、状态和动作形态
- 因此 P1-1 要先统一“模块长什么样、最少要回答什么”，而不是现在就拍死模块名单

## 结论

首页工作台上的单个模块，至少要稳定回答六件事：

- 它在摘要上展示什么
- 用户第一步能做什么
- 没数据时怎么降级
- 出错时怎么降级
- 对当前用户是否可见
- 从这里应该跳到哪个正式页面或受控目标

这六件事就是首页模块的最小 contract。

## 模块 contract 的最小结构

当前推荐把首页模块 contract 收束成三层：

1. 模块身份层
2. 模块状态层
3. 模块动作层

推荐的最小形态如下：

```ts
type HomeModuleContract = {
  id: string;
  title: string;
  intent: string;
  visibility: HomeModuleVisibility;
} & (
  | {
      visibility: { visible: false; reason: HomeModuleHiddenReason };
    }
  | {
      visibility: { visible: true; reason: HomeModuleVisibleReason };
      state: HomeModuleState;
      entry: HomeModuleEntry;
    }
);
```

说明：

- `id` 用于稳定标识模块
- `title` 用于首页展示名称
- `intent` 用一句话说明这个模块帮用户完成什么
- `visibility` 回答“该不该出现”
- 对可见模块，`state` 回答“当前显示什么”
- 对可见模块，`entry` 回答“从这里怎么继续进入正式页面或下一步”

补充：

- 默认编排优先级不进入单模块 contract
- 模块是否排前、排后、分组或折叠，继续留给模板层与页面级编排决定

## 1. 模块身份层

### `id`

- 必须稳定
- 不跟标题文案强绑定
- 用于默认模板编排引用、埋点、偏好持久化和后续实验迁移

### `title`

- 面向用户展示
- 保持可读
- 不用承载权限、环境或实验标记等额外语义

### `intent`

- 用一句短说明表达模块价值
- 它不是长描述，不替代空态或错误态文案
- 作用是让首页工作台在多模块并列时仍然可快速被识别

## 2. 模块状态层

首页模块必须显式表达自己的当前状态，而不是默认所有模块都只有“有数据”一种情况。

但只有在模块 `visible: true` 时，才要求继续产出完整 `state` 与 `entry`。

```ts
type HomeModuleState =
  | {
      kind: 'ready';
      summary: HomeModuleSummary;
      isRefetching?: boolean;
    }
  | {
      kind: 'empty';
      empty: HomeModuleEmptyState;
    }
  | {
      kind: 'error';
      error: HomeModuleErrorState;
    };
```

当前先不把 `loading` 作为首页模块对外 contract 的必填状态。原因是：

- 首页首屏 loading 更适合由页面骨架或模块壳层统一处理
- 模块真正需要稳定暴露给编排层的是 ready / empty / error 三种结果态
- 若模块在已显示摘要后发生局部刷新，可在 `kind: 'ready'` 下通过 `isRefetching` 表达瞬态更新，而不是退回全局骨架屏

### 摘要数据

摘要数据只出现在 `kind: 'ready'` 下。

```ts
type HomeModuleSummary = {
  headline: string;
  items?: readonly HomeModuleSummaryItem[];
  badges?: readonly HomeModuleBadge[];
  updatedAt?: string | null;
};

type HomeModuleSummaryItem = {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
};

type HomeModuleBadge = {
  text: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
};
```

约束：

- `headline` 用一句话总结当前最重要信息
- `items` 用于承载 2 到 5 个轻量摘要点
- `badges` 只做状态强化，不承载主要内容
- 首页模块不直接承载长列表、复杂筛选和完整流程

## 3. 模块动作层

首页模块至少要有一个明确下一步。

```ts
type HomeModuleEntry = {
  primaryAction: HomeModuleAction;
  secondaryActions?: readonly HomeModuleAction[];
};

type HomeModuleAction = {
  id: string;
  label: string;
  kind: 'navigate' | 'trigger';
  disabled?: boolean;
  loading?: boolean;
  reason?: string;
  to?: string;
};
```

约束：

- `primaryAction` 必填，回答“用户从这里最应该先做什么”
- `secondaryActions` 选填，避免一个模块堆太多按钮
- 若 `kind` 为 `navigate`，`to` 必须是站内受控目标
- `navigate` 只用于进入站内受控路由，不承担局部提交流程或协作 intent
- `trigger` 只用于不发生路由切换的站内受控 action；它可以同步，也可以是受控异步提交或重试
- 模块的正式进入位默认由 `primaryAction` 或某个明确的 `secondaryAction` 承担，不再额外维持第二套 `destination` 真相来源
- 若当前还没有稳定正式页面，模块可以只有受控 `trigger`，但不能假装自己已经具备正式跳转位
- 若某个动作会触发局部异步提交或重试，可通过 `loading` 表达该动作自己的瞬态状态，而不是让整个模块退回首屏 loading 语义
- 若某个动作需要打开 Sidecar、切入第三工作区或触发更复杂协作 intent，不应由模块自行发明协议，仍应通过页面或壳层预先声明的受控 action / intent 接入

## 空态 contract

模块没有可展示数据时，必须显式给出空态，而不是留白。

```ts
type HomeModuleEmptyState = {
  title: string;
  description: string;
  action?: HomeModuleAction;
};
```

空态回答的问题：

- 为什么现在没有内容
- 用户下一步可以做什么
- 这个模块是“当前无数据”还是“当前无需显示细节”

约束：

- 空态不等于错误
- 空态文案不表达技术失败
- 空态动作优先引导到“创建第一条”“去完成前置步骤”“查看正式页面”

## 错误态 contract

模块获取数据或组装摘要失败时，必须显式给出错误态。

```ts
type HomeModuleErrorState = {
  title: string;
  description: string;
  severity?: 'warning' | 'error';
  action?: HomeModuleAction;
};
```

错误态回答的问题：

- 是什么失败了
- 用户能否重试或去正式页面继续
- 当前错误是轻微降级还是不可用

约束：

- 错误态优先承载“重试”“查看详情”“前往正式页面”
- 错误态不暴露后端原始异常对象
- 失败兼容与异常文案整理优先由拥有该模块的 feature 完成

## 可见性规则 contract

首页模块不允许默认全部出现，必须显式说明当前用户为什么能看见或不能看见。

```ts
type HomeModuleHiddenReason = 'forbidden' | 'not-configured' | 'env-blocked';

type HomeModuleVisibleReason = 'allowed';

type HomeModuleVisibility =
  | {
      visible: false;
      reason: HomeModuleHiddenReason;
    }
  | {
      visible: true;
      reason: HomeModuleVisibleReason;
    };
```

当前建议：

- `visible: false` 时，模块默认不渲染
- `visible: false` 时，不要求模块继续产出完整 `state` 与 `entry`
- 是否给出“不可见原因”提示，由首页模板层统一决定，不由模块各自弹提示
- 可展示模块统一由 `visible: true` 表达；是否为空，继续由 `state.kind` 区分

语义要求：

- 可见性由权限、默认编排、环境暴露与产品策略共同影响
- 但这几种来源在实现上不能混成一个 if-else 大杂烩
- 模块拥有者负责给出自己的最小可见性判断结果，首页模板层负责最终编排
- “当前是否为空”不进入可见性 reason，继续留在 `state.kind`

## 跳转位 contract

首页模块必须能回答“从首页出去时，应该去哪里”。

最小要求：

- 至少有一个明确的正式页面 route，或一个明确的受控 trigger
- 该跳转位必须是用户能理解的下一步，而不是技术调试入口
- 若模块对应的正式页面尚未存在，该模块应被标记为过渡模块，而不是伪装成正式模块
- 这类进入位应继续通过 `primaryAction` / `secondaryActions` 表达，而不是额外再维护一套平行 destination 字段

这里的重点不是“每个模块都必须先有独立详情页”，而是：

- 首页模块不能把完整流程硬塞在自己内部
- 一旦需要深度查看、编辑或多步骤操作，就应该把用户送去正式页面

## 前端拥有者边界

### `pages/home`

- 负责组合模块列表与页面布局
- 不直接消费后端原始 DTO
- 不自己拼装每个模块的空态、错误态与权限判断细节

### 对应 `feature`

- 拥有模块摘要数据的 use case
- 拥有模块状态转换
- 拥有异常到错误态的收束
- 拥有从业务数据到 `HomeModuleContract` 或模块 view model 的整理

### `widgets`

- 若后续出现跨页面复用的首页模块容器、卡片骨架或统一模块外壳，可进入 `widgets`
- 但单个模块的业务语义不应因此被抬升到 `widgets`

## 推荐的消费方式

当前推荐不要让 `pages/home` 直接拼任意对象，而是消费统一的模块 view model 列表：

```ts
type HomeModuleViewModel = HomeModuleContract;

type HomePageViewModel = {
  modules: readonly HomeModuleViewModel[];
};
```

后续若需要扩展首页编排信息，可在页面层额外叠加：

- 分组
- 排序
- 折叠
- 个性化偏好

但不在 P1-1 阶段提前写进单模块 contract。

## 过渡模块的处理原则

当前仓库里的 `ApiHealthStatusPanel` 可视为过渡态首页模块参考，但它还不等于正式 contract 已经落地。

当前建议：

- 先把它视作“系统状态概览”类模块的雏形
- 后续若进入正式首页，应补齐统一的 `summary / entry / empty / error / visibility`
- 若它最终只用于验证或开发观察，则不应直接成为正式首页模块 contract 的事实标准

这能避免“当前页面上先有什么，就被反推成正式规范”。

## 当前推荐实现顺序

1. 先在 workbench entry 拥有者处建立首页模块 view model 组装层
2. 让单个模块按本 contract 输出 ready / empty / error 结果
3. 再由 `pages/home` 统一渲染模块容器与编排
4. 后续进入 P2 时，再确定第一批正式模块名单

## 完成标准

- 首页单模块最小 contract 已覆盖摘要数据、主动作、空态、错误态、可见性规则与跳转位
- `pages/home` 与模块拥有者的职责边界明确
- 首页模块继续保持“摘要与入口”，而不是正式页面缩略图
- 过渡模块不会自动上升为正式 contract 标准
