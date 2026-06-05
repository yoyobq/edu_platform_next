<!-- docs/backend/README.md -->

# Backend Docs

本目录用于说明前端如何按需查看后端契约。后端仓库是最新真相；本目录下的文件只是可选本地快照或专题摘录。

**注意：本目录文件顶部的注释路径（如 `// src/core/...`）是它们在后端仓库中的原始路径，前端阅读时请直接无视。**

当前本机优先查看：

- `/var/www/backend_next/src/schema.graphql`：最新 GraphQL 接口与类型
- `/var/www/backend_next/src/core/common/errors/domain-error.ts`：最新后端业务错误码
- `/var/www/backend_next/src/infrastructure/graphql/filters/graphql-exception.filter.ts`：最新 GraphQL 异常映射

使用原则：

- 优先查看同机后端工作区；仓库内 `docs/backend/*` 只作为本地 fallback
- 当前 `docs/backend/schema.graphql` 可能包含旧学生 invite 快照定义；学生注册链路以
  `issueStudentRegistrationLink` / `publicStudentRegistrationLinkInfo` /
  `consumeStudentRegistrationLink` 为准
- 不让前端代码、脚本或 CI 依赖 `/var/www/backend_next` 绝对路径
- 只有在当前任务确实依赖后端字段、类型、query、mutation、input 或具体业务错误码时，才按需查看相关片段
- 不建议全文阅读完整 schema
- 若同机后端工作区不存在，再查看本目录是否有本地快照；快照不保证最新
