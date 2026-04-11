<!-- docs/ui-design/tokens.md -->

# 视觉 Token：圆角、间距、排版、阴影、动画、状态

## 圆角

两套并行，互不干扰：

| 控制层              | Token               | 作用范围                         |
| ------------------- | ------------------- | -------------------------------- |
| antd ConfigProvider | `borderRadius` 系列 | 组件本体（按钮、输入框、卡片等） |
| CSS 变量 + Tailwind | `--radius-*` 系列   | wrapper 层区块和面板             |

### Tailwind wrapper 圆角

| Token              | 值   | 场景               | Tailwind 类       |
| ------------------ | ---- | ------------------ | ----------------- |
| `--radius-block`   | 10px | 主区块、Section 壳 | `rounded-block`   |
| `--radius-card`    | 10px | wrapper 卡片壳     | `rounded-card`    |
| `--radius-surface` | 16px | Sidecar、浮动面板  | `rounded-surface` |
| `--radius-badge`   | 6px  | 标签、角标         | `rounded-badge`   |

不要写 `rounded-lg` 这类固定值。wrapper 比组件本体稍圆（10 > 8）形成自然层叠；`--radius-surface` 更大（16）强调 AI 区与主内容的隔离。

---

## 间距

间距节奏与结构级用法已独立收敛到 [spacing.md](./spacing.md)。

这里仅保留 token 档位本身：

基准 4px 网格，约定有效档位：

| 语义           | 值   | Tailwind 类 |
| -------------- | ---- | ----------- |
| 区块标准内边距 | 16px | `p-4`       |
| 区块宽松内边距 | 24px | `p-6`       |
| 紧凑内边距     | 12px | `p-3`       |
| 行内间距       | 8px  | `gap-2`     |
| 条目纵向间距   | 16px | `gap-4`     |
| 区块纵向间距   | 24px | `gap-6`     |
| 极小间距       | 4px  | `gap-1`     |

**禁止**：`p-5`（20px）、`p-7`（28px）。

**`gap-3`（12px）**：禁止用于区块级主间距；允许用于行内紧凑对齐（`[图标]+[文字]+[操作]` 同行，`gap-2` 偏紧 `gap-4` 偏松时）。

---

## 排版

文本层级、标题角色与页面文本组合方式，统一收敛到 [typography.md](./typography.md)。

这里仅保留两条与 token 相关的排版结论：

- antd 默认 `fontSize: 14` 与默认行高继续沿用，不单独发明一套字号 token
- 裸 `<a>` 由 `index.css` 的 `@layer base` 统一：默认 `colorLink`，hover 加下划线 + `colorLinkHover`

---

## 阴影

| 场景            | Tailwind 类         | 来源                         |
| --------------- | ------------------- | ---------------------------- |
| wrapper 卡片壳  | `shadow-card`       | `--ant-box-shadow-tertiary`  |
| 卡片 hover 抬升 | `shadow-card-hover` | 硬编码例外（项目内唯一）     |
| Sidecar 面板    | `shadow-surface`    | `--ant-box-shadow-secondary` |
| 浮层/弹层       | —                   | antd 组件自带                |

主内容区优先用轻阴影而非纯边框划分区域。

---

## AI 区域边框

| Token                      | 值                                                         | Tailwind 类               | 场景            |
| -------------------------- | ---------------------------------------------------------- | ------------------------- | --------------- |
| `--color-ai-accent-border` | `color-mix(in srgb, #cc6b46 25%, var(--ant-color-border))` | `border-ai-accent-border` | AI 区域装饰边框 |

此 token 用于 Sidecar 外壳、AI 生成区块等需要轻微 Claude Coral 色调边框的场景。深色模式下 `--ant-color-border` 自动跟随 `darkAlgorithm`，混合结果自动适配。

补充说明：此 token 尚未在 `index.css` 中定义，需追加到 `@theme inline` 块。参见 [index-css.md](./index-css.md)。

**Token 封口规则**：不因局部页面临时新增视觉 token。若某个模式无法由现有 token 支撑，应先回到既有 token 体系中重组，而非发明新变量。已识别待补的 token 仅 `--color-ai-accent-border` 一条。

---

## 过渡动画

两档，仅用于 Tailwind wrapper 层（antd 组件有内置动画，不叠加）：

