<!-- docs/ui-design/brand/ui-icons.md -->

# UI Icons

产品内部导航、操作、状态和提示的功能图标规则。

## 来源

- 统一 `@ant-design/icons`，不引入第二套功能图标库
- Logo 与 App Icon 不进入业务交互控件
- 本地图标资产的工程维护见 [asset-engineering.md](./asset-engineering.md)

## 尺寸

三档，不额外发明：

| 场景               | 尺寸        | 说明         |
| ------------------ | ----------- | ------------ |
| 文本同行           | `1em`       | 继承当前字号 |
| Button `icon` prop | antd 默认   | 跟随按钮尺寸 |
| icon-only 按钮     | antd Button | 不裸放图标   |

约束：

- 需要更强视觉体量 → 升容器层级，不放大 icon
- 图标与文字同行 → `flex items-center` 对齐；**禁止** `mt-0.5`、`translate-y` 等魔数基线微调

## 颜色

- 默认继承语义颜色，不手写魔法值
- AI 区可用 `--color-ai-accent`，但不扩散为通用功能色
- 小号图标必须保证可见性，不为品牌感降对比

## 交互状态

- hover / active 保持克制：透明度、轻微色差或容器背景变化
- 图标在 Button / Dropdown / Tabs 等 antd 容器内 → 复用容器反馈，不叠第二套动画
- **禁止**弹跳、持续旋转、无意义缩放

## 密度

- 标题、状态、按钮已表达清楚 → 不额外补装饰 icon
- 一行已有 leading icon → 谨慎再加状态 / 跳转 / 装饰 icon
- 一个 surface 只保留一种主要装饰手法

## 可访问性

| 场景           | 要求                    |
| -------------- | ----------------------- |
| icon-only 按钮 | 必须 `aria-label`       |
| 含义不直观     | 补 `title` 或 `Tooltip` |
| 纯装饰         | `aria-hidden`           |

## 语义约束

- 导航、操作、状态、提示四类语义优先复用稳定图标
- 状态 icon 与操作 icon 不混用
- 状态反馈优先使用 antd 内建组件语义，再决定是否补额外 icon
