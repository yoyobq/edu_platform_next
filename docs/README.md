<!-- docs/README.md -->

# Docs

This directory contains project documentation.

## How To Use

- Root [README.md](../README.md) is the quick project overview
- This file is the docs index
- The split docs below are the current direct rule entry points by topic
- [frontend-rules-v0.5.md](./human/frontend-rules-v0.5.md) is the current long-form full version

## Quick Routing

- 规则看起来有重叠、边界有冲突、不确定该按哪份文档执行时，先看 [rule-precedence.md](./rule-precedence.md)
- 不确定组件、页面或模块该放哪层时，先看 [layer-model.md](./layer-model.md)
- 已确定在看 `stable` 第二维问题时，先看 [stable-clean/README.md](./stable-clean/README.md)
- 想判断 API、storage、URL 参数、SDK、mock 该放哪时，先看 [infrastructure-rules.md](./infrastructure-rules.md)
- 想跨模块引用、调整 import、判断依赖是否合法时，先看 [dependency-rules.md](./dependency-rules.md)
- 想明确 `app/` 壳层、主内容区与 AI sidecar 的布局原则时，先看 [layout.md](./layout.md)
- 想明确登录后默认首页、首页工作台模块准入与 workbench entry 边界时，先看 [workbench-entry-rules.md](./workbench-entry-rules.md)
- 想参考更激进的 AI-native layout 想法、给生成或设计探索提供输入时，再看 [layout-ideas.md](./layout-ideas.md)
- 想明确 `antd`、`antdX` 和 `tailwindcss` 的职责分工时，先看 [ui-stack-rules.md](./ui-stack-rules.md)
- 想确认颜色、圆角、间距、排版的视觉基准与 token 约定时，先看 [ui-design/README.md](./ui-design/README.md)
- 想明确间距档位在各结构层级的具体用法与节奏规则时，先看 [ui-design/spacing.md](./ui-design/spacing.md)
- 想快速判断什么时候该用页面、抽屉、弹窗、Popover、Popconfirm、Tooltip 等交互容器，或判断确认边界与反馈形式时，先看 [ui-design/ux-guidelines.md](./ui-design/ux-guidelines.md)
- 想新增或修改 `labs` 功能时，先看 [labs-rules.md](./labs-rules.md)
- 想新增或修改 `sandbox` 原型时，先看 [sandbox-rules.md](./sandbox-rules.md)
- 想统一表单值、URL search params、筛选条件的空值与 normalize 语义时，先看 [project-convention/form-input-normalization.md](./project-convention/form-input-normalization.md)
- 想统一业务入口 path、`redirect`、筛选 query 等 URL 语义时，先看 [project-convention/route-url-semantics.md](./project-convention/route-url-semantics.md)
- 想确认当前身份、授权摘要、会话恢复以及 protected route 前置续期边界时，先看 [project-convention/identity-access-session.md](./project-convention/identity-access-session.md)
- 想确认 `shared/graphql` 与 `auth` 的运行时边界、请求鉴权语义和为什么当前不做 shared auto-refresh 时，先看 [project-convention/graphql-ingress-auth-boundary.md](./project-convention/graphql-ingress-auth-boundary.md)
- 想确认 `executeGraphQL()` 的统一异常出口、`GraphQLIngressError` 分类、Apollo 4.x 映射和默认中文错误提示时，先看 [project-convention/graphql-error-model.md](./project-convention/graphql-error-model.md)
- 想明确“事件时间 / 业务日期 / 业务日期时间”的展示与存储语义时，先看 [project-convention/time-display-semantics.md](./project-convention/time-display-semantics.md)
- 想按测试目标区分 `core` 和 `smoke` E2E，或想跑单文件时，先看 [project-convention/e2e-test-groups.md](./project-convention/e2e-test-groups.md)
- 想了解测试约定、Playwright E2E 入口或 `env` 配置时，先看 [testing.md](./testing.md)
- 想判断 AI 生成结果该先落哪层、何时能进入 `stable` 时，先看 [ai-workflow.md](./ai-workflow.md)
- 想确认后端真相时，先看 [backend/README.md](./backend/README.md)：
  `schema.graphql` 看 GraphQL 类型与显式业务结果；
  `domain-error.ts` 和 `graphql-exception.filter.ts` 看运行时错误码与映射
