<!-- docs/ui-design/brand/ui-icons.md -->

# UI Icons

UI Icon 指产品内部用于导航、操作、状态和提示的功能图标。

## 来源

- 统一使用 `@ant-design/icons`
- 不引入第二套常驻功能图标库
- Logo 与浏览器 / app 图标不进入业务交互控件

## 尺寸

默认只保留三档：

- 文本同行小图标：`1em`
- 按钮 `icon`：跟随 antd Button 默认尺寸
- icon-only 按钮：仍使用 antd Button，不裸放图标

约束：

- 不单独发明一套 icon 尺寸系统
- 需要更强视觉体量时，优先升容器层级，不优先无节制放大 icon

## 颜色

- 默认继承当前语义颜色，不手写魔法值
- AI 区可用 `--color-ai-accent` 表达 AI 专属语义，但不扩散成通用功能色
- 小号功能图标必须保证可见性，不为了品牌感强行降对比

## 可访问性

- 只有图标、没有可见文本的按钮，必须提供 `aria-label`
- 含义不直观时，建议补 `title` 或 `Tooltip`
- 纯装饰图标应 `aria-hidden`

## 语义

- 导航、操作、状态、提示四类语义优先复用稳定图标
- 不要把状态 icon 和操作 icon 混用
- 状态反馈优先使用 antd 内建组件语义，再决定是否补额外 icon
