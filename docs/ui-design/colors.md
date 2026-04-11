<!-- docs/ui-design/colors.md -->

# 颜色系统

## 决定权

颜色语义的唯一决定源是 `antd` ConfigProvider `token`。Tailwind 通过 `index.css` 的 `@theme inline` 消费 `--ant-*` 变量，不重新发明颜色语义。魔法色值只允许出现在 ConfigProvider token 声明处和 `index.css` 的 `@theme inline` 块中。

## 品牌三原色

| 角色                   | 落地方式                                   | 值        | Logo 来源   |
| ---------------------- | ------------------------------------------ | --------- | ----------- |
| 主色 Deep Blue         | ConfigProvider `colorPrimary`              | `#1255CC` | C形/a形主体 |
| AI 强调色 Claude Coral | CSS 变量 `--color-ai-accent`（不进 token） | `#CC6B46` | —           |
| 警示色 Signal Red      | ConfigProvider `colorError`                | `#D93025` | i 顶部红点  |

## 使用占比与声量

完整品牌颜色声量判断见 [brand/brand-tone.md](./brand/brand-tone.md)。技术摘要：

- Deep Blue → 主交互色：按钮、链接、焦点、少量关键操作，不大面积涂抹
- Claude Coral → AI 提示性存在：边框、图标色、浅背景，不铺满界面
- Signal Red → 仅错误 / 风险 / 阻断，不参与品牌氛围
- 多种强调色同屏高频 → 先减颜色种类，不补中间色

## ConfigProvider token

```tsx
import { theme as antTheme } from 'antd'

<ConfigProvider
  theme={{
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary:  '#1255CC',
      colorError:    '#D93025',
      colorLink:     '#1255CC',
      // 浅色模式自定义背景；深色模式交还给 darkAlgorithm
      ...(!isDark && {
        colorBgLayout:    '#F4F6FA',
        colorBgContainer: '#FFFFFF',
      }),
      borderRadius:   8,
      borderRadiusLG: 12,
      borderRadiusSM: 4,
    },
  }}
>
```

`isDark` 的来源和管理见 [dark-mode.md](./dark-mode.md)。

浅色模式布局底色 `#F4F6FA` 是轻微蓝调的灰，与 Deep Blue 同色温，为前景白色容器提供足够对比。深色模式由 `darkAlgorithm` 自行决定背景，不覆盖。

## Claude Coral 为什么不进 ConfigProvider

最直觉的方案是设为 `colorInfo`，但 `Alert type="info"`、`Tag color="processing"`、`Message.info()` 都会被染成珊瑚橙——这些场景与 AI 无关。

**决策**：Claude Coral 作为独立 CSS 变量存在，只在 AI 交互区消费。`colorInfo` 保持 antd 默认。antdX 组件内部保持深蓝系，Claude Coral 出现在 Sidecar wrapper 层和自定义装饰元素上——"深蓝主交互 + 暖橙外壳装饰"是有意的双层结构。

逃生口（当前不采用）：在 Sidecar 外层嵌套 `<ConfigProvider theme={{ token: { colorPrimary: '#CC6B46' } }}>`。不采用的理由：两处维护色值。

## Claude Coral 对比度

`#CC6B46` 在白底对比度约 3.9:1，在 `#F4F6FA` 上约 3.6:1，低于 WCAG AA 小字标准（4.5:1）。

**`--color-ai-accent` 禁止用于正文文字**，只允许：

- 图标颜色
- 边框、装饰线（`--color-ai-accent-border`：Claude Coral 25% 混入 `--ant-color-border`，用于 AI 区域轻色调边框）
- 背景填充（`--color-ai-accent-bg`）
- 大号标题或标签文字（≥ 18px，且不是唯一信息载体）

AI 区域的小号说明文字用 `colorText` / `colorTextSecondary`。

## antd 主色偏深的影响

`#1255CC` 比 antd 默认 `#1677ff` 更深，生成的色板整体偏沉稳，符合 edu 后台"专业"定位。关键前提：**ConfigProvider 必须包住整个应用**，否则会出现"部分组件默认蓝、部分组件自定义蓝"的混色。
