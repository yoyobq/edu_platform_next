# Docs

This directory contains project documentation.

## How To Use

- Root [README.md](../README.md) is the quick project overview
- This file is the docs index
- The split docs below are the current direct rule entry points by topic
- [frontend-rules-v0.5.md](./human/frontend-rules-v0.5.md) is the current long-form full version

## Quick Routing

- 不确定组件、页面或模块该放哪层时，先看 [layer-model.md](./layer-model.md)
- 想跨模块引用、调整 import、判断依赖是否合法时，先看 [dependency-rules.md](./dependency-rules.md)
- 想明确 `app/` 壳层、主内容区与 AI sidecar 的布局原则时，先看 [layout.md](./layout.md)
- 想参考更激进的 AI-native layout 想法、给生成或设计探索提供输入时，再看 [layout-ideas.md](./layout-ideas.md)
- 想新增或修改 `labs` 功能时，先看 [labs-rules.md](./labs-rules.md)
- 想新增或修改 `sandbox` 原型时，先看 [sandbox-rules.md](./sandbox-rules.md)
- 想了解测试约定、Playwright E2E 入口或 `env` 配置时，先看 [testing.md](./testing.md)
- 想判断 AI 生成结果该先落哪层、何时能进入 `stable` 时，先看 [ai-workflow.md](./ai-workflow.md)
- 想了解当前仍未完全定稿的事项、已知限制或背景决策时，再看 [open-decisions.md](./open-decisions.md)

## Rule Docs

- [layer-model.md](./layer-model.md)
- [layout.md](./layout.md)
- [dependency-rules.md](./dependency-rules.md)
- [labs-rules.md](./labs-rules.md)
- [sandbox-rules.md](./sandbox-rules.md)
- [testing.md](./testing.md)
- [ai-workflow.md](./ai-workflow.md)
- [open-decisions.md](./open-decisions.md)

## Reference Docs

- [layout-ideas.md](./layout-ideas.md)

## Notes

- 日常读取时，优先按任务直接使用拆分文档
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
  labs-rules.md
  layer-model.md
  open-decisions.md
  sandbox-rules.md
  testing.md
  human/
    frontend-rules-v0.5.md
```
