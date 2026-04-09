---
description: Describe when these instructions should be loaded
paths:
  - 'src/**/*.{ts,tsx,js,jsx,md,css}'
---

<!-- Tip: Use /create-instructions in chat to generate content with agent assistance -->

目录分三类：`src/app|pages|widgets|features|entities|shared` = 正式区（stable），`src/labs/*` = 受控实验区，`src/sandbox/*` = dev-only 原型区
正式区默认按 app / pages / widgets / features / entities / shared 组织
正式区不得依赖 sandbox；labs / sandbox 不得反向污染正式区私有实现
唯一已确认例外：app/router 可读取 labs 与 sandbox 的公开入口做路由注册
路由用 React Router Data Mode，不用 Framework Mode
main 必须独立可用；AI 只是增强层
Sidecar 挂在 `<Outlet />` 外，路由切换默认不重置
不做传统“顶栏 + 常驻左栏 + footer”后台壳
antd 负责正式业务组件
antdX 负责 AI 协作组件
tailwindcss 只负责布局与 wrapper
硬规则：Tailwind 不进入 antd / antdX 组件本体
主题语义统一走 antd token / CSS 变量，禁止魔法值
当前优先 E2E，入口是 npm run test:e2e
一个元素只能有一个“样式主人”
跨模块导入只走公开 API
z-index 只能走语义化 token，不能手写裸数字
git commit 用中文，带 body
