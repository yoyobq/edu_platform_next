<!-- docs/ui-design/README.md -->

# UI Design Tokens

项目视觉设计基准。定义颜色、排版、圆角、间距、阴影、深色模式等规范。

## 设计性格

edu 侧后台，师生用户。品牌色来源于 Logo（深蓝 + 天蓝 + 红点）。

- **专业但不冷峻**：不是金融极简风，也不是消费应用的活泼感
- **亲切但不娱乐化**：圆角适度，色彩有辨识度但不刺激
- **AI 属性明确**：Sky Cyan 作为 AI 专属强调色，与主操作色分层

## 前提

- CSS 配置基于 **Tailwind v4**（`@theme inline` 语法），项目已使用 `tailwindcss ^4.2.2`
- 本目录是 [ui-stack-rules.md](../ui-stack-rules.md) 的设计层补充——后者管"谁负责哪个元素"，本目录管"长什么样"
- [layout.md](../layout.md) 管页面骨架结构，本目录管骨架内部的视觉语言

## 文件索引

| 文件                                   | 内容                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| [colors.md](./colors.md)               | 品牌色、ConfigProvider token、Sky Cyan 决策与约束          |
| [typography.md](./typography.md)       | 页面标题、内容标题、卡片标题、正文与辅助说明的文本角色规则 |
| [ux-guidelines.md](./ux-guidelines.md) | 交互形态选择建议、弹窗/抽屉/页面使用场景与反向速查         |
| [tokens.md](./tokens.md)               | 圆角、间距、阴影、动画、状态、滚动条、焦点环、图标、层级   |
| [dark-mode.md](./dark-mode.md)         | 深色模式策略、自动/手动处理项、实现方案                    |
| [index-css.md](./index-css.md)         | `index.css` 完整补全 CSS（单一源头，拷贝即用）             |
| [ai-rules.md](./ai-rules.md)           | AI 生成代码的视觉约束 + 工程保障                           |

## 排障

- token 定义了但没生效 → 排查 ConfigProvider 是否包住了目标组件，再查 CSS 变量是否透出
- 组件颜色不一致 → 确认 ConfigProvider 包住了整个应用（`main.tsx` 或顶层 Provider）
