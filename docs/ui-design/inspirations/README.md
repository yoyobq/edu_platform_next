# UI Inspirations — 界面质感落地指南

本文件是项目界面质感与完成度的单一落地指南。它关注的不是"做漂亮"，而是：**层级清晰、交互完整、留白克制、token 一致、AI 区有分层、高光页有限跳脱**。

它吸收了 Vercel、Linear、Raycast、Claude、Notion、Stripe 六个外部参考中值得迁移的具体方法，将所有可操作结论收敛在此文件内。阅读本文件后**无需再查阅独立的参考对象文档**。

它不是设计规范的替代品——项目的 token 体系（`tokens.md`）、间距规则（`spacing.md`）、排版规则（`typography.md`）、品牌调性（`brand-tone.md`）、组件分工（`ui-stack-rules.md`）仍然是各自领域的决策源。本文件只负责回答：**在那些规范之上，还需要做什么才能让页面达到应有的完成度。**

## 与主规范的优先级

当本文件与项目正式规范冲突时，始终以正式规范为准（优先级从高到低）：

1. `ui-stack-rules.md`
2. `layout.md`
3. `ui-design/` 下的正式规则文档（`tokens.md`、`spacing.md`、`typography.md`、`colors.md`、`brand-tone.md`）
4. 本文件

本文件末尾"微调既有规则"一节中的调整例外——它们是经过验证的、对特定规则的有限修正。

---

## 质感落差诊断

页面"完成度不足"几乎总来自以下几类具体缺失。先对照清单定位病因，再到下方"落地模式"一节找对应写法。

### 1. 交互状态缺失

- 可点击卡片没有 hover 阴影抬升，与静态区域无法区分
- 列表行没有 hover 背景变化
- 焦点环不可见或使用浏览器默认轮廓

→ 落地模式 A2、B1、C1

### 2. 加载与空状态质量低

- 加载状态用通用 Spinner，而不是与内容结构对应的骨架屏
- 空状态只有"暂无数据"文字，没有图标和引导操作
- AI 生成态与普通 HTTP loading 无法区分

→ 落地模式 D1、D2、F1

### 3. 层级与阴影失真

- 卡片 wrapper 使用硬编码 `shadow-md` 而非项目 token `shadow-card`
- 多层容器阴影深度相同，看不出前后关系
- 弹层阴影比背景卡片还轻

→ 落地模式 A1、A2、A4

### 4. 间距节奏断裂

- 区块内部和区块之间的间距相同，分不出层级
- 混用了非约定档位（`p-5`、`gap-5`）
- 卡片内标题与内容之间没有足够呼吸感

→ 落地模式 A1、E1

### 5. 文字层级不清晰

- 标题与正文字重/尺寸差异不足
- 辅助说明灰度不够，主次模糊
- 多个标题大小接近

→ 落地模式 E1、E2

### 6. 颜色声量混乱

- 状态色同屏密度过高
- Deep Blue 被大面积平铺做背景
- Sky Cyan 出现在与 AI 无关的区域

→ 落地模式 B3、F2

### 7. 高光页面与普通页面质感相同

- 引导页、成功页与普通表单页视觉质量无差异

→ 落地模式 G1

---

## 按场景查表

| 场景                       | 对应模式                 |
| -------------------------- | ------------------------ |
| 普通卡片、表单区           | A1 静态卡片              |
| 可点击卡片、功能入口       | A2 可交互卡片            |
| 高密度列表、数据表格       | B1 列表行 + B2 表格      |
| AI 交互区、Sidecar         | F1 AI 三态 + F2 区域标识 |
| 公共入口页（登录、注册）   | A1 + E2 公共入口标题     |
| 空状态、引导页、成功反馈页 | D2 空状态 + G1 高光页    |
| 富文本阅读区               | E3 阅读区                |
| 命令面板、快捷操作弹窗     | B4 紧凑操作列表          |

**模式叠加**：复合场景允许且应该组合多个模式。例如"AI 历史记录卡片"= A2（可交互卡片）+ B1（列表行密度）+ F2（AI 区域标识）。外层容器走高层级模式，内层走低层级。阴影冲突时取层级更高的 token。

