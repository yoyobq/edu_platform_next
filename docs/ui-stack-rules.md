<!-- docs/ui-stack-rules.md -->

# UI Stack Rules

本文件用于明确当前项目中 `antd`、`@ant-design/x` 与 `tailwindcss` 的分工边界。

项目同时使用这三者是成立的，但前提是职责必须明确。

如果不做分工，最容易出现的问题是：

- 样式责任不清
- 同一元素被多套体系重复控制
- 组件库 token、Tailwind 原子类和 AI 组件默认样式彼此打架
- 后期难以维护，也难以让 AI 稳定生成代码

## 核心原则

### 1. 一个元素只能有一个“样式主人”

同一个 UI 元素必须有一个主要负责它视觉与交互的体系。

默认规则：

- 组件结构和交互主要来自 `antd` 时，它就是 `antd` 元素
- AI 对话与生成交互主要来自 `@ant-design/x` 时，它就是 `antdX` 元素
- 纯布局容器、间距、宽度、响应式包装主要来自 `tailwindcss` 时，它就是 Tailwind 元素

禁止把同一个元素写成：

- `antd` 组件负责一半外观，Tailwind 再强行重写另一半核心样式
- `antdX` 组件负责行为，但又被当普通容器用 Tailwind 深度改造到认不出来

### 2. Tailwind 只进入 wrapper，不进入组件本体

这是当前项目的硬规则。

默认要求：

- Tailwind 只允许作用在外层包装层、布局层、区块层
- Tailwind 不进入 `antd` 组件本体
- Tailwind 不进入 `antdX` 组件本体

这里必须严格区分：

- 合法 wrapper：`div`、`section`、纯布局用途的 `Flex`、`Grid`、显式包装层
- 非法 wrapper：`Card`、`Modal`、`Drawer`、`Form.Item`、`Typography.Title` 这类已经自带语义化内边距、外边距或结构节奏的组件本体

即使某些 `antd` 组件看起来像容器，只要它已经承载了自身的间距与结构语义，向其注入 Tailwind 仍视为侵入组件本体。

**特别注意：Tailwind 文本类与 `Typography` 组件**

`Typography.Text`、`Typography.Title`、`Typography.Paragraph` 已自带完整的文本语义（字号、字重、颜色、行高）。以下做法视为侵入组件本体，**禁止**：

- `<Typography.Text className="text-xs">` — 用 Tailwind 覆盖 Typography 的字号
- `<Typography.Title className="font-semibold">` — 用 Tailwind 覆盖 Typography 的字重
- `<Typography.Text type="secondary" className="text-sm text-gray-500">` — Tailwind 与 Typography 双重控制

**正确做法**：如果需要紧凑标签文字（如指标卡的标签），直接用原生 `<span className="text-xs text-text-secondary">` 代替 `Typography.Text` + Tailwind 的混合写法。Typography 用于正式文本角色，原生 `<span>` + Tailwind 用于紧凑元信息——两条路径不要混用。

任何需要调整间距、宽度、对齐、响应式的诉求，应优先通过显式包装层解决。

任何需要调整视觉语义的诉求，应优先回到：

- `antd` 主题 token
- 组件自身 API
- 受控的上层封装组件

### 3. 先分“角色”，再分“样式”

不要先问“这个能不能用 Tailwind 改”，应先问：

- 它是业务组件、AI 组件，还是布局容器
- 它主要承担结构、交互，还是排版与间距

角色先定，后面的技术选型才不会乱。

## 分工约定

### `antd` 负责什么

`antd` 负责正式业务 UI 的基础组件能力与设计 token。

默认包括：

- 按钮、输入框、复选框、选择器、表单控件
- 卡片、菜单、弹层、消息提示、模态框
- Typography、Flex、Layout 等基础业务组件
- 主题 token、颜色体系、圆角、阴影、基础交互状态

适用场景：

- `main` 里的正式业务内容
- 稳定的管理与信息展示组件
- 需要一致交互行为和可预期可维护性的通用控件

默认不让 `antd` 做的事：

- 承担整个页面的原子级布局表达
- 充当 AI 对话系统的主要组件来源
- 被 Tailwind 深度改造成另一套视觉系统

### `@ant-design/x` 负责什么

`@ant-design/x` 只负责 AI 协作相关的交互部件。

默认包括：

- `Sender`
- 对话流、消息流、候选回复、思考态、生成态
- 未来的 Sidecar、Omni-bar、Artifacts 协作面板中的 AI 专用组件

适用场景：

- Sidecar 内的问答与生成交互
- 顶部轻量协作入口中的 AI 输入部件
- 生成物审阅区中的 AI 专用交互单元

