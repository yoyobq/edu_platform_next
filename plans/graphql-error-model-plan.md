# GraphQL Error Model Plan

本计划只保留当前仍未收尾的事项。

已经稳定并落地的规则，已迁入：

- [../docs/project-convention/graphql-error-model.md](../docs/project-convention/graphql-error-model.md)

已落地内容包括：

- `GraphQLIngressError`、`isGraphQLIngressError()`、`toGraphQLIngressError()`
- `executeGraphQL()` 的统一异常归一
- `malformed` 的稳定触发条件
- Apollo 4.x 错误类型映射
- 默认 `userMessage` 中文兜底文案
- public-auth 的 submit 链与 intent lookup 链基础迁移
- network 与 http 真实 transport failure E2E 补齐 (包含 submit 与 intent lookup 链)

## 建议落地顺序

### P3

- 再评估 auth / profile-completion 等 authenticated 调用方是否需要细化消费
- 视真实需要再决定是否补更多字段或 helper

## 落地后的立即补测要求 (已完成)

错误模型当前已落地，且已完成对真实 transport failure E2E 的覆盖：

- `network` (模拟 request abort)
- `http` (模拟 500)

当前已满足的最小要求：

- `network` 命中 intent lookup 链与 submit 链
- `http` 覆盖 intent lookup 链与 submit 链，并有明确 UI 反馈出口
- 不把当前已有的 `200 + errors` 用例误当成对 `network/http` 的完整覆盖
