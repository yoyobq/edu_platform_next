# Page Header

正式页面顶部优先使用 `src/shared/ui/decorated-page-header` 的 `DecoratedPageHeader`。

## 规则

- `title` 默认是页面主标题语义，输出 `h1`；视觉默认按常规页面头尺寸，不使用超大 H1。
- `description` 放页面级说明，只解释当前页面职责，不承载筛选状态或操作结果。
- `badge` 放眉标题行的轻量状态标识，不替代页面内 Alert 或业务状态卡片。
- 需要弱化默认标题时，才使用 `eyebrow`；首页这种特殊场景可让 `eyebrowAsHeading` 承担 `h1`。
- `titleLevel` 管视觉大小；`titleHeadingLevel` 管语义层级。不要把两者混在一起。
- `icon` 必须与菜单栏同一页面的 `iconKey` 对齐，来源保持 `@ant-design/icons`。
- `iconPlacement` 默认为 `title`；只有首页欢迎区或需要弱化主标题图标时，才放到 `eyebrow`。
- 需要非默认色系时使用组件显式字段，例如 `colorScheme="purple"`；渐变、曲线和 icon 必须一起切换。
- 普通业务页不要使用 AI 色。AI 色只进入明确 AI 场景。
- 背景装饰由公共组件统一提供；页面不要各自复制曲线、渐变或装饰 SVG。

## Aside

`aside` 只放页面级辅助信息或轻量动作，例如头像、静态标签、只读摘要。

不要把会改变下方主体数据视口的 stateful 控件放进 `aside`，例如：

- 选择学期
- 筛选教师
- 切换数据范围
- 会触发主体重新加载的主查询控件

这类控件应靠近它实际控制的内容区，例如放到对应 `Card` 的左上方或独立 toolbar。

## 已落地参考

- 首页：欢迎词是首页独有内容，`我的工作台` 保留弱化主标题。
- 学期课表：页面头使用菜单同款 `TableOutlined`。
- 学期校历：页面头使用菜单同款 `ScheduleOutlined`；学期选择放在校历 `Card` 左上方，不放 header `aside`。
