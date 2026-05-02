<!-- docs/project-convention/academic-teaching-log.md -->

# Academic Teaching Log

本文件记录当前 `My 教学日志` 的稳定前端边界。

## 分层

- page owner：`src/pages/my-teaching-logs`
- feature owner：`src/features/academic-teaching-log`
- upstream 会话统一从 `@/entities/upstream-session` 消费，不在页面内自建 token 存储或登录 mutation
- 学期列表统一从 `@/entities/academic-semester` 消费

## 工作流

- 查询只通过 `query-workflow` 编排；页面只处理 UI 状态与反馈
- 对账结果来自同一次 prefill 读取中的 `prefill.reconciliation`
- 一体化预填来自 `prefill.integratedPreviews`
- 保存只通过 `save-workflow` 编排；页面保留保存反馈、登录弹窗、折叠状态与本地展示 patch

## 业务策略

- 课程类别判断统一走 feature 内共享 helper
- 草稿默认值、已填日志回显、邻近已填日志模板复用与一体化字段映射统一走 `journal-draft-policy`
- 结果筛选统一走 `view-filter-policy`
- prefill / integrated previews 到卡片 item 的映射统一走 `editable-item-mapper`
- 卡片 item key 的构造必须保持单一口径，避免保存成功后本地 patch 找不到目标卡片

## 迁移约束

- stable 区不得直接依赖 `src/labs` 的教学日志实现
- 若查询生命周期继续增加状态，再把查询状态收进 reducer
- 若卡片 item 后续成为跨页面稳定业务对象，再评估是否拆到 entity/domain
