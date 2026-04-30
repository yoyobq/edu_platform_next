<!-- plans/lecture-journal-reconciliation-stable-followup.md -->

# Lecture Journal Reconciliation Stable Follow-up

本文件记录教学日志对账 lab 迁入 stable 前需要保留的技术判断，避免散落在临时讨论中。

## 已收束

- 查询流程已归并到 `query-workflow`：页面只负责 UI 状态，业务流程负责对账、session 续期、一体化预填分支和预填失败降级。
- 一体化预填只在对账结果存在一体化课程时触发；没有一体化课的教师不请求预填。
- 课程类别判断已收束到 lab 内共享 helper，避免页面和流程编排分别硬编码类别值。
- 页面已拆出轻量预填 loading 状态；主对账结果可先展示，预填阶段继续锁住查询按钮并给出按钮状态。

## Stable 前再评估

- 查询状态是否需要 reducer：当 query lifecycle 继续增加状态时，把查询开始、主结果成功、预填开始、预填成功、预填失败、session 过期集中到 reducer。
- 保存流程是否需要 `save-workflow`：当保存字段映射或课程类型继续增加时，把保存输入构造、API 选择和 session 续期从页面中抽出；页面保留反馈、动画和本地展示 patch。
- 迁入 stable 时不要让正式区直接依赖 `src/labs` 实现；按正式业务拥有者切片重新落位。

## 当前验证重点

- `query-workflow` 单测需要覆盖：无教师不预填、无一体化课不预填、预填失败不覆盖主结果、rolling token 顺序、过期 session 外抛、页面协作回调与 stale request 防护。
- 页面回归重点：主对账结果先展示；预填期间按钮仍处于忙碌状态；预填失败只显示 warning，不清空主对账结果。
