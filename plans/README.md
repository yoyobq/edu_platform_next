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

## Plan 的生命周期与命名规范

为明确工作流程，`plans/` 目录下的文档遵循以下生命周期和文件后缀语义：

1. **初期构思阶段 (`-direction`)**
   首次建立时，使用 `-direction` 后缀（如 `xxx-direction.md`），表示这是一个初步方向，等待团队讨论和对齐。
2. **正式计划阶段 (`-plan` 或 `-explain` / `-now` / `-future`)**
   经过讨论明确后，转为正式计划：
   - **轻量级计划**：如果内容较少（200 行以内），保留为单一文件，使用 `-plan` 后缀（如 `xxx-plan.md`）。
   - **重量级计划**：如果内容较多、涉及面广，拆分为三个文档：
     - `-explain`：解释业务背景、核心模型或架构设计。
     - `-now`：当前阶段或近期的具体实施步骤和 Action Items。
     - `-future`：远期规划或 P3/P4 级别的未来演进方向。
3. **落地与归档阶段 (`-followup`)**
   一份 plan 落地后：
   - **稳定规则归档**：大部分已确定的规则、模型和约定，应该移入 `docs/project-convention/` 目录下对应的文档中作为永久契约。
   - **残余事项追踪**：对于因故延期、需要后续跟进的长尾任务或操作，留在 `plans/` 目录中，并将文件后缀改为 **`-followup`**（如 `xxx-followup.md`）。这代表该计划的主体已完结，仅剩具体的待办事项供后续操作。

## 读取顺序

阅读某个 plan 时，优先按下面顺序处理：

1. 先看当前 plan 本身，确认目标、范围、优先级和产出物
2. 若 plan 明确引用了某份 rule，再按需打开对应 `docs` 文档
3. 若多个 rule 可能冲突，再看 [docs/rule-precedence.md](../docs/rule-precedence.md)
4. 若当前 plan 需要后端真相，先看 [docs/backend/README.md](../docs/backend/README.md)；`schema.graphql` 看类型，`domain-error.ts` 和 `graphql-exception.filter.ts` 看错误码与映射

## 与 Docs 的关系

- `plans/`：记录尚在推进中的事项、阶段和待完成产出
- `docs/`：记录已经稳定的规则、边界、约定和开放项

常见情况：

- 若 plan 里写着“已移入规则的内容”，不要再把 plan 当成主规则来源
- 若需要判断正式边界，优先去 `docs/README.md` 查对应主题入口
- 若只是执行某个 plan 中的单一事项，只打开该事项直接引用的文档即可
- 若需要后端契约，优先从 `docs/backend/` 按需查片段，不做全文通读

## Token 友好建议

- 不要为了理解一个 plan，先全文阅读整个 `docs/` 目录
- 优先只读取：
- 当前 plan 直接引用的 rule 文档
- `docs/README.md` 中与当前主题直接相关的 1 到 2 个入口文档
- 若任务依赖后端契约，先看 [docs/backend/README.md](../docs/backend/README.md)，再按需查 `schema.graphql`、`domain-error.ts`、`graphql-exception.filter.ts`
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

- [graphql-ingress-followup.md](./graphql-ingress-followup.md)
- [graphql-error-model-followup.md](./graphql-error-model-followup.md)
- [layout-plan.md](./layout-plan.md) - 当前 layout 计划与壳层能力演进
- [identity-access-model-followup.md](./identity-access-model-followup.md)
- [navigation-plan.md](./navigation-plan.md)
- [public-auth-flows-explain.md](./public-auth-flows-explain.md)
- [public-auth-flows-now.md](./public-auth-flows-now.md)
- [public-auth-flows-future.md](./public-auth-flows-future.md)
- [welcome-profile-completion-followup.md](./welcome-profile-completion-followup.md)
- [workbench-entry-plan.md](./workbench-entry-plan.md)
