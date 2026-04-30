<!-- plans/lecture-journal-reconciliation-stable-followup.md -->

# Lecture Journal Reconciliation Stable Follow-up

本文件记录教学日志对账 lab 迁入 stable 前需要保留的技术判断，避免散落在临时讨论中。

## 已收束

- 查询流程已归并到 `query-workflow`：页面只负责 UI 状态，业务流程只调用一次教学日志 prefill 读取，并从 `prefill.reconciliation` 获取对账结果。
- 一体化预填由同一次 prefill 读取返回；没有一体化课时 `integratedPreviews` 为空数组。
- 课程类别判断已收束到 lab 内共享 helper，避免页面和流程编排分别硬编码类别值。
- 页面读取状态已收敛为单次查询 loading，不再拆成对账读取和一体化预填两个阶段。
- 教学日志草稿默认值、已填日志回显、邻近已填日志模板复用与一体化预填字段映射已收束到 `journal-draft-policy`，避免 UI 改动破坏实训课默认“遵章守纪”等业务预填规则。
- 保存流程已归并到 `save-workflow`：页面保留保存反馈、登录弹窗、卡片折叠和本地展示 patch；workflow 负责保存前校验、课程类型分支、保存 payload 构造、API 调用与 session 续期。
- 结果视图筛选规则已收束到 `view-filter-policy`：隐藏未开课计数、0 项隐藏、单类别隐藏、active fallback 和课程类别筛选都由纯函数覆盖。
- `prefill.reconciliation.items` 和 `prefill.integratedPreviews` 到卡片 item 的映射已收束到 `editable-item-mapper`，页面不再内联拼装卡片数据结构。

## Stable 前再评估

- 查询状态是否需要 reducer：当 query lifecycle 继续增加状态时，把查询开始、主结果成功、预填开始、预填成功、预填失败、session 过期集中到 reducer。
- 迁入 stable 时，将 `journal-draft-policy` 放入对应 feature 的 application/domain 边界；如果教学日志草稿规则未来被多个页面复用，再评估是否上收到 entity。
- 迁入 stable 时，将 `save-workflow` 放入对应 feature 的 application 边界；保存 API 适配进入 infrastructure，页面继续只处理 UI 反馈和动画。
- 迁入 stable 时，将 `view-filter-policy` 和 `editable-item-mapper` 放入 feature application 边界；若卡片 item 成为稳定业务对象，再评估是否拆出 entity/domain 类型。
- 迁入 stable 时，将对账 item key 的构造收束为一个共享 helper。当前 `editable-item-mapper` 生成卡片 key，`query-state` 保存成功后用同口径 key patch 本地结果；两处逻辑必须保持一致，否则可能出现保存成功但页面找不到对应卡片、需要重新查询才刷新状态的问题。
- 迁入 stable 时不要让正式区直接依赖 `src/labs` 实现；按正式业务拥有者切片重新落位。

## 当前验证重点

- `query-workflow` 单测需要覆盖：单次 prefill 请求参数、rolling token 持久化、过期 session 外抛、stale request 防护。
- `journal-draft-policy` 单测需要覆盖：实训课默认遵章守纪与安全保养、已填日志不被默认值覆盖、一体化默认班次和预填字段映射、未填课次复用邻近已填日志模板。
- `save-workflow` 单测需要覆盖：理论课、实训课、一体化三类 payload，未来课程拦截，实训课课时合计校验，保存错误外抛，保存成功后 session 续期。
- `view-filter-policy` 单测需要覆盖：隐藏未开课后的范围计数、范围 fallback、类别筛选隐藏规则和类别过滤。
- `editable-item-mapper` 单测需要覆盖：实训计划字段映射、一体化预填字段映射和 mapper 缓存引用复用。
- 页面回归重点：查询按钮只触发一次 prefill 请求；对账结果来自 `prefill.reconciliation`；一体化预估来自 `prefill.integratedPreviews`。
