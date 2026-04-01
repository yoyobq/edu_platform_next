<!-- docs/ui-design/typography.md -->

# Typography

项目文本视觉只做少量角色约束，不单独发明一套复杂字号系统。目标是让页面层级稳定、便于复用，也便于 AI 稳定生成。

## 核心原则

### 1. 先定"文本角色"，再定组件写法

不要先想"这里用 `text-sm` 还是 `text-base`"，应先判断它是：

- 页面标题
- 内容区标题
- 卡片标题
- 区块内小标题
- 正文
- 辅助说明
- 标签/元信息

角色先定，视觉层级才不会漂移。

### 2. 优先使用 `antd` Typography 体系

默认优先：

- `Typography.Title`
- `Typography.Text`
- `Typography.Paragraph`
- `Typography.Link`

不要在页面里长期散落一套由 `text-*`、`font-*`、`leading-*` 临时拼出来的第二排版系统。

补充：

- `Typography` 负责项目的大部分正式文本角色
- 但 HTML 语义优先级高于纯视觉级别
- `Typography.Title` 的 `level` 同时控制视觉尺寸与底层 HTML 标签（`level={3}` 渲染 `<h3>`），视觉与语义是绑定的
- antd 不提供"只改视觉、保留独立语义"的能力；当页面主标题需要 `<h1>` 语义时，不要机械把 `level` 写成视觉值，应参考下面"语义覆盖"节的方案

### 3. `Typography` 与 Tailwind 文本类的决策顺序

文本相关实现，按下面顺序判断：

1. 它是不是正式文本角色。
   页面标题、内容区标题、卡片标题、正文、辅助说明、字段帮助这类正式文本，优先使用 `antd` Typography。

2. 它是不是 `antd` 组件本体。
   如果文本已经由 `Typography.*`、`Card`、`Alert`、`Form.Item` 等 `antd` 组件承载，不要再给组件本体补文本样式类（`text-*`、`font-*`、`leading-*`）；文本相关调整优先走组件 API、token 或受控 wrapper。布局类也应放在外层 wrapper，而不是直接打到组件本体上。

3. 它是不是纯 wrapper / 原生 HTML / 紧凑元信息。
   只有在纯 `div` / `span` / 原生 HTML 容器、局部元信息、胶囊、徽标、小块状态文案这类场景里，才允许使用 Tailwind 语义文本类。

4. 如果两种方式都能实现，默认选更稳定的一种。
   正式业务文本优先 `Typography`；局部包装层和紧凑元信息优先 Tailwind 语义类。

简单说：

- 文本角色：优先 `Typography`
- 文本容器：可用 Tailwind
- 不要把 Tailwind 文本类打到 `antd` 文本组件本体上

### 4. 一页只允许一个页面主标题

页面标题是当前视图的最高文本层级。

- 同一页面只允许一个主标题
- 该主标题应同时考虑视觉层级与 HTML 语义
- 当前页面若不存在更高层语义标题，应优先保证存在单个 `<h1>`
- 卡片标题、区块标题不能与页面标题竞争
- 需要更多层级时，优先靠结构分组，而不是不断抬高字号和字重

### 5. 正文与辅助说明只保留两档

- 正文：默认文本层
- 辅助说明：`secondary` 文本层

不要通过连续降低字号、不断变灰来制造"伪层级"。

### 6. 字重保持克制

只用两档：

- `400`：正文
- `600`：标题、强调、小标题

禁止 `font-medium`（500）和 `font-bold`（700）。`font-semibold`（600）等价于标题/强调档，仅用于 Tailwind 紧凑元信息标签场景（如状态面板里的技术字段名）；正式文本角色优先通过 `Typography.Text strong` 或 `Typography.Title` 获得 600 字重。

## 页面上下文

项目存在两种不同的页面上下文，标题层级不同。

### 工作台页面（Workbench）

登录后的主工作区页面，由 `AppLayout` 壳层包裹。壳层已提供应用标识（`Typography.Title level={4}` 用于 header 中的应用名）。

特点：信息密度高、多卡片并列、页面标题不需要营销级尺寸。

标题层级：

| 角色           | 推荐写法                         | 视觉尺寸 | 说明                                                |
| -------------- | -------------------------------- | -------- | --------------------------------------------------- |
| 页面标题       | `Typography.Title level={3}`     | ~24 px   | 页面最高层级；每页唯一                              |
| 内容区标题     | `Typography.Title level={4}`     | ~20 px   | 页面内一级分组，如独立面板标题                      |
| 卡片标题       | `Typography.Title level={5}`     | ~16 px   | 与正文接近，靠字重拉开差异，避免卡片标题膨胀        |

已落地参考：

