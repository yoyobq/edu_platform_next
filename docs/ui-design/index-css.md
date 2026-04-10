<!-- docs/ui-design/index-css.md -->

# index.css 补全参考

`src/index.css` 的完整参考。此文件是单一源头——其他文档引用此处，不重复定义值；若 `src/index.css` 增补了新片段，这里也必须同步更新。

```css
@import 'tailwindcss';

/* Tailwind v4：dark: 变体绑定到 .dark class，支持手动切换（默认是 prefers-color-scheme） */
@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-primary: var(--ant-color-primary);
  --color-text: var(--ant-color-text);
  --color-text-secondary: var(--ant-color-text-secondary);
  --color-border: var(--ant-color-border);
  --color-bg-layout: var(--ant-color-bg-layout);
  --color-bg-container: var(--ant-color-bg-container);
  --color-warning-bg: var(--ant-color-warning-bg);
  --color-warning-border: var(--ant-color-warning-border);
  --color-error-bg: var(--ant-color-error-bg);
  --color-error-border: var(--ant-color-error-border);
  --color-success: var(--ant-color-success);
  --color-success-bg: var(--ant-color-success-bg);
  --color-success-border: var(--ant-color-success-border);
  --color-info: var(--ant-color-info);
  --color-info-bg: var(--ant-color-info-bg);
  --color-info-border: var(--ant-color-info-border);
  --color-fill-secondary: var(--ant-color-fill-secondary);
  --color-fill-tertiary: var(--ant-color-fill-tertiary);
  --color-bg-mask: var(--ant-color-bg-mask);
  --radius-lg: var(--ant-border-radius-lg);
  --shadow-popover: var(--ant-box-shadow-secondary);

  /* 链接色（回退值防止 antd 注入前短暂空白） */
  --color-link: var(--ant-color-link, #1255cc);
  --color-link-hover: var(--ant-color-link-hover, #1040a8);
  --color-link-active: var(--ant-color-link-active, #0d3285);

  /* AI 强调色（独立变量，不走 antd token） */
  /* color-mix 基线：Chrome 111+ / Firefox 113+ / Safari 16.2+，与 Tailwind v4 一致；white 为注入前回退 */
  --color-ai-accent: #29b8f0;
  --color-ai-accent-hover: #1fa8e0;
  --color-ai-accent-bg: color-mix(in srgb, #29b8f0 12%, var(--ant-color-bg-container, white));
  --color-ai-accent-bg-hover: color-mix(in srgb, #29b8f0 18%, var(--ant-color-bg-container, white));
  --color-ai-accent-border: color-mix(in srgb, #29b8f0 25%, var(--ant-color-border));

  /* 语义圆角（wrapper 层） */
  --radius-block: 10px;
  --radius-card: 10px;
  --radius-surface: 16px;
  --radius-badge: 6px;

  /* 阴影（wrapper 层消费） */
  --shadow-card: var(--ant-box-shadow-tertiary);
  --shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.08); /* 唯一硬编码例外；深色下 .dark 覆盖 */
  --shadow-surface: var(--ant-box-shadow-secondary);

  /* 内容区阅读宽度（表单、详情、设置页；表格/看板不适用） */
  --width-content-readable: 1200px;

  /* Hover 填充 */
  --color-fill-hover: var(--ant-color-fill-secondary);

  /* Layout Z-Index Tokens (Semantic Layer Tokens) */
  --z-index-main-base: 0;
  --z-index-top-control-bar: 900;
  --z-index-main-modal: 1000;
  --z-index-sidecar-container: 1100;
  --z-index-sidecar-overlay: 1150;
  --z-index-cross-layer-prompt: 2000;
}

[data-layout-surface='sidecar'] {
  --sidecar-root-gap: 16px;
  --sidecar-stack-gap: 16px;
  --sidecar-panel-padding: 16px;
  --sidecar-card-padding-block: 8px;
  --sidecar-card-padding-inline: 12px;
  --sidecar-message-max-width: 85%;
  --sidecar-surface-radius: 16px;
}

[data-layout-surface='sidecar'][data-sidecar-density='compact'] {
  --sidecar-root-gap: 12px;
  --sidecar-stack-gap: 12px;
  --sidecar-panel-padding: 12px;
  --sidecar-card-padding-inline: 10px;
  --sidecar-message-max-width: 100%;
  --sidecar-surface-radius: 14px;
}

[data-layout-surface='sidecar'] .sidecar-root-stack {
  gap: var(--sidecar-root-gap);
}

[data-layout-surface='sidecar'] .sidecar-scroll-stack {
  gap: var(--sidecar-stack-gap);
}

[data-layout-surface='sidecar'] .sidecar-message-shell {
  max-width: var(--sidecar-message-max-width);
}

[data-layout-surface='sidecar'] .sidecar-input-shell {
  border-radius: var(--sidecar-surface-radius);
  padding: var(--sidecar-panel-padding);
}

[data-layout-surface='sidecar'] .sidecar-entry-card .ant-card-body {
  padding: var(--sidecar-card-padding-block) var(--sidecar-card-padding-inline);
}

[data-layout-layer='global-overlay-root'] {
  inset: 0;
  pointer-events: none;
  position: fixed;
  z-index: var(--z-index-sidecar-overlay);
}

[data-layout-layer='global-overlay-root'] [data-overlay-mount='cross-region-visual'] {
  height: 100%;
  position: relative;
  width: 100%;
}

[data-layout-layer='third-workspace-root'] {
  inset: 0;
  pointer-events: none;
  position: fixed;
  visibility: hidden;
  z-index: var(--z-index-sidecar-container);
}

[data-layout-layer='third-workspace-root'][data-workspace-state='open'] {
  pointer-events: auto;
  visibility: visible;
}

[data-layout-layer='third-workspace-root'] [data-workspace-mount='artifacts-canvas'] {
  height: 100%;
  margin-left: auto;
  max-width: min(72vw, 1200px);
  position: relative;
  width: 100%;
}

html.disable-motion *,
html.disable-motion *::before,
html.disable-motion *::after {
  animation-delay: 0s !important;
  animation-duration: 0s !important;
  scroll-behavior: auto !important;
  transition-delay: 0s !important;
  transition-duration: 0s !important;
}

@layer base {
  a:not([class]) {
    color: var(--ant-color-link);
  }
  a:not([class]):hover {
    color: var(--ant-color-link-hover);
    text-decoration: underline;
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--ant-color-border);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--ant-color-text-quaternary);
  }

  /* 键盘用户专用（鼠标点击不触发）；antd CSS-in-JS 优先级高于 @layer base，组件本体 focus 不受影响 */
  :focus-visible {
    outline: 2px solid var(--ant-color-primary-border);
    outline-offset: 2px;
  }
  :focus:not(:focus-visible) {
    outline: none;
  }
}

/* 深色模式：仅覆盖无法由 antd darkAlgorithm 自动跟随的变量 */
.dark {
  --shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.4);
}
```