**模式使用上限**：

- 一个页面默认不超过 2–3 个主模式；超出说明页面职责过重，应先拆分页面结构
- 一个容器默认只承担一个主要视觉职责（卡片就是卡片，列表就是列表）
- 若一个区域同时需要卡片、列表、AI 标识、高光、空状态等多种模式，应先拆分结构再逐层套模式，而非在一个容器上堆叠
- 模式冲突时，优先保留层级清晰的模式，删除装饰性增强

---

## 落地模式

以下每个模式都包含可直接使用的 className 组合或 JSX 片段。所有 token 均已在 `index.css` 中定义，无需新增变量（除本文末尾"建议配套新增"中标注的情况）。

### A. 容器与卡片

#### A1. 静态内容卡片

信息展示，不可点击。来源：Vercel 轻阴影分区。

wrapper 写法：

```
rounded-card bg-bg-container p-4 shadow-card
```

阅读型场景（文档详情、设置面板）用 `p-6` 替代 `p-4`（来源：Notion 呼吸感）。

标杆：`src/features/api-health-status/ui/api-health-status-panel.tsx` — `rounded-card bg-bg-container p-6 shadow-card`。

#### A2. 可交互卡片

点击即跳转或触发操作。来源：Vercel hover 层级变化。

antd Card：

```tsx
<Card hoverable>
```

`hoverable` 是 antd API，hover 阴影由 antd token `boxShadowCard` 控制，符合 ui-stack-rules"组件视觉走组件 API"原则。

自定义 wrapper：

```
rounded-card bg-bg-container p-4 shadow-card cursor-pointer
transition-all duration-200 hover:shadow-card-hover
```

**新增实践**：所有作为导航入口的卡片必须有可感知的 hover 反馈。卡片优先使用阴影抬升；文字链接可使用颜色或下划线变化。已修复：HomePage 的 HomeModuleCard 已补齐 `hoverable`。

#### A3. 信息网格条目

卡片内部的统计/信息格子，不独立可交互。来源：Linear 高密度层级节奏。

```
rounded-block border border-border bg-bg-layout px-4 py-3
```

已落地：`src/pages/home/index.tsx` summary items。

#### A4. AI 区浮动面板

Sidecar、AI 结果面板。来源：Raycast AI/主内容隔离。

```
rounded-surface bg-bg-container shadow-surface
```

`rounded-surface`（16px）比普通 `rounded-card`（10px）更大，视觉上强调 AI 区与主内容区的隔离层级。

---

### B. 列表与表格

#### B1. 可点击列表行

来源：Linear 列表行交互。

```
px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-fill-hover
```

规则：

- 不额外加边框或色块来表示 hover，只靠背景色变化
- 行与行之间的分隔用极细分隔线（`border-b border-border`）或纯间距，不用双重边框
- 选中行：加 `bg-fill-hover` 作为常驻背景

#### B2. 数据表格

antd Table 有内置 hover 行样式。额外提升点：

- 表头与数据行之间视觉层级：表头保持默认灰底，数据行白底
- 操作列按钮使用 `type="link" size="small"`，不用独立 Button
- 状态列优先用色点（B3）或 antd Tag，不用大面积色块

已落地：`src/features/admin-user-list/` — Table + 骨架屏首屏。

#### B2.5 视觉分隔策略

来源：Vercel/Linear 极度克制的分隔手法。

**选择优先级（由高到低）**：

| 优先级 | 手法       | 适用场景   | 示例                                         |
| ------ | ---------- | ---------- | -------------------------------------------- |
| 1      | 间距       | 逻辑块之间 | `gap-6`（块间）/ `gap-2`（组内）             |
| 2      | 背景色差   | 嵌套容器   | 外层 `bg-bg-layout` + 内层 `bg-bg-container` |
| 3      | 极细分隔线 | 同质列表行 | `border-b border-border`（1px）              |

规则：