- 页面标题 — `src/pages/home/index.tsx` "默认工作台" `level={3}`
- 内容区标题 — `src/features/public-auth/ui/reset-password-intent-panel.tsx` "设置新密码" `level={4}`
- 卡片标题 — `src/pages/home/index.tsx` HomeModuleCard 中的模块标题 `level={5}`

### 公共入口页面（Public Entry）

登录前的独立页面（登录、找回密码、验证入口），无 `AppLayout` 壳层，采用左右两栏布局：左侧页面说明区 + 右侧操作卡片区。

特点：空间充裕、信息密度低、页面标题是唯一语义锚点。

标题层级：

| 角色               | 推荐写法                                     | 视觉尺寸 | 说明                                                                      |
| ------------------ | -------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| 页面标题（左栏）   | 原生 `<h1>` + antd heading CSS 变量          | ~24 px   | 页面语义主标题；用原生 `<h1>` 保证语义，用 CSS 变量保持视觉与 `level={3}` 一致 |
| 操作区标题（右栏） | `Typography.Title level={4}`                 | ~20 px   | 卡片内的内容区标题（如"账户登录""发送重置邮件"），低于页面标题              |

语义覆盖写法：

```tsx
<h1
  style={{
    fontSize: 'var(--ant-font-size-heading-3)',
    fontWeight: 'var(--ant-font-weight-heading)',
    lineHeight: 'var(--ant-line-height-heading-3)',
    marginBottom: 12,
    marginTop: 8,
  }}
>
  登录后再进入工作台
</h1>
```

已落地参考：

- 页面标题 — `src/pages/login/index.tsx`、`src/pages/forgot-password/index.tsx`、`src/pages/verification-intent/index.tsx` 左栏标题
- 操作区标题 — `src/pages/login/index.tsx` "账户登录" `level={4}`、`src/pages/forgot-password/index.tsx` "发送重置邮件" `level={4}`

为什么公共入口不直接用 `Typography.Title level={3}`：

- 这些页面是独立视图，没有外层壳层提供语义锚点
- 页面主标题需要承担 `<h1>` 语义职责
- `Typography.Title level={3}` 会渲染 `<h3>`，无法满足 `<h1>` 语义
- 通过原生 `<h1>` + antd CSS 变量，可以同时满足语义正确和视觉统一

## 文本角色

通用文本角色表（适用于所有页面上下文）：

| 角色                       | 推荐写法                                                                      | 视觉方向                         | 行数建议            | 说明                                      |
| -------------------------- | ----------------------------------------------------------------------------- | -------------------------------- | ------------------- | ----------------------------------------- |
| 页面标题                   | 见上方"页面上下文"节                                                          | 页面最高层级，稳重明确           | 1-2 行              | 用于页面头部；默认页面唯一                |
| 页面副标题/导语            | `Typography.Paragraph type="secondary"` 或 `Typography.Text type="secondary"` | 对标题做解释，不抢主层级         | 1-3 行              | 短说明可用 `Text`，成段说明用 `Paragraph` |
| 内容区标题                 | `Typography.Title level={4}`                                                  | 页面内一级分组标题               | 1 行优先，最多 2 行 | 如"基本信息""设置新密码"                  |
| 卡片标题                   | `Typography.Title level={5}`                                                  | 卡片头部标题，弱于内容区标题     | 1 行优先，最多 2 行 | 可与 `extra/actions` 并列                 |
| 弹层标题（Modal / Drawer） | 组件 `title` prop 直接传字符串或轻量 JSX                                      | 与卡片标题同级，不与页面标题竞争 | 1 行优先，最多 2 行 | antd 已内建标题样式，无需手动设置；不要在 `title` prop 内嵌套 `Typography.Title` |
| 区块内小标题               | `Typography.Text strong`                                                      | 卡片内部再分组                   | 1 行                | 不再继续升 `Title`                        |
| 正文                       | `Typography.Text` 或 `Typography.Paragraph`                                   | 默认阅读文本                     | 1-4 行              | 成段内容优先 `Paragraph`                  |
| 辅助说明                   | `Typography.Text type="secondary"`                                            | 次要说明、提示、上下文补充       | 1-2 行              | 不承载主信息                              |
| 标签/元信息                | `Typography.Text type="secondary"` 或 Tailwind 紧凑写法                       | 时间、状态补充、来源等弱信息     | 1 行                | 胶囊、徽标等紧凑元信息允许用 `text-text-secondary text-sm` |
| 表单标签                   | 依赖 `antd` Form 默认 label                                                   | 与表单系统保持一致               | 1 行                | 不手写一套自定义 label 样式               |
| 字段帮助/校验文案          | 帮助文案用 `Typography.Text type="secondary"`；错误文案走 `Form.Item` 校验    | 帮助弱于正文，错误由组件系统接管 | 1-2 行              | 不手写红字提示替代表单校验                |
| 空状态标题                 | `Typography.Text strong`                                                      | 轻量强调，弱于卡片标题           | 1 行                | 空状态不是页面主层级                      |
| 空状态说明                 | `Typography.Text type="secondary"`                                            | 解释当前为空及下一步             | 1-2 行              | 避免只放一行灰字                          |
| 统计数字/关键数值          | `antd` `Statistic` 优先                                                       | 用组件表达信息密度               | 1 行                | 不用裸 `Title` 手搓指标数字               |