| 场景               | Tailwind 类                      |
| ------------------ | -------------------------------- |
| hover 色变、小尺寸 | `transition-colors duration-150` |
| 面板显隐、尺寸过渡 | `transition-all duration-200`    |

禁止 `duration-500` 及以上。

---

## 状态一致性

| 状态       | 做法                 | 禁止                          |
| ---------- | -------------------- | ----------------------------- |
| hover 背景 | `bg-fill-hover`      | 自定义颜色、`opacity-*`       |
| disabled   | 组件 `disabled` prop | `opacity-50`、`text-gray-400` |
| 空状态     | antd `<Empty>`       | 每页各写灰字说明              |
| 骨架       | antd `<Skeleton>`    | Spinner 和 Skeleton 混用      |

骨架防跳动：`Skeleton` 的 `width` / `rows` 应尽量匹配预期内容区域的大致比例（如卡片骨架 `title={{ width: '40%' }} paragraph={{ rows: 3 }}`），避免骨架消失后布局跳动。同一列表的多个骨架行应有轻微长度差异（`60%` / `70%` / `50%`）而非统一占比。
| 操作加载 | `<Button loading>` / `<Spin>` | 手工切换文字 |

### 可交互卡片 hover 默认实践

所有作为导航入口或可点击行为的卡片都应有 hover 反馈：

- antd `<Card>` 组件：使用 `hoverable` prop（hover 阴影由 antd token `boxShadowCard` 控制，符合 ui-stack-rules "组件视觉走组件 API"原则）
- 自定义 wrapper：`shadow-card cursor-pointer transition-all duration-200 hover:shadow-card-hover`
- 列表行、图标按钮等非卡片可交互区域：`transition-colors duration-150 hover:bg-fill-hover`

无 hover 反馈的可交互元素是质感缺失的第一大来源。完整反馈规则见 [interaction-feedback.md](./interaction-feedback.md)，落地代码片段见 [inspirations/README.md](./inspirations/README.md) A2、B1、C2。

---

## 滚动条

`@layer base` 统一，颜色消费 antd token（深色自动适配），宽度 6px。

---

## 焦点环

`@layer base` 中 `:focus-visible` 统一，键盘用户专用。antd CSS-in-JS 优先级高于 `@layer base`，组件本体 focus 样式不受影响——`@layer base` 只作用于裸 HTML 元素（`<a>`、未封装的 `<button>` 等）。无需 `!important`。

---

## 图标与 Avatar

- 图标统一 `@ant-design/icons`；尺寸、颜色、可访问性与语义规则见 [brand/ui-icons.md](./brand/ui-icons.md)
- Avatar 圆形（用户）/ 方形（课程 `shape="square"`），不叠加 Tailwind `rounded-*`
- 空头像：`<Avatar icon={<UserOutlined />} />` 或 `<Avatar>{name[0]}</Avatar>`

---

## 层级 (Z-index)

z-index 只能走语义化 token，禁止手写裸数字（包括 Tailwind 内置的 `z-10`、`z-50` 等数字类）。

| Token                          | 值   | 场景                         | Tailwind 类            |
| ------------------------------ | ---- | ---------------------------- | ---------------------- |
| `--z-index-main-base`          | 0    | 主内容区基准层               | `z-main-base`          |
| `--z-index-top-control-bar`    | 900  | 顶部全局浮层按钟（开始按钟） | `z-top-control-bar`    |
| `--z-index-main-modal`         | 1000 | 与 antd Modal 默认对齐       | `z-main-modal`         |
| `--z-index-sidecar-container`  | 1100 | AI Sidecar 面板容器          | `z-sidecar-container`  |
| `--z-index-sidecar-overlay`    | 1150 | Sidecar 遮罩层               | `z-sidecar-overlay`    |
| `--z-index-cross-layer-prompt` | 2000 | 跨层浮层提示（最高层）       | `z-cross-layer-prompt` |

**antd 组件层级**由 ConfigProvider `zIndexPopupBase`（默认 1000）统一管理，与上表变量独立。自定义 Sidecar 面板通过 `readZIndexToken('--z-index-sidecar-container', 1100)` 动态读取该 token 传给 antd Drawer 的 `zIndex` prop。
