<!-- docs/ui-design/interaction-feedback.md -->

# 交互反馈

本文件定义项目中所有可交互元素的视觉反馈规则。目标：用户的每一次操作都应获得可感知的视觉回应，但回应方式必须克制、一致。

与 [tokens.md](./tokens.md) 的关系：tokens 定义值（`bg-fill-hover`、`shadow-card-hover`、`duration-150`），本文件定义**什么时候用、怎么组合**。

与 [inspirations/README.md](./inspirations/README.md) 的关系：inspirations 提供带 className 的落地代码片段，本文件提供判断规则。

## 核心原则

1. **每个可交互元素都必须有可感知的 hover 反馈**。无 hover 的可点击区域是质感缺失的第一大来源。
2. **反馈方式跟随元素角色**，不跟随元素外观。卡片优先使用阴影或背景层级变化；列表行优先使用背景变化；文字链接可使用颜色或下划线变化；按钮用 antd 内置态。
3. **antd 组件优先用组件 API**（如 `hoverable`），不叠加 Tailwind 交互类。
4. **动画只用两档**，不发明中间值。

## Hover 反馈

### 可交互卡片

作为导航入口或可点击行为的卡片，必须有 hover 阴影抬升：

| 实现方式       | 写法                                                                             | 说明                                   |
| -------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| antd Card      | `<Card hoverable>`                                                               | 阴影由 antd token `boxShadowCard` 控制 |
| 自定义 wrapper | `shadow-card cursor-pointer transition-all duration-200 hover:shadow-card-hover` | 消费项目 shadow token                  |

**禁止**：可点击卡片不加任何 hover 效果。

已修复：`src/pages/home/index.tsx` 的 HomeModuleCard 已补齐 `hoverable`。

### 列表行

可点击列表行使用背景色变化，不使用阴影：

```
px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-fill-hover
```

规则：

- 不额外加边框或色块来表示 hover，只靠背景色变化
- 选中行：加 `bg-fill-hover` 作为常驻背景
- antd Table 已有内置 hover 行样式，无需额外处理

### 图标按钮 / 工具栏按钮

非 antd Button 的自定义图标按钮区域：

```
transition-colors duration-150 hover:bg-fill-hover
```

### 通用规则

所有非按钮的可交互区域统一使用 `bg-fill-hover`（消费 `--ant-color-fill-secondary`），深色模式自动适配。

**禁止**：

- `hover:bg-gray-100` 等脱离 token 的写法
- `hover:opacity-80` 等透明度方案
- 自定义 hex 颜色做 hover 背景

## Active 态

antd Button 内置 active 态（色深变化），无需额外处理。

自定义纯图标按钮或工具栏按钮，补 active 反馈：

```
active:scale-[0.97] transition-all duration-150
```

`scale-[0.97]` 是 3% 缩放，微妙但可感知。不要用更大的缩放值。

## 焦点环

已在 `index.css` `@layer base` 中统一：

```css
:focus-visible {
  outline: 2px solid var(--ant-color-primary-border);
  outline-offset: 2px;
}
```

规则：

- 该规则仅作用于裸 HTML 元素（`<a>`、未封装的 `<button>`）
- antd 组件有内置 focus 样式，两者不冲突
- **禁止**给 antd 组件再覆盖一层 focus 样式

## 过渡动画

项目只使用两档动画，仅用于 Tailwind wrapper 层：

| 场景                     | Tailwind 类                      | 时长  |
| ------------------------ | -------------------------------- | ----- |
| hover 色变、小尺寸变化   | `transition-colors duration-150` | 150ms |
| 面板显隐、尺寸过渡、阴影 | `transition-all duration-200`    | 200ms |

规则：

- antd 组件有内置动画，不叠加 Tailwind 动画类
- **禁止** `duration-300` 及以上（高光页面操作成功 Checkmark 动效除外，上限 300ms）
- **禁止** `duration-500` 及以上，任何场景
- hover 场景用 `transition-colors`（更精准），面板/卡片阴影变化场景用 `transition-all`

## 视觉分隔

与 [spacing.md](./spacing.md) 视觉分隔策略一节保持一致。此处侧重交互反馈视角，间距节奏细节见 spacing.md。

区块之间的分隔方式按优先级选择（由高到低）：

| 优先级 | 手法       | 适用场景   | 示例                                         |
| ------ | ---------- | ---------- | -------------------------------------------- |
| 1      | 间距       | 逻辑块之间 | `gap-6`（块间）/ `gap-2`（组内）             |
| 2      | 背景色差   | 嵌套容器   | 外层 `bg-bg-layout` + 内层 `bg-bg-container` |
| 3      | 极细分隔线 | 同质列表行 | `border-b border-border`（1px）              |

规则：

- 同一个视觉区域内最多出现 **1–2 层** border，超出说明层级设计有问题
- `<Divider />` 仅用于语义性分段（如表单分组标题之间），不用于纯视觉间距
- header / sider 的分隔用 `border-b border-border`，不用 box-shadow 或 `rgba()` 硬编码值（详见 [inspirations/README.md](./inspirations/README.md) 微调既有规则 #4）

## 加载与状态反馈

加载反馈规则已在 [ux-guidelines.md](./ux-guidelines.md) 和 [tokens.md](./tokens.md) 中定义。此处仅补充交互反馈相关的要点：

- 异步操作按钮使用 `<Button loading>`，不手工切换文字
- 骨架屏形状应对应最终内容结构（卡片骨架用 Card + Skeleton，列表骨架用行结构 + Skeleton）
- **骨架防跳动**：`width` / `rows` 应尽量匹配预期内容区域的大致比例，避免骨架消失后布局跳动；同一列表的多个骨架行应有轻微长度差异（如 `60%` / `70%` / `50%`）而非统一占比
- `<Spin>` 只用于无法预测结构的场景（如首次路由加载），不覆盖有结构的内容区
- AI 生成三态（Thinking / Streaming / Complete）不与普通 HTTP loading 混用（详见 [ux-guidelines.md](./ux-guidelines.md)）

## 禁止项

- 不要让可点击区域没有 hover 反馈
- 不要用 `opacity` 做 hover 效果
- 不要用脱离 token 的颜色做 hover 背景
- 不要给 antd 组件叠加 Tailwind 动画类
- 不要使用超过 300ms 的动画（高光页面例外）
- 不要用 box-shadow 或 rgba 硬编码值做区域分隔
- 不要让 `<Spin>` 和 `<Skeleton>` 在同一视图混用