注意：

- `antdX` 不具备独立主题体系，它是 `antd` 设计体系的下游
- 涉及 `antdX` 颜色、圆角、阴影、字体等全局视觉调整时，应优先回到 `antd` theme token 层处理
- 禁止把 `antdX` 的局部主题问题回退成 Tailwind 修补问题

默认不让 `antdX` 做的事：

- 承担正式业务页面的常规表单和信息展示
- 替代 `antd` 成为全站基础组件库
- 被当成普通容器组件到处铺开使用

### `tailwindcss` 负责什么

`tailwindcss` 负责布局、间距、尺寸、响应式和少量局部外观修饰。

默认包括：

- 页面和区块的宽度、高度、padding、margin、gap
- Flex / Grid 布局
- 响应式断点与容器级适配

> **响应式冻结**：项目未提供移动端设计稿，禁止使用 Tailwind 断点前缀（`sm:`、`md:`、`lg:`、`xl:`）。需要响应式适配时，通过 JS 感知容器宽度后**条件渲染**不同组件或布局（参见 `app-layout.tsx` 的 `mainWidthBand` 方案）。

- 一次性包装层、状态壳层、局部背景和边框

适用场景：

- 页面外层容器
- `main` / Sidecar / 第三工作区的结构布局
- 不值得为其单独抽主题 token 的轻量样式拼装

默认不让 Tailwind 做的事：

- 重写 `antd` 核心交互控件的关键视觉语义
- 深度覆盖 `antdX` 的内部消息与输入样式到脱离原组件语义
- 用大量原子类硬拼出本应由组件库承担的复杂控件

## 推荐搭配

最推荐的组合方式是：

- `antd` 管业务组件
- `antdX` 管 AI 组件
- `tailwindcss` 管布局壳层和局部包装

典型例子：

- 页面骨架：Tailwind
- 菜单、按钮、卡片、表单：`antd`
- Sidecar 里的 Sender、对话流：`antdX`
- Sidecar 外层尺寸、间距、边界：Tailwind

## 禁止模式

### 1. 不要用 Tailwind 深度改造组件库内部结构

例如：

- 给 `antd` 输入框塞一串类，试图彻底改掉它的高度、边框、交互状态
- 给 `antdX` 的消息组件加大量原子类，把它改成另一种完全不同的消息系统

这类改造默认不接受。

### 2. 不要为同类控件建立双轨

例如：

- 一半页面用 `antd` Button，一半页面自己用 Tailwind 拼 button
- 正式业务表单有时用 `antd` Form，有时全靠原生 input + Tailwind 拼装

除非是明确的原型验证，否则正式区应避免双轨并存。

### 3. 不要把 `antdX` 扩散成全站 UI 基础层

`antdX` 是 AI 协作层，不是全局基础组件库。

它应被限制在 AI 场景内使用，而不是逐步侵蚀 `main` 中的正式业务组件。

### 4. 不要把 Tailwind 当作 token 系统替代品

颜色、圆角、阴影、层级、控件状态等全局语义，应优先通过 `antd` 主题或统一 CSS 变量治理。

Tailwind 更适合消费这些语义，而不是重新发明它们。

### 5. Tailwind 与 `antd` 的 token 必须互通，禁止魔法值

当前项目里，Tailwind 不应自带一套与 `antd` 平行的颜色和间距语义。

必须满足：

- 若 Tailwind 需要使用颜色、文本色、边框色、背景色等语义，应优先消费统一的 CSS 变量或主题别名
- 不允许在 Tailwind 类或内联类名中随手写 `#1677ff` 这类魔法值
- 不允许让 Tailwind 默认色板逐步演化成第二套主题系统

当前工程更推荐的落地方向是：

- 由 `antd` theme token 和全局 CSS 变量提供语义源
- Tailwind 只消费这些语义，而不重新发明自己的主题值

由于当前项目使用的是 Tailwind v4 的 CSS 接入方式，相关别名与变量应优先在全局 CSS 层收敛，而不是默认假设存在 `tailwind.config.js`

## 实施细则

### 1. 页面级结构优先 Tailwind，组件级行为优先组件库

简单说：

- 外层容器用 Tailwind
- 内层业务组件用 `antd`
- 内层 AI 组件用 `antdX`

### 2. Sidecar 是混合区，但职责仍要拆开

在 Sidecar 中：

- 外层壳、尺寸、响应式、显示隐藏：Tailwind
- 标题、分组、按钮、分隔、基础控件：`antd`
- Sender、消息流、AI 专用交互：`antdX`

