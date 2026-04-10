<!-- docs/ui-design/dark-mode.md -->

# 深色模式

## 工作量

远低于预期。绝大多数 CSS 变量消费 `--ant-*`，antd `darkAlgorithm` 切换后自动更新。需要手动处理的只有三处。

## 自动适配（无需改动）

- 所有 antd / antdX 组件
- `--color-link`、`--color-fill-hover`、`--shadow-card`、`--shadow-surface`（消费 `--ant-*`）
- `--color-ai-accent-bg` 系列（混合基已改为 `var(--ant-color-bg-container)`，深色下自动混入深色背景）
- 滚动条颜色（消费 `--ant-color-border` 等）

## 需要手动处理的三处

### ① 背景色 token 条件传入

`colorBgLayout: '#F4F6FA'` / `colorBgContainer: '#FFFFFF'` 是浅色专属。深色模式下交还给 `darkAlgorithm`，ConfigProvider 条件展开：

```tsx
...(!isDark && {
  colorBgLayout:    '#F4F6FA',
  colorBgContainer: '#FFFFFF',
}),
```

完整 ConfigProvider 配置见 [colors.md](./colors.md)。

### ② shadow-card-hover 深色变体

浅色的 `rgba(0,0,0,0.08)` 在深色背景不可见。通过 `.dark` 覆盖：

```css
.dark {
  --shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.4);
}
```

### ③ Tailwind dark: 变体绑定到 class

Tailwind v4 默认 `dark:` 基于 `prefers-color-scheme`，无法响应手动切换。需要在 `index.css` 开头加：

```css
@custom-variant dark (&:where(.dark, .dark *));
```

## FOUC 防范

当前 `useEffect` 方案在 React 挂载完成前有一帧白屏（深色模式刷新时先渲染浅色，再切换）。在 `public/index.html` 的 `<head>` 最末尾加内联脚本，确保首帧就是正确底色：

```html
<script>
  if (localStorage.getItem('app-theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
</script>
```

React 侧的 `useEffect` 逻辑不需要改——它只负责后续切换和状态同步。

## 实现方案

**主题状态**（顶层 Provider 文件，与 ConfigProvider 同层）：

```tsx
const [isDark, setIsDark] = useState(() => localStorage.getItem('app-theme') === 'dark');

useEffect(() => {
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('app-theme', isDark ? 'dark' : 'light');
}, [isDark]);
```

通过 React Context 传递 `isDark` / `setIsDark`，不放业务状态管理。

**切换按钮**（顶部导航栏）：

```tsx
<Button
  type="text"
  icon={isDark ? <SunOutlined /> : <MoonOutlined />}
  onClick={() => setIsDark((v) => !v)}
/>
```

## 迁移路径

已有代码中 `colorBgLayout`/`colorBgContainer` 写死的，改为条件展开写法，其余不动。

---

## Tailwind `dark:` 前缀使用规则

`dark:` 前缀**仅限** `index.css` 全局层级使用（如 `shadow-card-hover` 深色变体的 `.dark {}` 覆盖）。

**组件代码中禁止出现 `dark:` 前缀类**。暗色模式下的颜色适配 100% 依赖 antd Token 自动翻转（`colorBgLayout`、`colorBgContainer`、`colorText` 等全部走 `darkAlgorithm`）。如果某个颜色在深色下效果不对，说明该 token 的浅色声明需要调整，而不是在组件层加 `dark:` 补丁。