- 同一个视觉区域内最多出现 **1–2 层** border。超出说明层级设计有问题，应回退到间距或背景色差。
- `<Divider />` 仅用于语义性分段（例如表单分组标题之间），不要用于纯视觉间距。
- header / sider 的分隔用 `border-b border-border`，不要用 box-shadow 或 `rgba()` 硬编码值。

#### B3. 状态色点

高密度列表中，用小圆点代替大面积色块。来源：Linear 状态标识。

```tsx
<span
  className="inline-block h-2 w-2 rounded-full"
  style={{ backgroundColor: 'var(--ant-color-success)' }}
/>
```

根据状态替换颜色变量：`--ant-color-success`、`--ant-color-warning`、`--ant-color-error`、`--ant-color-text-quaternary`（灰色/未知）。

规则：同屏状态色种类不超过 3 种。超出时先检查是否需要合并状态类别。

#### B4. 紧凑操作列表（命令面板场景）

来源：Raycast 选中态。

```
px-3 py-2 cursor-pointer rounded-badge
transition-colors duration-150 hover:bg-fill-hover
```

选中态（键盘导航当前项）：`bg-fill-hover rounded-badge`，无硬边框，靠背景色区分。

注意：`py-2`（8px）属于本文"微调既有规则 #2"中定义的紧凑操作项例外，见文末。

---

### C. 交互反馈

#### C1. 焦点环

已在 `index.css` `@layer base` 中统一：

```css
:focus-visible {
  outline: 2px solid var(--ant-color-primary-border);
  outline-offset: 2px;
}
```

该规则仅作用于裸 HTML 元素（`<a>`、未封装的 `<button>`），antd 组件有内置 focus 样式，两者不冲突。来源：Linear 焦点态。

**不要做**：给 antd 组件再覆盖一层 focus 样式。

#### C2. 通用 hover 背景

所有非按钮的可交互区域（卡片、行、图标按钮区域）统一使用：

```
transition-colors duration-150 hover:bg-fill-hover
```

来源：Linear / Vercel 通用交互层。

`bg-fill-hover` 消费 `--ant-color-fill-secondary`，深色模式自动适配。

**不要做**：用 `hover:bg-gray-100`、`hover:opacity-80` 等脱离 token 的写法。

#### C3. 按钮 active 态

antd Button 内置 active 态（色深变化）。如果自定义了纯图标按钮或工具栏按钮，补 active 态：

```
active:scale-[0.97] transition-all duration-150
```

`scale-[0.97]` 是 3% 缩放，微妙但可感知。来源：Vercel 按钮反馈。

---

### D. 加载与空状态

#### D1. 骨架屏占位

**核心原则**：骨架屏的形状应对应最终内容结构，不用通用矩形。来源：Raycast 结构化骨架屏。

卡片骨架：

```tsx
<Card>
  <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 3 }} />
</Card>
```

列表骨架：

```tsx
{
  Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="flex items-center gap-4 px-4 py-3">
      <Skeleton.Avatar active size="small" />
      <Skeleton active title={false} paragraph={{ rows: 1, width: ['60%'] }} />
    </div>
  ));
}
```

已落地标杆：`src/pages/home/index.tsx` — 3 个假 Card + Skeleton rows=4。

**不要做**：

- 用 `<Spin>` 覆盖有结构的内容区（`<Spin>` 只用于无法预测结构的场景，如首次路由加载）
- Skeleton 和 Spin 混用在同一视图

**防跳动**：骨架屏的 `width` / `rows` 应尽量匹配预期内容区域的大致比例，避免骨架消失后布局明显跳动。同一列表的多个骨架行应有轻微长度差异（如 `60%` / `70%` / `50%`）而非统一占比，以营造"内容即将到来"的预期感。

#### D2. 结构化空状态

空状态必须包含：图标 + 标题 + 说明 + 操作入口。来源：Stripe 空状态引导，Notion 无压力感。

```tsx
<Flex vertical align="center" gap={16} className="py-12">
  <InboxOutlined style={{ fontSize: 32, color: 'var(--ant-color-text-quaternary)' }} />
  <Typography.Text strong>尚无可显示的内容</Typography.Text>
  <Typography.Text type="secondary" style={{ maxWidth: 360, textAlign: 'center' }}>
    简要说明为什么为空，以及用户可以做什么来改变这个状态。
  </Typography.Text>
  <Button type="primary">主操作</Button>
</Flex>
```

