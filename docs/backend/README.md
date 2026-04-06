<!-- docs/backend/README.md -->

# Backend Docs

本目录用于放按需参考的后端契约文档。它们是后端的“真相”（Source of Truth），用于在前端（尤其是 AIGC 辅助开发时）对齐类型、错误码与接口定义。

**注意：这些文件顶部的注释路径（如 `// src/core/...`）是它们在后端仓库中的原始路径，前端阅读时请直接无视。**

当前约定参考的文件包括：

- `schema.graphql`：GraphQL 接口与类型的完整定义
- `domain-error.ts`：后端业务领域错误码（`errorCode`）的全集枚举
- `graphql-exception.filter.ts`：后端异常过滤器，可参考它如何将 HTTP 状态码或 `DomainError` 映射为 GraphQL 的 `extensions.code` 和 `errorCode`

使用原则：

- 默认不提交到仓库
- 只有在当前任务确实依赖后端字段、类型、query、mutation、input 或具体业务错误码时，才按需查看相关片段
- 不建议全文阅读完整 schema
- 若仓库内看不到上述文件，表示当前本地未放置，或该文件按约定未提交
