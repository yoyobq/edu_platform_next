<!-- docs/ui-design/index-css.md -->

# index.css 补全参考

`src/index.css` 需要追加的完整 CSS。此文件是单一源头——其他文档引用此处，不重复定义值。

```css
/* Tailwind v4：dark: 变体绑定到 .dark class */
@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  /* 链接色（回退值防止 antd 注入前短暂空白） */
  --color-link: var(--ant-color-link, #1255cc);
  --color-link-hover: var(--ant-color-link-hover, #1040a8);
  --color-link-active: var(--ant-color-link-active, #0d3285);

  /* AI 强调色（独立变量，不走 antd token） */
  /* color-mix 基线：Chrome 111+ / Firefox 113+ / Safari 16.2+，与 Tailwind v4 目标浏览器一致；white 作为 antd 注入前的回退值 */
  --color-ai-accent: #29b8f0;
  --color-ai-accent-hover: #1fa8e0;
  --color-ai-accent-bg: color-mix(in srgb, #29b8f0 12%, var(--ant-color-bg-container, white));
  --color-ai-accent-bg-hover: color-mix(in srgb, #29b8f0 18%, var(--ant-color-bg-container, white));

  /* 语义圆角 */
  --radius-block: 10px;
  --radius-card: 10px;
  --radius-surface: 16px;
  --radius-badge: 6px;

  /* 阴影 */
  --shadow-card: var(--ant-box-shadow-tertiary);
  --shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.08); /* 唯一硬编码例外 */
  --shadow-surface: var(--ant-box-shadow-secondary);

  /* 内容区阅读宽度（表单、详情、设置页；表格/看板不适用） */
  --width-content-readable: 1200px;

  /* Hover 填充 */
  --color-fill-hover: var(--ant-color-fill-secondary);

  /* 层级（禁止手写裸数字；antd 弹层由 ConfigProvider zIndexPopupBase 管理，与此独立） */
  --z-index-base: 0;
  --z-index-sidecar: 100; /* AI Sidecar 面板 */
  --z-index-omni-bar: 200; /* 全局 AI 唤起命令栏 */
  --z-index-modal: 1000; /* 与 antd zIndexPopupBase 默认值对齐，仅供参考 */
  --z-index-tooltip: 1030; /* 自定义 tooltip */
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

  :focus-visible {
    outline: 2px solid var(--ant-color-primary-border);
    outline-offset: 2px;
  }
  :focus:not(:focus-visible) {
    outline: none;
  }
}

/* 深色模式覆盖 */
.dark {
  --shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.4);
}
```