规则：

- 图标用 `@ant-design/icons`，尺寸 32px，颜色 `--ant-color-text-quaternary`（最弱灰度）
- 标题用 `Typography.Text strong`，不用 `Title`——空状态不是页面主层级
- 说明用 `secondary`，限 `maxWidth: 360` 防止过宽
- 操作按钮必须存在——不能只给用户看一个"无数据"然后让他自己猜下一步

**不要做**：只放一行灰字 `暂无数据`。

#### D3. 占位文本质量

来源：Notion 低压力引导式措辞。

占位文本（`placeholder`）应描述**可输入什么**或**引导用户下一步行为**，而非机械指令。

| 场景     | ✗ 不推荐       | ✓ 推荐                         |
| -------- | -------------- | ------------------------------ |
| 搜索框   | `请输入关键词` | `搜索课程、作业或学生…`        |
| 邮箱字段 | `请输入邮箱`   | `name@school.edu`              |
| 备注字段 | `请输入`       | `为什么拒绝这份作业？（可选）` |

规则：

- 给予具体信息，帮助用户理解可填内容的范围和格式
- 可选字段在 placeholder 末尾标注 `（可选）`
- 搜索框 placeholder 用省略号 `…` 暗示可输入更多

---

### E. 文字层级

#### E1. 间距建立层级

来源：Vercel 高对比度层级，Linear 高密度节奏。

标题与正文之间的灰度差和间距差是层级感的核心来源：

| 层级关系            | 间距    | 说明                                 |
| ------------------- | ------- | ------------------------------------ |
| 页面头 → 首个内容区 | `gap-6` | 页面最大间距，锁定主标题与内容的呼吸 |
| 内容区标题 → 卡片组 | `gap-4` | 内容区内部，标题引领后续组           |
| 卡片标题 → 卡片正文 | `gap-4` | 卡片内主节奏                         |
| 正文 → 辅助说明     | `gap-2` | 紧凑对，但仍有层次                   |
| 行内图标 → 行内文字 | `gap-2` | 行内间距                             |

**关键**：区块内部间距（`gap-4`）必须小于区块之间间距（`gap-6`），否则层级扁平。

#### E2. 公共入口页标题组合

来源：Vercel 公共页排版。

左栏说明区的标题组合：

```tsx
<Flex vertical gap={24}>
  <BrandLockup variant="public-entry" />
  <div>
    <h1
      style={{
        fontSize: 'var(--ant-font-size-heading-3)',
        fontWeight: 'var(--ant-font-weight-heading)',
        lineHeight: 'var(--ant-line-height-heading-3)',
        marginBottom: 12,
        marginTop: 8,
      }}
    >
      页面主标题
    </h1>
    <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 520 }}>
      简要说明当前页面的目的和上下文。
    </Typography.Paragraph>
  </div>
</Flex>
```

已落地：`src/pages/login/index.tsx`、`src/pages/forgot-password/index.tsx`。

**为什么用原生 `<h1>` + CSS 变量**：公共入口页无外层壳层，页面主标题需要 `<h1>` 语义，而 `Typography.Title level={3}` 渲染 `<h3>`。详见 `typography.md` "语义覆盖"节。

> **⚠ 注意**：此处使用原生 `<h1>` + 内联 `style` 消费 CSS 变量是唯一特例（公共入口页需要 `<h1>` 语义且 Typography.Title 输出 `<h3>`）。其他任何场景严禁模仿此写法通过内联 style 修改 antd 组件样式——应回到 ConfigProvider token 或 className 方案。

#### E3. 阅读区排版

来源：Claude 长文本舒适度，Notion 阅读呼吸感。

AI 响应、文档详情、Markdown 渲染区：

- 容器加 `max-w-content-readable`（1200px）限制行宽
- 段落间距用 `gap-4`（16px），而不是默认 `gap-2`
- 内边距用 `p-6` 而不是 `p-4`

规则：此建议仅适用于阅读型场景，表格/看板/管理页面不加 `max-w-content-readable`。