### Card `title` prop 的处理

`antd` Card 的 `title` prop 已自带标题视觉。使用时：

- 优先直接传字符串：`<Card title="候选结果物">`
- 需要添加右侧操作或状态时可用 JSX，但 JSX 内只做布局，不要嵌套 `Typography.Title`
- 不要在传入 `title` prop 的 JSX 上添加 Tailwind 字号或字重类来覆盖 Card 内建标题样式

已落地参考：`src/labs/demo/page.tsx` Card title 直接传字符串 `"候选结果物"`、`"页内对照预览"`。

## 组合规则

### 页面头

页面头默认由三部分组成：

- 左侧：页面标题
- 标题下：可选副标题/导语
- 右侧：可选操作区

约束：

- 页面主标题只出现一次
- 副标题只解释当前页面，不重复标题文案
- 右侧操作区不通过更重更大的字来制造存在感，应靠按钮层级表达

### 内容区

一个内容区只放一个内容区标题。

- 内容区标题下可以接卡片组、表单组、列表组
- 若内容区内首个卡片已经有明确标题，不要再在卡片内重复一遍同级标题

### 卡片

卡片头部可包含：

- 卡片标题
- 辅助说明
- `extra` / 操作区

约束：

- 工作台页面内，卡片标题不能高于 `level={5}`
- 卡片内部若还要分段，只用 `Text strong` 做小标题
- 不要在一张卡片内堆两层 `Title`

### 表单

表单文本层级固定为：

- 字段标签
- 字段内容
- 帮助文案或错误文案

约束：

- 标签沿用 `antd` Form 默认体系
- 帮助文案统一用 `secondary`
- 错误文案统一交给表单校验状态，不手写另一套红色提示

### 表格与列表

一行信息最多保留两层文本：

- 主信息：正文层
- 次信息：辅助说明层

不要在单元格里同时堆叠多档字号、字重和颜色。

### 空状态

空状态默认包含：

- 一个简短标题
- 一段次要说明
- 一个明确下一步操作（若有）

不要只放一句泛化灰字说明。

## Sidecar 密度上下文

EntrySidecar（`src/app/layout/entry-sidecar.tsx`）是项目的全局协作入口抽屉，内部空间较窄、信息密度较高。

排版例外：

- Sidecar 内部的 entry card（导航卡片）允许通过 `style` prop 局部收紧 `fontSize`（如 13px、12px），以匹配 Sidecar 的紧凑空间
- 这是对"沿用 antd 默认 fontSize: 14"规则的受控例外，仅限于 Sidecar 内部的紧凑导航元素
- 若此模式扩散到更多场景，应改为在 Sidecar 根部包裹 `ConfigProvider` 统一设置 `token.fontSize`，而非逐个组件内联覆盖
- Sidecar 内的 Drawer `title` prop 允许使用轻量 JSX 承载图标 + 文案组合（如 `✨ 从这里开始`），不强制要求纯字符串

## 颜色与行高

- 基础正文字体栈沿用 antd 默认 `fontFamily`，即系统 UI sans-serif 栈；当前项目不额外引入独立品牌字体
- 代码与等宽文本沿用 antd 默认 `fontFamilyCode`
- 标题、正文默认跟随 antd Typography 语义色
- 辅助说明统一使用 `type="secondary"`
- 链接统一使用 `Typography.Link` 或裸 `<a>`
- 纯 wrapper / 原生 HTML 若需文本色，只使用语义类：`text-text`、`text-text-secondary`、`text-link`
- `--color-ai-accent` 不用于正文小字，相关限制见 [colors.md](./colors.md)
- antd 默认 `fontSize: 14` 与默认行高继续沿用，不额外自定义（Sidecar 密度例外见上节）
- 默认不手动调整 `leading-*`
- 只有长文章、长说明、文档式阅读区这类连续阅读场景，才允许在纯 wrapper 上局部使用 `leading-relaxed`
- 普通页面说明、卡片文案、表单帮助、列表内容，统一依赖 antd 默认行高，避免密度漂移

