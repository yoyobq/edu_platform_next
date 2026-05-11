# 课程类别视觉语义

适用范围：课表、教学日志、后续任何需要展示课程类别的前端页面。

## 类别映射

- `THEORY` 或 `1` -> `理论课`
- `PRACTICE` 或 `2` -> `实践课`
- `INTEGRATED` 或 `3` -> `一体化`

如果接口已经回中文值，也继续按相同中文语义处理，不再二次翻译成别的文案。

## 颜色约定

基础色：

- `理论课`：文字色 `--course-category-theory-color`，底色 `--course-category-theory-bg`
- `实践课`：文字色 `--course-category-practice-color`，底色 `--course-category-practice-bg`
- `一体化`：文字色 `--course-category-integrated-color`，底色 `--course-category-integrated-bg`

浅色模式当前值：

| 类别   | 文字色    | 完整底色  | 弱化底色                  |
| ------ | --------- | --------- | ------------------------- |
| 理论课 | `#1d4ed8` | `#dbeafe` | `rgb(219 234 254 / 0.62)` |
| 实践课 | `#0f766e` | `#ccfbf1` | `rgb(204 251 241 / 0.62)` |
| 一体化 | `#b45309` | `#ffedd5` | `rgb(255 237 213 / 0.64)` |

深色模式由 `src/index.css` 的 `.dark` 覆盖同名 token。弱化底色必须混入 `--ant-color-bg-container`，不得把浅色 pastel 直接半透明覆盖到深色表面。

## 使用规则

- 同一页面内，课程标题、类别徽标、课程卡片底色应使用同一类别语义，不允许标题和卡片属于不同颜色口径。
- 周课表与学期课表使用同一套类别颜色，不因数据来源不同而改色。
- 教学日志、筛选 chip、类别 tag 等低密度元素使用完整底色 `--course-category-*-bg`。
- 课表、首页周课表等高密度网格卡片使用弱化底色 `--course-category-*-bg-muted`。
- 若页面需要弱化卡片底色，应消费弱化 token，不得在组件内手写 `rgb(... / opacity)`。
- 未识别课程类别时，保留默认中性色，不伪造类别颜色。
- 同一业务切片内，课程类别判断应收束到共享 helper，避免页面展示逻辑与流程编排逻辑分别硬编码 `1` / `2` / `3` 后漂移。

## 当前落点

- My 教学日志：`src/features/academic-teaching-log/ui/academic-teaching-log-page-content.tsx`
  - 当前共享判断：`src/features/academic-teaching-log/application/course-category.ts`
- 周课表 / 学期课表：`src/features/academic-timetable/`
- 首页周课表：`src/pages/home/workbench-weekly-timetable-grid.css`
