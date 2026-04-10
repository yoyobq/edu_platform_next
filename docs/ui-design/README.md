<!-- docs/ui-design/README.md -->

# UI Design Tokens

项目视觉设计基准。定义颜色、排版、圆角、间距、阴影、深色模式等规范。

## 设计性格

edu 侧后台，师生用户。品牌色来源于 Logo（深蓝 + 天蓝 + 红点）。

- **专业但不冷峻**：不是金融极简风，也不是消费应用的活泼感
- **亲切但不娱乐化**：圆角适度，色彩有辨识度但不刺激
- **AI 属性明确**：Sky Cyan 作为 AI 专属强调色，与主操作色分层

## 审美补充

完整品牌调性判断见 [brand/brand-tone.md](./brand/brand-tone.md)。以下为速查摘要：

- **克制但不空**：一屏只保留一个主记忆点，最多一主一辅
- **规整但不僵**：设计感来自对齐、比例、留白，不来自额外装饰
- **先结构后装饰**：标题、分组、间距已清楚时，装饰继续减法
- **装饰退半步**：图标、强调色、水印不抢正文和主要任务的注意力

## 前提

- CSS 配置基于 **Tailwind v4**（`@theme inline` 语法），项目已使用 `tailwindcss ^4.2.2`
- 本目录是 [ui-stack-rules.md](../ui-stack-rules.md) 的设计层补充——后者管"谁负责哪个元素"，本目录管"长什么样"
- [layout.md](../layout.md) 管页面骨架结构，本目录管骨架内部的视觉语言

## 文件索引

| 文件                                                       | 内容                                                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [colors.md](./colors.md)                                   | 品牌色、ConfigProvider token、Sky Cyan 决策与约束                                                              |
| [typography.md](./typography.md)                           | 页面标题、内容标题、卡片标题、正文与辅助说明的文本角色规则；工作台 vs 公共入口两套页面上下文；Sidecar 密度例外 |
| [spacing.md](./spacing.md)                                 | 页面、区块、卡片、表单、弹层、空状态的边距节奏规则                                                             |
| [ux-guidelines.md](./ux-guidelines.md)                     | 交互容器选择建议 + 正式规则（确认边界、AI 状态模型、公共入口布局）+ 项目已落地模式参考与反向速查               |
| [tokens.md](./tokens.md)                                   | 圆角、间距、阴影、动画、状态、滚动条、焦点环、图标、层级                                                       |
| [brand/](./brand/README.md)                                | 品牌目录入口：调性判断、资产使用边界、资产工程维护                                                             |
| [brand/brand-tone.md](./brand/brand-tone.md)               | 品牌定位、核心气质、AI 层与品牌层、声量分配、评审速查                                                          |
| [brand/logo.md](./brand/logo.md)                           | Logo 当前状态、允许 / 禁止位置、尺寸、深色模式、弱露出规则                                                     |
| [brand/app-icons.md](./brand/app-icons.md)                 | 浏览器 / 桌面入口图标的当前资产清单、待补充项、质量检查                                                        |
| [brand/ui-icons.md](./brand/ui-icons.md)                   | UI 功能图标来源、尺寸三档、颜色、交互状态、密度、可访问性                                                      |
| [brand/asset-engineering.md](./brand/asset-engineering.md) | 品牌资产目录角色、命名约定、格式要求、Code Review 检查点                                                       |
| [dark-mode.md](./dark-mode.md)                             | 深色模式策略、自动/手动处理项、实现方案                                                                        |
| [index-css.md](./index-css.md)                             | `index.css` 完整补全 CSS（单一源头，拷贝即用）                                                                 |
| [ai-rules.md](./ai-rules.md)                               | AI 生成代码的视觉约束 + 工程保障                                                                               |
| [interaction-feedback.md](./interaction-feedback.md)       | 交互反馈规则：hover、active、焦点环、过渡动画、视觉分隔策略                                                    |
| [inspirations/README.md](./inspirations/README.md)         | 精致感落地指南：Vercel/Linear/Raycast/Claude/Notion/Stripe 六参考的可操作落地模式（A1–G1）                     |

## 排障

- token 定义了但没生效 → 排查 ConfigProvider 是否包住了目标组件，再查 CSS 变量是否透出
- 组件颜色不一致 → 确认 ConfigProvider 包住了整个应用（`main.tsx` 或顶层 Provider）