## 响应式排版

- 默认不因为 Sidecar 打开、局部容器变窄，就自动把整套标题字号降一档
- 标准页面优先通过换行、容器重排、区块折叠和间距调整消化宽度变化
- 只有在 Drawer、Sidecar、小屏单列或其它明确窄容器场景里，才允许局部把标题视觉层级降一档
- 页面主标题若已承担语义主标题职责，不要只因空间变窄就取消其语义层级
- 不要把响应式排版做成"每个断点都重新发明一套字号表"

## 文本省略

后台场景里，名称、路径、描述、环境标签、接口地址都可能过长。文本省略要统一使用组件能力或受控模式，不要每处各写一套截断技巧。

| 场景                   | 推荐方案                                                        | 补充                               | 禁止                                                   |
| ---------------------- | --------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| 单行省略               | `Typography.Text ellipsis`                                      | 全文重要时补 `title` 或 tooltip    | 主信息裸写 `className="truncate"` 且无全文可见路径      |
| 多行省略（单体说明区） | `Typography.Paragraph ellipsis={{ rows: 2 }}`                   | 适合详情、弹层、空状态等低重复场景 | 在高重复列表中大量使用 JS 省略                         |
| 多行省略（高重复列表） | 受控 CSS `line-clamp` / `-webkit-line-clamp`                    | 适合卡片流、长列表、密集摘要区     | 在高重复列表中默认使用 `Typography.Paragraph ellipsis` |
| 表格内省略             | `column.ellipsis` 或列级受控 CSS 截断                           | 由表格列配置统一处理               | 单元格里零散手写截断方案                               |
| 卡片/列表摘要          | 低重复可用 `Typography.Paragraph ellipsis`；高重复优先 CSS 截断 | 摘要不超过 2-3 行                  | 为了省空间把正文全部裁成一行                           |

补充判断：

- 文本若是主信息，优先保证可见性，其次才是省略
- 文本若被省略，应该保留看到全文的路径
- 次要装饰性文本可仅做单纯裁断，不强制补 tooltip
- 高重复场景优先考虑纯 CSS 截断，避免把大量 `ResizeObserver` 和 JS 计算堆进列表
- 不要把省略当作布局修补工具；如果核心信息长期被截断，应先反查容器宽度和信息架构

## 特殊字体

只有数字稳定性、代码辨识度和机器标识可读性明确重要时，才使用等宽字体。

推荐：

- 统计数字、关键数值：优先 `antd` `Statistic`
- 需要避免数字抖动的计数、金额、耗时、状态码：可用 `font-mono tabular-nums`
- 代码片段、命令、触发词、短 ID：优先 `Typography.Text code`；需要自定义 wrapper 时再用 `font-mono`

不推荐：

- 正文大段内容混用等宽字体
- 为了"技术感"把普通业务数字全部改成等宽字体
- 自定义一套与正文竞争的代码块内联视觉

## AI 生成代码时的默认判断

- 工作台页面最上层标题默认 `Typography.Title level={3}`
- 公共入口页面标题默认原生 `<h1>` + `level={3}` 视觉（参考"页面上下文"节）
- 页面内一级区块默认 `Typography.Title level={4}`
- 卡片标题默认 `Typography.Title level={5}`
- Card `title` prop 直接传字符串，不包裹字体类
- 卡片内部再分组默认 `Typography.Text strong`
- 描述、提示、注释默认 `Typography.Text type="secondary"`
- 胶囊、徽标、局部元信息若不用 `Typography`，可在原生节点上用 `text-text-secondary`
- 不要优先生成 `text-sm font-medium text-gray-500` 这类游离文本样式
- 弹层（`Modal` / `Drawer`）的 `title` prop 直接传字符串，不嵌套 `Typography.Title`

## 禁止项

- 不要把 Tailwind 字号工具当成主排版系统
- 不要用 Tailwind 在 wrapper 内重造页面标题、内容标题、卡片标题
- 不要使用 `text-secondary` 这类模糊或不存在的别名
- 禁止 `font-medium`（500）；需要强调时用 `Typography.Text strong` 或 `font-semibold`
- 禁止 `font-bold`（700）；标题和强调统一 600
- 不要让卡片标题与页面标题接近
- 不要把正文、辅助说明、元信息拆成三四档灰度文本
- 不要用 AI 强调色写正文小字
- 不要为了强调，把普通说明直接升级成 `Title`
- 不要在 `Modal` / `Drawer` 的 `title` prop 内嵌套 `Typography.Title`（组件已内建标题样式）
- 不要在 Card `title` prop 的 JSX 内添加 `font-medium` / `font-semibold` 等字重覆盖
