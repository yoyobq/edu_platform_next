<!-- plans/README.md -->

# Plans

本目录存放项目内仍在推进中的计划文档。

plan 的职责是回答：

- 接下来要推进什么
- 优先级如何排序
- 前置条件是什么
- 每一项希望产出什么

plan 不负责定义稳定规则。

若某条边界已经稳定，应进入 `docs/` 下对应 rule 文档，而不是继续留在 plan 里反复描述。

## 读取顺序

阅读某个 plan 时，优先按下面顺序处理：

1. 先看当前 plan 本身，确认目标、范围、优先级和产出物
2. 若 plan 明确引用了某份 rule，再按需打开对应 `docs` 文档
3. 若多个 rule 可能冲突，再看 [docs/rule-precedence.md](../docs/rule-precedence.md)
4. 若当前 plan 需要真实后端字段、类型或权限语义，先看 [docs/backend/README.md](../docs/backend/README.md)，再按需打开本地 `docs/backend/schema.graphql`

## 与 Docs 的关系

- `plans/`：记录尚在推进中的事项、阶段和待完成产出
- `docs/`：记录已经稳定的规则、边界、约定和开放项

常见情况：

- 若 plan 里写着“已移入规则的内容”，不要再把 plan 当成主规则来源
- 若需要判断正式边界，优先去 `docs/README.md` 查对应主题入口
- 若只是执行某个 plan 中的单一事项，只打开该事项直接引用的文档即可
- 若需要后端契约，先确认本地是否存在 `docs/backend/schema.graphql`，只查与当前任务直接相关的 type / query / mutation / input，不做全文通读

## Token 友好建议

- 不要为了理解一个 plan，先全文阅读整个 `docs/` 目录
- 优先只读取：
- 当前 plan 直接引用的 rule 文档
- `docs/README.md` 中与当前主题直接相关的 1 到 2 个入口文档
- 若任务依赖后端契约，先看 [docs/backend/README.md](../docs/backend/README.md)，再读取本地 `docs/backend/schema.graphql` 中直接相关的片段
- 只有在规则重叠、冲突或边界不清时，再补读 [docs/rule-precedence.md](../docs/rule-precedence.md)
- `open-decisions.md` 不是默认必读，只有 plan 明确需要相关背景时再打开
- `schema.graphql` 不是默认必读，且默认不提交；只有当前任务确实依赖后端字段、类型或权限语义时，才在本地按需打开

一句话原则：

- 先读 plan
- 再按需查 rule
- 不做整库文档通读

## 当前优先级约定

若某份 plan 使用 `P0 / P1 / P2 / P3`，默认按以下语义理解：

- `P0`：不做就会阻塞主线落地
- `P1`：不阻塞主线，但应尽早补齐，否则实现容易继续发散
- `P2`：需要相关页面、模块或上下文先稳定下来后再推进
- `P3`：需要更多真实使用模式或更成熟前置条件后再展开

## 当前计划

- [graphql-error-model-plan.md](./graphql-error-model-plan.md)
- [layout-todo.md](./layout-todo.md)
- [identity-access-model-now.md](./identity-access-model-now.md)
- [identity-access-model-future.md](./identity-access-model-future.md)
- [public-auth-flows-plan.md](./public-auth-flows-plan.md)
- [public-auth-flows-now.md](./public-auth-flows-now.md)
- [public-auth-flows-future.md](./public-auth-flows-future.md)
- [workbench-entry-plan.md](./workbench-entry-plan.md)
- [stable-clean-adoption-plan.md](./stable-clean-adoption-plan.md)
