# Open Decisions

本文件记录当前真正的开放项、已知限制，以及少量需要保留的关键背景决策。

## 1. Why Not Pure FSD

当前决策：

- 本项目不追求“纯粹 FSD”，而采用 `stable / labs / sandbox` 三层结构
- 这样做的目的不是弱化分层，而是把长期维护、可控实验、开发试错明确分开
- `labs` 和 `sandbox` 的存在是为了让 AI 可以快速生成结果、快速验证价值，同时避免实验代码直接污染正式区
- 因此后续不应把项目机械收敛回只剩传统 `app / pages / widgets / features / entities / shared` 的单一正式结构

## 2. stable 区细分职责尚未拆成独立短文档

当前状态：

- `app / pages / widgets / features / entities / shared` 的当前规则已经收敛到 [layer-model.md](./layer-model.md)
- 但它们还没有拆成各自独立的主题文档

后续方向：

- 视规则稳定程度，后续再拆成更小的主题文档

## 3. 已知限制：ESLint 不会自动根据 exception 放行

当前状态：

- `labs` 的 `exception` 仍需要人工确认后写入 `meta.ts`
- ESLint 不会自动读取 `exception` 并放行对应依赖

当前处理方式：

- 默认依赖仍由 ESLint 自动拦截
- 真实例外依赖靠人工确认与文档约束处理