---

### F. AI 专属区

#### F1. AI 生成三态

来源：Raycast AI 状态管理。这三态绝不与普通 HTTP loading 混用。

| 态        | 视觉表现                                   | 持续时间            |
| --------- | ------------------------------------------ | ------------------- |
| Thinking  | 与最终内容结构对应的骨架屏 + shimmer 动画  | 请求发出 → 首 token |
| Streaming | 打字机逐字渲染 + 末尾闪烁光标              | 首 token → 完成     |
| Complete  | 内容稳定，骨架/光标消失，渲染完整 Markdown | 持久态              |

区分依据：

- 普通 HTTP loading → `<Skeleton>` 或 `<Spin>`，无打字机效果
- AI Streaming → 打字机 + 光标，与业务 loading 完全不同的视觉语言

#### F2. AI 区域标识

来源：Claude AI 区与主业务区隔离。

AI 交互区域必须在视觉上与主业务区分离。当前方案：

- Sidecar 外壳使用 `rounded-surface`（16px）+ `shadow-surface`，圆角和阴影层级均高于主区卡片
- AI 区的背景可用 `bg-ai-accent-bg`（12% Sky Cyan 混入 `--ant-color-bg-container`），在主容器白底上形成轻微色差
- AI 相关图标或装饰可用 `text-ai-accent`（即 `#29B8F0`），但禁止用于正文文字（对比度不足 4.5:1）

**Sky Cyan 使用边界**：

- 允许：图标色、边框装饰线、背景填充（`bg-ai-accent-bg`）、大号标签（≥ 18px 且非唯一信息载体）
- 禁止：正文文字、与 AI 无关的区域、大面积平铺

---

### G. 高光页面

#### G1. 有限跳脱规则

来源：Stripe 关键节点仪式感。

以下页面类型允许在项目基调内"往精致方向跳一步"，其他所有页面**不允许**：

| 页面类型                 | 允许的额外表现                                   | 必须保持的约束             |
| ------------------------ | ------------------------------------------------ | -------------------------- |
| Welcome / 注册完成页     | 轻量背景渐变（Deep Blue 色温方向）+ 一个主记忆点 | 不叠第二个记忆点，不堆图标 |
| 首页数据大盘（关键指标） | 关键数字大号展示 + 微妙配色背景                  | 仍走 Deep Blue 色温        |
| 操作成功确认（重大节点） | Checkmark 轻微 scale-up 动效                     | 动效不超过 300ms           |
| AI 区空状态              | Sky Cyan 色调说明图形 + 主动引导文案             | 只在 Sidecar/AI 区内       |

关键数字展示组合（来源：Stripe 指标展示）：

```tsx
<Flex vertical gap={4}>
  {/* 紧凑标签用原生 <span>——ui-stack-rules 不允许在 antd Typography 上叠加 Tailwind 文本类 */}
  <span className="text-xs text-text-secondary">活跃用户</span>
  <Statistic value={1128} valueStyle={{ fontSize: 28, fontWeight: 600 }} />
</Flex>
```

用 antd `<Statistic>` 而不是裸 `<Title>`——`Statistic` 自带数值格式化和动画能力。
标签用原生 `<span>` + Tailwind，而非 `<Typography.Text>` + Tailwind 文本类（违反 `ui-stack-rules`）。

---

## 微调既有规则

本节记录为对齐新落地模式而需要的有限规则调整。每条标注影响范围和理由。

### 1. 微元素间距例外

**影响范围**：`spacing.md` 中"只用 `p-3/4/6`"的规则。

**调整**：以下间距组合允许用于**行内微元素**（badge、pill、keyboard hint 等计算高度 ≤ 28px 的元素）：

| 允许            | 说明                          |
| --------------- | ----------------------------- |
| `py-1 px-2`     | 4px × 8px，适用于行内标签     |
| `py-0.5 px-1.5` | 2px × 6px，适用于键盘快捷提示 |
| `px-3 py-1`     | 6px × 4px，适用于胶囊徽章     |