- 想了解当前仍未完全定稿的事项、已知限制或背景决策时，再看 [open-decisions.md](./open-decisions.md)

## Rule Docs

- [rule-precedence.md](./rule-precedence.md)
- [layer-model.md](./layer-model.md)
- [stable-clean/README.md](./stable-clean/README.md)
- [infrastructure-rules.md](./infrastructure-rules.md)
- [layout.md](./layout.md)
- [workbench-entry-rules.md](./workbench-entry-rules.md)
- [chunk-strategy.md](./chunk-strategy.md)
- [ui-stack-rules.md](./ui-stack-rules.md)
- [ui-design/README.md](./ui-design/README.md)
- [dependency-rules.md](./dependency-rules.md)
- [labs-rules.md](./labs-rules.md)
- [sandbox-rules.md](./sandbox-rules.md)
- [testing.md](./testing.md)
- [ai-workflow.md](./ai-workflow.md)
- [open-decisions.md](./open-decisions.md)

## Reference Docs

- [layout-ideas.md](./layout-ideas.md)
- [backend/README.md](./backend/README.md)

## Plans

- [../plans/graphql-ingress-plan.md](../plans/graphql-ingress-plan.md)
- [../plans/graphql-error-model-plan.md](../plans/graphql-error-model-plan.md)
- [../plans/layout-todo.md](../plans/layout-todo.md)
- [../plans/identity-access-model-future.md](../plans/identity-access-model-future.md)
- [../plans/public-auth-flows-plan.md](../plans/public-auth-flows-plan.md)
- [../plans/public-auth-flows-now.md](../plans/public-auth-flows-now.md)
- [../plans/public-auth-flows-future.md](../plans/public-auth-flows-future.md)
- [../plans/welcome-profile-completion-plan.md](../plans/welcome-profile-completion-plan.md)
- [../plans/workbench-entry-plan.md](../plans/workbench-entry-plan.md)

## Project Convention Docs

- [project-convention/form-input-normalization.md](./project-convention/form-input-normalization.md)
- [project-convention/graphql-error-model.md](./project-convention/graphql-error-model.md)
- [project-convention/graphql-ingress-auth-boundary.md](./project-convention/graphql-ingress-auth-boundary.md)
- [project-convention/identity-access-session.md](./project-convention/identity-access-session.md)
- [project-convention/route-url-semantics.md](./project-convention/route-url-semantics.md)
- [project-convention/time-display-semantics.md](./project-convention/time-display-semantics.md)
- [project-convention/e2e-test-groups.md](./project-convention/e2e-test-groups.md)

## Notes

- 日常读取时，优先按任务直接使用拆分文档
- 多份文档同时适用但边界不清晰时，优先按 [rule-precedence.md](./rule-precedence.md) 裁决
- `app / pages / widgets / features / entities / shared` 的细分职责当前见 [layer-model.md](./layer-model.md)
- `stable` 区内部何时需要第二维 Clean 分层，当前见 [stable-clean/architecture.md](./stable-clean/architecture.md)
- API、storage、URL 参数、SDK、mock 的统一收束规则当前见 [infrastructure-rules.md](./infrastructure-rules.md)
- `docs/backend/` 是后端真相目录；默认先看 [backend/README.md](./backend/README.md)，再按需查具体文件片段
- `stable` 第二维主题当前按“先列清单，再记录具体决策”的方式推进
- `stable` 第二维的最小目录模板当前见 [stable-clean/templates.md](./stable-clean/templates.md)
- [open-decisions.md](./open-decisions.md) 只记录真正的开放项、已知限制与关键背景决策

## Structure

```txt
docs/
  README.md
  ai-workflow.md
  backend/
    README.md
  dependency-rules.md
  infrastructure-rules.md
  layout.md
  layout-ideas.md
  workbench-entry-rules.md
  stable-clean/
    README.md
    architecture.md
    checklist.md
    decisions.md
    templates.md
  ui-stack-rules.md
  labs-rules.md
  layer-model.md
  open-decisions.md
  rule-precedence.md
  sandbox-rules.md
  testing.md
  project-convention/
    e2e-test-groups.md
    form-input-normalization.md
    graphql-error-model.md
    graphql-ingress-auth-boundary.md
    identity-access-session.md
    route-url-semantics.md
    time-display-semantics.md
  human/
    frontend-rules-v0.5.md
```