组件库通过 API 暴露的渲染插槽，可视为合法的局部 wrapper 边界。

例如：

- `footer`
- `extra`
- `title`
- `actions`
- `dropdownRender`

在这些插槽中：

- 允许在插槽根节点使用 Tailwind 做局部排版
- 但不允许借插槽向上反向污染组件外层结构或主题语义

### 2.5 重复出现的“wrapper + 组件”组合要及时上收

如果某种固定的 Tailwind wrapper 加 `antd` / `antdX` 组合重复出现，不应一直散落在页面里手写。

默认约定：

- 同一组合重复超过 2 次，应考虑提炼为上层封装组件
- 通用组合优先进入 `shared`
- 带明确业务语义的组合进入 `widgets` 或更贴近业务的层

目标不是过早抽象，而是避免页面被重复的 wrapper 和 className 淹没。

### 3. Tailwind 只修 wrapper，不碰组件骨架

可接受：

- 包装层上的 `max-w-*`
- 包装层上的 `p-*`
- 包装层上的 `gap-*`
- 包装层上的 `rounded-*`
- 包装层上的 `border-*`
- 布局与容器类

默认禁止：

- 把 Tailwind 类直接打到 `antd` / `antdX` 组件本体上做视觉改造
- 直接用原子类重写组件库的 hover / active / focus 语义
- 通过一长串类把组件库控件做成另一种设计语言
- 通过 Tailwind 侵入消息气泡、输入框、按钮、卡片等组件本体内部语义

这也包括：

- 不允许用 Tailwind 直接覆盖 `antd` 组件本体自带的默认 `margin`

当前项目的判断是：

- 大多数这类诉求都应通过 wrapper、组件 API、插槽、或上层封装解决
- 即使会稍微绕行，也优先选择结构性解决，而不是在页面里直接给组件本体补 Tailwind 类

### 4. 主题统一从上层收敛

后续如果出现颜色、圆角、阴影、层级不统一，优先修正：

- `antd` theme token
- 全局 CSS 变量
- layout 层级 token

不要优先在页面里补更多 Tailwind 类做局部修修补补。

### 5. 封装组件默认不要暴露原始 `className`

对于基于 `antd` / `antdX` 封装出来的业务组件，默认不要把原始 `className` 作为自由透传的能力暴露出去。

原因很直接：

- 一旦暴露原始 `className`，外部就会倾向于把 Tailwind 类直接打进组件本体
- 这会反向破坏“Tailwind 只进 wrapper”的硬规则

更稳的做法是：

- 需要控制外部间距时，让调用方自己包 wrapper
- 需要暴露有限外观能力时，优先提供明确命名的 `containerClassName`、`wrapperClassName` 等受控 props
- 这类 props 只能挂在组件最外层的纯布局 wrapper 上，不能透传到 `antd` / `antdX` 组件本体
- 不提供“任意类名注入”的逃生口

## 对 AI 生成的额外约束

AI 生成代码时，应默认遵守：

- 业务控件优先选 `antd`
- AI 对话控件优先选 `antdX`
- 布局和容器优先选 Tailwind
- Tailwind 只写在 wrapper，不写进 `antd` / `antdX` 组件本体
- Tailwind 使用颜色或语义尺寸时，优先走全局 CSS 变量或语义别名，不写魔法值
- 不要同时生成两套同类控件
- 不要为了省事用 Tailwind 手搓本应用 `antd` 的正式业务组件
- 样式与 TSX 默认不强制拆文件；单一组件的局部样式可继续就近放置
- 只有当样式出现明确复用或自身复杂度已值得单独维护时，再拆出独立样式文件

## 当前项目的落地判断

当前项目中，更合理的使用方式应收敛为：

- [src/app/router/index.tsx](/var/www/aigc-friendly-frontend/src/app/router/index.tsx)
  `antd` 负责基础 Layout、Menu、Typography；Tailwind 负责局部容器类
- [src/pages/home/index.tsx](/var/www/aigc-friendly-frontend/src/pages/home/index.tsx)
  `antd` 负责 Card、Button、Checkbox、Typography；`antdX` 负责 Sender；Tailwind 负责区块宽度、边框和布局壳
- `labs` / `sandbox`
  继续优先沿用相同分工，不要因为是试验区就随手切成另一套 UI 语言

## 当前结论

一句话约定：

- `antd` 是正式业务组件层
- `antdX` 是 AI 协作组件层
- Tailwind 是布局与包装层
- Tailwind 只进入 wrapper，不进入组件本体

若出现冲突，先问“谁应该拥有这个元素”，再决定保留哪一层控制权。