所有值仍在 4px 网格上（`py-0.5` = 2px 是 4px 的半档，`px-1.5` = 6px 是 4px 的 1.5 倍）。

**理由**：项目代码中已在 header badge（`px-3 py-1`）、Alt+K 提示（`px-2 py-0.5`）等处使用这些值。强制转为 `p-3` 会让微元素过于膨胀。此例外**仅限行内微元素**，不可扩散到块级容器。

**已使用位置**：`src/app/layout/app-layout.tsx` header 中的环境/身份 badge。

### 2. 紧凑操作项间距

**影响范围**：`spacing.md` 中 `py-*` 只允许 3/4/6 的规则。

**调整**：命令面板、快捷操作列表、Dropdown 菜单项等紧凑操作场景，允许 `py-2`（8px）作为项目垂直内边距。

**理由**：`py-3`（12px）在这类密集操作列表中过于松散，与 Raycast/Linear 的紧凑操作列表相比效率感下降。`py-2` 在 4px 网格上，是 `gap-2`（8px）的等价档位——间距档位已经承认 8px 是有效值，padding 档位应保持一致。

### 3. 可交互卡片 hover 默认实践

**影响范围**：新增实践，不修改既有规则。

**调整**：所有作为导航入口或可点击行为的卡片都应有 hover 反馈：

- antd `<Card>` 组件：使用 `hoverable` prop
- 自定义 wrapper：`shadow-card transition-all duration-200 hover:shadow-card-hover`

**理由**：当前代码库审计显示，除 EntrySidecar 卡片和 nav-toggle 外，几乎没有自定义 hover 效果。这是"手感缺失"的第一大来源。antd 的 `hoverable` prop 是组件 API，完全符合 ui-stack-rules "组件视觉走组件 API"原则。

### 4. Layout 边框 token 化

**影响范围**：`src/app/layout/app-layout.tsx` 中的 header/sider 边框。

**调整**：~~`borderBottom: '1px solid rgba(15, 23, 42, 0.08)'`~~ 已替换为 `var(--ant-color-border-secondary)`，sider `borderRight` 同理。

**理由**：`rgba(15, 23, 42, 0.08)` 是魔法值，深色模式下不会自动适配。`--ant-color-border-secondary` 通过 `darkAlgorithm` 自动跟随。

**状态**：✅ 已落地。

---

## 建议配套新增

以下是落地模式中发现的、当前 `index.css` 尚未覆盖但值得补充的 token。追加到 `@theme inline` 块即可：

```css
/* AI 区域边框色（Sky Cyan 20% 混合） */
--color-ai-accent-border: color-mix(in srgb, #29b8f0 25%, var(--ant-color-border));
```

仅此一条。其他所有模式均可用现有 token 实现。

**封口规则**：除本节列出的 token 外，不因局部页面临时新增视觉 token。若某个模式无法由现有 token 支撑，应先回到既有 token 体系中重组，而非发明新变量。

---

## 质感自检清单

发布任何页面或组件前，逐项确认。

**交互层**

- [ ] 所有可点击区域必须有可感知的 hover 态。卡片优先使用阴影或背景层级变化；列表行优先使用背景变化；文字链接可使用颜色或下划线变化
- [ ] Tab 键导航时存在可见焦点环
- [ ] 异步操作（按钮提交、表单发送）有明确 loading 态（`<Button loading>` 或 `<Spin>`）

**加载与空状态层**

- [ ] 页面/区块首次加载使用结构对应的骨架屏，不使用覆盖式 Spinner
- [ ] 空状态包含：图标（32px, quaternary 色）+ 标题 + 说明 + 操作按钮
- [ ] AI 生成态与普通 HTTP loading 有不同的视觉语言

**视觉层级层**

- [ ] 阴影只使用 `shadow-card` / `shadow-card-hover` / `shadow-surface`，无硬编码值
- [ ] 圆角只使用 `rounded-block` / `rounded-card` / `rounded-surface` / `rounded-badge`，无 `rounded-lg` 等固定值
- [ ] 颜色只走 CSS 变量（`bg-fill-hover`、`text-text-secondary`、`bg-ai-accent-bg`），无 hex 魔法值
- [ ] 页面只有一个主标题（视觉最高层级），卡片标题不与页面标题竞争
- [ ] 主文本（`colorText`）与辅助说明（`colorTextSecondary`）有明显灰度差，中间不插第三档
- [ ] 同屏状态色种类不超过 3 种

