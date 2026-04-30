<!-- plans/lecture-journal-reconciliation-stable-followup.md -->

# Lecture Journal Reconciliation Stable Follow-up

本文件记录教学日志对账 lab 迁入 stable 前需要保留的技术判断，避免散落在临时讨论中。

## 已收束

- 查询流程已归并到 `query-workflow`：页面只负责 UI 状态，业务流程负责对账、session 续期、一体化预填分支和预填失败降级。
- 一体化预填只在对账结果存在一体化课程时触发；没有一体化课的教师不请求预填。
- 课程类别判断已收束到 lab 内共享 helper，避免页面和流程编排分别硬编码类别值。
- 页面已拆出轻量预填 loading 状态；主对账结果可先展示，预填阶段继续锁住查询按钮并给出按钮状态。
- 教学日志草稿默认值、已填日志回显、邻近已填日志模板复用与一体化预填字段映射已收束到 `journal-draft-policy`，避免 UI 改动破坏实训课默认“遵章守纪”等业务预填规则。
- 保存流程已归并到 `save-workflow`：页面保留保存反馈、登录弹窗、卡片折叠和本地展示 patch；workflow 负责保存前校验、课程类型分支、保存 payload 构造、API 调用与 session 续期。

## Stable 前再评估

- 查询状态是否需要 reducer：当 query lifecycle 继续增加状态时，把查询开始、主结果成功、预填开始、预填成功、预填失败、session 过期集中到 reducer。
- 迁入 stable 时，将 `journal-draft-policy` 放入对应 feature 的 application/domain 边界；如果教学日志草稿规则未来被多个页面复用，再评估是否上收到 entity。
- 迁入 stable 时，将 `save-workflow` 放入对应 feature 的 application 边界；保存 API 适配进入 infrastructure，页面继续只处理 UI 反馈和动画。
- 迁入 stable 时不要让正式区直接依赖 `src/labs` 实现；按正式业务拥有者切片重新落位。

## 当前验证重点

- `query-workflow` 单测需要覆盖：无教师不预填、无一体化课不预填、预填失败不覆盖主结果、rolling token 顺序、过期 session 外抛、页面协作回调与 stale request 防护。
- `journal-draft-policy` 单测需要覆盖：实训课默认遵章守纪与安全保养、已填日志不被默认值覆盖、一体化默认班次和预填字段映射、未填课次复用邻近已填日志模板。
- `save-workflow` 单测需要覆盖：理论课、实训课、一体化三类 payload，未来课程拦截，实训课课时合计校验，保存错误外抛，保存成功后 session 续期。
- 页面回归重点：主对账结果先展示；预填期间按钮仍处于忙碌状态；预填失败只显示 warning，不清空主对账结果。
