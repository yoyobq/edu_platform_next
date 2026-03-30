<!-- docs/ui-design/ai-rules.md -->

# AI 生成代码的视觉约束

## 颜色

- 不写魔法值，消费 CSS 变量或 Tailwind 语义类（`text-link`、`bg-ai-accent-bg`、`bg-fill-hover` 等）
- AI 元素 hover 态用 `--color-ai-accent-hover` / `--color-ai-accent-bg-hover`，不自己加深颜色
- `--color-ai-accent` 禁止用于正文文字（对比度不足），只允许用于图标、边框、背景填充、大号标签
- hover 背景统一 `bg-fill-hover`，不用 `bg-gray-*`

## 圆角

- wrapper 用 `rounded-block` / `rounded-card` / `rounded-surface` / `rounded-badge`，不用 `rounded-lg` 硬写

## 阴影

- wrapper 用 `shadow-card` / `shadow-card-hover` / `shadow-surface`，不用 `shadow-*` 固定值
- `shadow-card-hover` 是唯一允许的 box-shadow 硬编码例外，不得扩展

## 间距

- 只用约定档位：`p-3` / `p-4` / `p-6`、`gap-1` / `gap-2` / `gap-4` / `gap-6`
- `gap-3` 仅允许行内紧凑对齐，禁止用于区块级主间距

## 动画

- 两档：`transition-colors duration-150`（hover）或 `transition-all duration-200`（面板）

## 层级 (Z-index)

- 禁止使用 `z-10`、`z-50` 等 Tailwind 内置数字类，只用语义类：`z-base` / `z-sidecar` / `z-omni-bar` / `z-tooltip`
- antd 组件层级通过 ConfigProvider `zIndexPopupBase` 控制，不修改 `--z-index-*` 变量

## 宽度

- 阅读型内容区加 `max-w-content-readable`；表格/看板不加

## 组件

- antd 组件本体的视觉问题回 ConfigProvider token 解决，不堆 Tailwind 类修补
- 图标统一 `@ant-design/icons`
- Avatar 不叠加 Tailwind `rounded-*`

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
