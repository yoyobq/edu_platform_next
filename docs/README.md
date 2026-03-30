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
- 想跨模块引用、调整 import、判断依赖是否合法时，先看 [dependency-rules.md](./dependency-rules.md)
- 想明确 `app/` 壳层、主内容区与 AI sidecar 的布局原则时，先看 [layout.md](./layout.md)
- 想参考更激进的 AI-native layout 想法、给生成或设计探索提供输入时，再看 [layout-ideas.md](./layout-ideas.md)
- 想明确 `antd`、`antdX` 和 `tailwindcss` 的职责分工时，先看 [ui-stack-rules.md](./ui-stack-rules.md)
- 想新增或修改 `labs` 功能时，先看 [labs-rules.md](./labs-rules.md)
- 想新增或修改 `sandbox` 原型时，先看 [sandbox-rules.md](./sandbox-rules.md)
- 想统一表单值、URL search params、筛选条件的空值与 normalize 语义时，先看 [project-convention/form-input-normalization.md](./project-convention/form-input-normalization.md)
- 想明确“事件时间 / 业务日期 / 业务日期时间”的展示与存储语义时，先看 [project-convention/time-display-semantics.md](./project-convention/time-display-semantics.md)
- 想按测试目标区分 `core` 和 `smoke` E2E，或想跑单文件时，先看 [project-convention/e2e-test-groups.md](./project-convention/e2e-test-groups.md)
- 想了解测试约定、Playwright E2E 入口或 `env` 配置时，先看 [testing.md](./testing.md)
- 想判断 AI 生成结果该先落哪层、何时能进入 `stable` 时，先看 [ai-workflow.md](./ai-workflow.md)
- 想了解当前仍未完全定稿的事项、已知限制或背景决策时，再看 [open-decisions.md](./open-decisions.md)

## Rule Docs

- [rule-precedence.md](./rule-precedence.md)
- [layer-model.md](./layer-model.md)
- [layout.md](./layout.md)
- [ui-stack-rules.md](./ui-stack-rules.md)
- [dependency-rules.md](./dependency-rules.md)
- [labs-rules.md](./labs-rules.md)
- [sandbox-rules.md](./sandbox-rules.md)
- [testing.md](./testing.md)
- [ai-workflow.md](./ai-workflow.md)
- [open-decisions.md](./open-decisions.md)

## Reference Docs

- [layout-ideas.md](./layout-ideas.md)

## Project Convention Docs

- [project-convention/form-input-normalization.md](./project-convention/form-input-normalization.md)
- [project-convention/time-display-semantics.md](./project-convention/time-display-semantics.md)
- [project-convention/e2e-test-groups.md](./project-convention/e2e-test-groups.md)

## Notes

- 日常读取时，优先按任务直接使用拆分文档
- 多份文档同时适用但边界不清晰时，优先按 [rule-precedence.md](./rule-precedence.md) 裁决
- `app / pages / widgets / features / entities / shared` 的细分职责当前见 [layer-model.md](./layer-model.md)
- [open-decisions.md](./open-decisions.md) 只记录真正的开放项、已知限制与关键背景决策

## Structure

```txt
docs/
  README.md
  ai-workflow.md
  dependency-rules.md
  layout.md
  layout-ideas.md
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
    time-display-semantics.md
  human/
    frontend-rules-v0.5.md
```