**间距层**

- [ ] 间距只使用约定档位（`gap-1/2/4/6`、`p-3/4/6`），微元素例外见"微调既有规则"
- [ ] 区块内部间距（`gap-4`）< 区块之间间距（`gap-6`），层级体现在间距里
- [ ] 容器内边距：标准 `p-4`，阅读型 `p-6`，紧凑 `p-3`

**AI 区专项**

- [ ] Sky Cyan 只出现在 AI 交互区（图标、装饰边框、浅背景），不出现在普通业务组件
- [ ] AI 区域用 `rounded-surface` + `shadow-surface`，层级高于主区卡片
- [ ] `--color-ai-accent` 未用于正文文字

---

## 明确排除的方向

| 风格                                            | 排除原因                                      |
| ----------------------------------------------- | --------------------------------------------- |
| 传统企业后台（早期 IBM Carbon、Element UI）     | 阴影笨重、边框过多，与现代克制感方向相反      |
| 过度活泼（Duolingo、Figma 营销页）              | 过大圆角、高饱和色彩，与专业工具定位不符      |
| 新拟态（Neumorphism）                           | 对比度极差，高频使用时视觉疲劳                |
| 全屏情绪氛围（大面积渐变替代主内容区）          | 牺牲信息可读性，与任务驱动型产品冲突          |
| 全聊天式布局                                    | AI 是辅助层，不是主工作台结构                 |
| 纯黑白极客极简（Vercel 原版色温）               | 本项目有 Deep Blue 品牌色温，不转入无色彩美学 |
| macOS 原生效果大量移植（Raycast backdrop-blur） | Web 端性能隐患，毛玻璃限于极少数高光页        |

---

## 给 AI 的使用约束

生成代码时，以下规则优先级高于任何外部参考描述。

**执行流程**：

1. 判断场景类型（查"按场景查表"）
2. 找到对应的落地模式，直接使用给出的 className 或 JSX
3. 检查是否符合 `ui-stack-rules.md`：Tailwind 只进 wrapper，不进 antd/antdX 组件本体

**硬性约束**：

- 阴影：`shadow-card` / `shadow-card-hover` / `shadow-surface`，不写 `box-shadow` 硬编码
- 圆角：`rounded-block` / `rounded-card` / `rounded-surface` / `rounded-badge`，不写 `rounded-lg`
- 颜色：消费 CSS 变量语义类（`text-text-secondary`、`bg-fill-hover`、`bg-ai-accent-bg`），不写 hex
- 间距：`p-3/4/6`、`gap-1/2/4/6`，微元素例外见"微调既有规则"
- `--color-ai-accent`：禁止用于正文文字
- hover 背景统一 `bg-fill-hover`，不用 `bg-gray-*` 或 `opacity-*`
- 动画只用两档：hover `transition-colors duration-150`，面板 `transition-all duration-200`
- 响应式断点：不使用 `sm:`、`md:`、`lg:`、`xl:` 等 Tailwind 断点前缀——项目未提供移动端设计稿，所有断点类无据可依。需要响应式时，通过 JS 感知宽度后条件渲染不同组件或布局
- antdX 组件不出现在非 AI 场景

**禁止**：

- 根据外部风格覆盖 Tailwind 配置、antd Token 或 brand 规则
- 大面积渐变、多色品牌语法、超过 300ms 的复杂动效（高光页除外）
- 把 Tailwind 类直接打到 antd / antdX 组件本体上
- 在组件代码中使用 Tailwind `dark:` 前缀类——暗色模式 100% 依赖 antd Token 自动翻转，`dark:` 只在 `index.css` 的全局层级（如 `shadow-card-hover` 深色变体）使用
- 用裸 `<h1>` ~ `<h6>` 手搓标题层级替代 `Typography.Title`（公共入口页语义覆盖除外）
