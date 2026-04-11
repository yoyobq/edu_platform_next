<!-- docs/ui-design/ai-rules.md -->

# AI 生成代码的视觉约束

## 颜色

- 不写魔法值，消费 CSS 变量或 Tailwind 语义类（`text-text-secondary`、`text-link`、`bg-ai-accent-bg`、`bg-fill-hover` 等）
- AI 元素 hover 态用 `--color-ai-accent-hover` / `--color-ai-accent-bg-hover`，不自己加深颜色
- `--color-ai-accent`（Claude Coral `#CC6B46`）对比度约 3.9:1，禁止用于正文文字，只允许用于图标、边框、背景填充、大号标签
- hover 背景统一 `bg-fill-hover`，不用 `bg-gray-*`
- **禁止** Tailwind `dark:` 前缀类——暗色模式 100% 依赖 antd Token 自动翻转。`dark:` 只在 `index.css` 全局层级（如 `shadow-card-hover` 深色变体）使用，组件代码中不得出现

补充：

- 正式文本角色优先走 `Typography`，不要为了用 Tailwind 文本类而回退成原生标题和正文
- Tailwind 文本类只用于 pure wrapper、原生 HTML 和局部元信息，不用于 `antd` 组件本体

## 圆角

- wrapper 用 `rounded-block` / `rounded-card` / `rounded-surface` / `rounded-badge`，不用 `rounded-lg` 硬写

## 阴影

- wrapper 用 `shadow-card` / `shadow-card-hover` / `shadow-surface`，不用 `shadow-*` 固定值
- `shadow-card-hover` 是唯一允许的 box-shadow 硬编码例外，不得扩展

## 间距

- 只用约定档位：`p-3` / `p-4` / `p-6`、`gap-1` / `gap-2` / `gap-4` / `gap-6`
- `gap-3` 仅允许行内紧凑对齐，禁止用于区块级主间距
- 行内微元素（badge、pill、keyboard hint，计算高度 ≤ 28px）允许 `py-1 px-2`、`py-0.5 px-1.5`、`px-3 py-1`（详见 [spacing.md](./spacing.md) 5a）
- 紧凑操作列表（命令面板、Dropdown 菜单项）允许 `py-2`（详见 [spacing.md](./spacing.md) 5b）

## 动画

- 两档：`transition-colors duration-150`（hover）或 `transition-all duration-200`（面板）

## 响应式

- **禁止** `sm:`、`md:`、`lg:`、`xl:` 等 Tailwind 断点前缀——项目未提供移动端设计稿，所有断点类无据可依
- 需要响应式适配时，通过 JS 感知容器宽度后**条件渲染**不同组件或布局（参见 `app-layout.tsx` 的 `mainWidthBand` 方案）

## 层级 (Z-index)

- 禁止使用 `z-10`、`z-50` 等 Tailwind 内置数字类，只用语义类：`z-main-base` / `z-top-control-bar` / `z-sidecar-container` / `z-sidecar-overlay` / `z-cross-layer-prompt`
- antd 组件层级通过 ConfigProvider `zIndexPopupBase` 控制，不修改 `--z-index-*` 变量

## 宽度

- 阅读型内容区加 `max-w-content-readable`；表格/看板不加

## 组件

- antd 组件本体的视觉问题回 ConfigProvider token 解决，不堆 Tailwind 类修补
- 图标统一 `@ant-design/icons`（详细规则见 [brand/ui-icons.md](./brand/ui-icons.md)）
- Avatar 不叠加 Tailwind `rounded-*`
- **禁止**在 `Typography.Text` / `Typography.Title` / `Typography.Paragraph` 上叠加 Tailwind 文本类（`text-xs`、`font-semibold` 等）。如需紧凑标签文字，用原生 `<span>` + Tailwind 代替
- **内联 style 唯一例外**：公共入口页 `<h1 style={{...}}>` 消费 CSS 变量的语义覆盖（需要 `<h1>` 语义且 Typography.Title 输出 `<h3>`）。其他任何场景严禁通过内联 style 修改 antd 组件样式

## 模式叠加

复合场景允许且应该组合多个模式。例如"AI 历史记录卡片"= A2（可交互卡片）+ B1（列表行密度）+ F2（AI 区域标识）。规则：

- 外层容器走高层级模式，内层走低层级
- 阴影冲突时取层级更高的 token
- 判断场景 → 查模式表 → 组合 → 检查 `ui-stack-rules.md`

**模式使用上限**：

- 一个页面默认不超过 2–3 个主模式；超出说明页面职责过重，应先拆分页面结构
- 一个容器默认只承担一个主要视觉职责
- 若一个区域同时需要卡片、列表、AI 标识、高光、空状态等多种模式，应先拆分结构再逐层套模式
- 模式冲突时，优先保留层级清晰的模式，删除装饰性增强

## 交互反馈

- 所有可点击区域必须有可感知的 hover 反馈。卡片优先使用阴影抬升（antd `<Card hoverable>` 或自定义 `hover:shadow-card-hover`）；列表行优先使用背景变化（`hover:bg-fill-hover`）；文字链接可使用颜色或下划线变化
- 列表行、图标按钮等非卡片可交互区域：`transition-colors duration-150 hover:bg-fill-hover`
- 自定义按钮 active 态：`active:scale-[0.97] transition-all duration-150`
- 视觉分隔优先级：间距 > 背景色差 > 极细分隔线（`border-b border-border`），同区域 border 不超过 1–2 层

## 空状态与占位

- 空状态必须包含：图标（32px, `--ant-color-text-quaternary`）+ 标题（`Typography.Text strong`）+ 说明 + 操作按钮
- 骨架屏形状应对应最终内容结构，不用通用矩形
- **骨架防跳动**：`width` / `rows` 应尽量匹配预期内容区域的大致比例，避免骨架消失后布局跳动；同一列表的多个骨架行应有轻微长度差异（如 `60%` / `70%` / `50%`）而非统一占比
- AI 生成三态（Thinking / Streaming / Complete）不与普通 HTTP loading 混用
- `placeholder` 应描述可输入内容或引导行为（如 `搜索课程、作业或学生…`），不用 `请输入关键词`

---

## Token 封口

不因局部页面临时新增视觉 token。若某个模式无法由现有 token 支撑，应先回到既有 token 体系（`tokens.md`、`index.css` `@theme inline`）中重组，而非发明新变量。已识别待补的 token 仅 `--color-ai-accent-border` 一条（详见 [inspirations/README.md](./inspirations/README.md) "建议配套新增"节）。

---

## 工程保障

### Stylelint：禁止魔法色值

配置 `color-no-hex` 规则禁止组件代码中出现十六进制色值。`src/index.css` 排除于该规则之外（合法色值声明处）。

```js
{
  "rules": {
    "color-no-hex": [true, {
      "message": "请使用 CSS 变量（var(--color-*)）而非魔法色值。唯一例外是 index.css 的 @theme inline 块。"
    }]
  }
}
```

### ESLint：className 约束

"不在 antd 组件本体上用 Tailwind 类"暂不引入自动检查——没有现成规则、自定义 AST 插件成本过高。通过 Code Review 和本约束列表维持。
