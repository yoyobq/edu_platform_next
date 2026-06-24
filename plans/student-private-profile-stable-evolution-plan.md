<!-- plans/student-private-profile-stable-evolution-plan.md -->

# Student Private Profile Stable Evolution Plan

本文记录学生个人资料复核能力从 `/labs/student-private-profile` 向 stable 演进的阶段计划。

## 当前结论

现有 lab 已验证后端 P5/P6/P6.5/P7 contract，但页面仍带有明显联调工具痕迹。向 stable 演进时，不应让
正式区直接依赖 labs 实现；应把已稳定的显示策略、API adapter、流程编排逐步迁入 stable feature。

## Phase 1：Lab 内体验收敛

当前已完成：

- 抽出 `src/labs/student-private-profile/application/display-policy.ts`
  - 字段 key 到中文 label 的映射
  - section/source/status/compare/photo/batch 结果的用户可读文案
  - 常见颜色策略与布尔结果文案
- 页面文案从 contract 语言改为任务语言
  - `summary` 改为“本地资料快照”
  - `upstream` 改为“学工系统”
  - `已观察/未观察` 改为“已同步/待同步”
  - `snapshotUpdated`、`changedSections` 等表头改为中文业务语义
- 批量刷新区域保持为操作结果视图，不展示单学生资料明细。

验证：

- `npm run test:unit -- src/labs/student-private-profile/application/display-policy.spec.ts src/labs/student-private-profile/api.spec.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run format:check`

## Phase 2：Stable 试运行入口

下一步建议：

- 新建 `features/student-private-profile-review`
  - `infrastructure` 承接当前 lab API adapter
  - `application` 承接 display policy、字段分组、复核提示、批量结果 view model
  - `ui` 承接正式页面组件
- 新建 `pages/student-private-profile-review`
- 导航建议挂在“班务管理 / 学生资料复核”，先加 `试运行` 标记。
- labs 保留为后续后端 contract 试接入口，不作为 stable 长期依赖。

## Phase 3：正式体验收敛

后续再做：

- 按角色调整默认视图和入口能力。
- 将高敏字段修正入口与普通联系方式/地址修正入口做更明显的权限隔离。
- 将批量刷新进一步收敛成班级管理里的辅助操作，而不是资料详情页的核心视图。
- stable 入口稳定后，隐藏或降级 labs 导航。
