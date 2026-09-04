<!-- docs/README.md -->

# Docs

This directory contains project documentation.

## How To Use

- Root [README.md](../README.md) is the quick project overview
- This file is the docs index
- The split docs below are the current direct rule entry points by topic
- [frontend-rules-v0.6.md](./human/frontend-rules-v0.6.md) is the current long-form full version

## Quick Routing

- 规则看起来有重叠、边界有冲突、不确定该按哪份文档执行时，先看 [rule-precedence.md](./rule-precedence.md)
- 不确定组件、页面或模块该放哪层时，先看 [layer-model.md](./layer-model.md)
- 已确定在看 `stable` 第二维问题时，先看 [stable-clean/README.md](./stable-clean/README.md)
- 想判断 API、storage、URL 参数、SDK、mock 该放哪时，先看 [infrastructure-rules.md](./infrastructure-rules.md)
- 想跨模块引用、调整 import、判断依赖是否合法时，先看 [dependency-rules.md](./dependency-rules.md)
- 想明确 `app/` 壳层、主内容区与 AI sidecar 的布局原则时，先看 [layout.md](./layout.md)
- 想确认导航 capability、`src/app/navigation/` 聚合出口、域级 navigation meta 归属与过滤规则时，先看 [navigation.md](./navigation.md)
- 想明确登录后默认首页、首页工作台模块准入与 workbench entry 边界时，先看 [workbench-entry-rules.md](./workbench-entry-rules.md)
- 想参考更激进的 AI-native layout 想法、给生成或设计探索提供输入时，再看 [layout-ideas.md](./layout-ideas.md)
- 想明确 `antd`、`antdX` 和 `tailwindcss` 的职责分工时，先看 [ui-stack-rules.md](./ui-stack-rules.md)
- 想确认颜色、圆角、间距、排版的视觉基准与 token 约定时，先看 [ui-design/README.md](./ui-design/README.md)
- 想明确间距档位在各结构层级的具体用法与节奏规则时，先看 [ui-design/spacing.md](./ui-design/spacing.md)
- 想统一业务表格的信息结构、列宽、密度、状态表达与行内操作边界时，先看 [ui-design/table-rules.md](./ui-design/table-rules.md)
- 想确定什么情况下该出图、图表需要哪些口径，以及如何保证可复核与可导出时，先看 [ui-design/chart.md](./ui-design/chart.md)
- 想快速判断什么时候该用页面、抽屉、弹窗、Popover、Popconfirm、Tooltip 等交互容器，或判断确认边界与反馈形式时，先看 [ui-design/ux-guidelines.md](./ui-design/ux-guidelines.md)
- 想参考外部 UI 风格、判断哪些风格能被局部吸收以及适用边界时，再看 [ui-design/inspirations/README.md](./ui-design/inspirations/README.md)
- 想新增或修改 `labs` 功能、调整实验入口对 admin / staff / student 的暴露时，先看 [labs-rules.md](./labs-rules.md)
- 想新增或修改 `sandbox` 原型时，先看 [sandbox-rules.md](./sandbox-rules.md)
- 想统一表单值、URL search params、筛选条件的空值与 normalize 语义时，先看 [project-convention/form-input-normalization.md](./project-convention/form-input-normalization.md)
- 想统一业务入口 path、`redirect`、筛选 query 等 URL 语义时，先看 [project-convention/route-url-semantics.md](./project-convention/route-url-semantics.md)
- 想确认 `admin` 用户列表与详情页当前的路由、分层、列表字段和展示边界时，先看 [project-convention/admin-user-list.md](./project-convention/admin-user-list.md)
- 想确认 `/profile` 个人资料页、身份信息页签与 `slotGroup` 展示边界时，先看 [project-convention/my-profile.md](./project-convention/my-profile.md)
- 想确认 `My 教学日志` 的查询、保存、草稿、筛选与 upstream 会话边界时，先看 [project-convention/academic-teaching-log.md](./project-convention/academic-teaching-log.md)
- 想确认 `My 计划首页` 的 prefill、候选下拉、保存、管理视角与 upstream 身份选择边界时，
  先看 [课程计划首页文档](./project-convention/academic-curriculum-plan-homepage.md)
- 想确认 `My 授课计划` 的课次投影、历史计划填充、拖拽编排、草稿与 `.xls` 导出边界时，
  先看 [授课计划文档](./project-convention/academic-teaching-plan.md)
- 想确认“拆分合班确认”页面的准入、确认边界与下游消费口径时，先看
  [拆分合班确认文档](./project-convention/academic-split-joint-teaching.md)
- 想确认前端 `staff invite` 当前的页面流程、字段展示和登录回跳约定时，先看 [project-convention/public-auth-staff-invite.md](./project-convention/public-auth-staff-invite.md)
- 想确认学生注册链接注册、初始登录邮箱验证和重发验证邮件约定时，先看 [project-convention/public-auth-student-registration.md](./project-convention/public-auth-student-registration.md)
- 想确认 public auth 一次性入口当前由谁承接、哪些已是真实流程、哪些仍是 shell 时，先看 [project-convention/public-auth-verification-intents.md](./project-convention/public-auth-verification-intents.md)
- 想确认当前身份、授权摘要、前端权限体系、能力 helper、slotGroup 语义、会话恢复以及 protected route 前置续期边界时，先看 [project-convention/identity-access-session.md](./project-convention/identity-access-session.md)
- 想确认前端 `staff / student` 教务身份族在导航、页面、数据入口和 E2E mock 中的拆分与复用边界时，先看 [project-convention/identity-family-frontend-boundary.md](./project-convention/identity-family-frontend-boundary.md)
- 想确认 upstream token 为什么由前端持有、upstream 登录 staffId 是否锁定、`/labs/upstream-session-reference` 的最小接入样板、当前 `/labs/upstream-session-demo` 的业务演示边界，以及后续 upstream 功能应复用什么模式时，先看 [project-convention/upstream-session-frontend-ownership.md](./project-convention/upstream-session-frontend-ownership.md)
- 想确认 `/welcome` 首次资料补全的进入条件、回跳规则和表单复用边界时，先看 [project-convention/welcome-profile-completion.md](./project-convention/welcome-profile-completion.md)
- 想确认 `shared/graphql` 与 `auth` 的运行时边界、主动/兜底续期、请求鉴权语义与会话失效跳转时，先看 [project-convention/graphql-ingress-auth-boundary.md](./project-convention/graphql-ingress-auth-boundary.md)
- 想确认 `executeGraphQL()` 的统一异常出口、`GraphQLIngressError` 分类、Apollo 4.x 映射和默认中文错误提示时，先看 [project-convention/graphql-error-model.md](./project-convention/graphql-error-model.md)
- 想明确“事件时间 / 业务日期 / 业务日期时间”的展示与存储语义时，先看 [project-convention/time-display-semantics.md](./project-convention/time-display-semantics.md)
- 想按测试目标区分 `core` 和 `smoke` E2E，或想跑单文件时，先看 [project-convention/e2e-test-groups.md](./project-convention/e2e-test-groups.md)
- 想了解测试约定、Playwright E2E 入口或 `env` 配置时，先看 [testing.md](./testing.md)
- 想判断 AI 生成结果该先落哪层、何时能进入 `stable` 时，先看 [ai-workflow.md](./ai-workflow.md)
- 想确认后端真相时，先看 [backend/README.md](./backend/README.md)：优先查同机后端工作区，`docs/backend/*` 只作本地 fallback
- 想了解当前仍未完全定稿的事项、已知限制或背景决策时，再看 [open-decisions.md](./open-decisions.md)

## Rule Docs

- [rule-precedence.md](./rule-precedence.md)
- [layer-model.md](./layer-model.md)
- [stable-clean/README.md](./stable-clean/README.md)
- [infrastructure-rules.md](./infrastructure-rules.md)
- [layout.md](./layout.md)
- [navigation.md](./navigation.md)
- [workbench-entry-rules.md](./workbench-entry-rules.md)
- [chunk-strategy.md](./chunk-strategy.md)
- [ui-stack-rules.md](./ui-stack-rules.md)
- [ui-design/README.md](./ui-design/README.md)
- [dependency-rules.md](./dependency-rules.md)
- [labs-rules.md](./labs-rules.md)
- [sandbox-rules.md](./sandbox-rules.md)
- [testing.md](./testing.md)
- [ai-workflow.md](./ai-workflow.md)
- [open-decisions.md](./open-decisions.md)

## Reference Docs

- [layout-ideas.md](./layout-ideas.md)
- [ui-design/inspirations/README.md](./ui-design/inspirations/README.md)
- [backend/README.md](./backend/README.md)

## Plans

- [../plans/staff-slot-management-plan.md](../plans/staff-slot-management-plan.md)
- [../plans/student-private-profile-plan.md](../plans/student-private-profile-plan.md)
- [../plans/ui-ux-evolution-direction.md](../plans/ui-ux-evolution-direction.md)

## Project Convention Docs

- [academic-curriculum-plan-homepage.md](./project-convention/academic-curriculum-plan-homepage.md)
- [academic-teaching-plan.md](./project-convention/academic-teaching-plan.md)
- [academic-split-joint-teaching.md](./project-convention/academic-split-joint-teaching.md)
- [project-convention/academic-teaching-log.md](./project-convention/academic-teaching-log.md)
- [project-convention/admin-user-list.md](./project-convention/admin-user-list.md)
- [project-convention/course-category-visual-semantics.md](./project-convention/course-category-visual-semantics.md)
- [project-convention/e2e-test-groups.md](./project-convention/e2e-test-groups.md)
- [project-convention/form-input-normalization.md](./project-convention/form-input-normalization.md)
- [project-convention/graphql-error-model.md](./project-convention/graphql-error-model.md)
- [project-convention/graphql-ingress-auth-boundary.md](./project-convention/graphql-ingress-auth-boundary.md)
- [project-convention/identity-access-session.md](./project-convention/identity-access-session.md)
- [project-convention/identity-family-frontend-boundary.md](./project-convention/identity-family-frontend-boundary.md)
- [project-convention/identity-family-contract-boundary.md](./project-convention/identity-family-contract-boundary.md)
- [project-convention/my-profile.md](./project-convention/my-profile.md)
- [project-convention/public-auth-staff-invite.md](./project-convention/public-auth-staff-invite.md)
- [project-convention/public-auth-student-registration.md](./project-convention/public-auth-student-registration.md)
- [project-convention/public-auth-verification-intents.md](./project-convention/public-auth-verification-intents.md)
- [project-convention/route-url-semantics.md](./project-convention/route-url-semantics.md)
- [project-convention/staff-directory-cache.md](./project-convention/staff-directory-cache.md)
- [project-convention/student-conduct-alignment.md](./project-convention/student-conduct-alignment.md)
- [project-convention/time-display-semantics.md](./project-convention/time-display-semantics.md)
- [project-convention/upstream-session-frontend-ownership.md](./project-convention/upstream-session-frontend-ownership.md)
- [project-convention/welcome-profile-completion.md](./project-convention/welcome-profile-completion.md)

## UI Design Docs

- [ui-design/README.md](./ui-design/README.md)
- [ui-design/ai-rules.md](./ui-design/ai-rules.md)
- [ui-design/chart.md](./ui-design/chart.md)
- [ui-design/colors.md](./ui-design/colors.md)
- [ui-design/dark-mode.md](./ui-design/dark-mode.md)
- [ui-design/index-css.md](./ui-design/index-css.md)
- [ui-design/interaction-feedback.md](./ui-design/interaction-feedback.md)
- [ui-design/page-header.md](./ui-design/page-header.md)
- [ui-design/spacing.md](./ui-design/spacing.md)
- [ui-design/table-rules.md](./ui-design/table-rules.md)
- [ui-design/tokens.md](./ui-design/tokens.md)
- [ui-design/typography.md](./ui-design/typography.md)
- [ui-design/ux-guidelines.md](./ui-design/ux-guidelines.md)
- [ui-design/brand/README.md](./ui-design/brand/README.md)
- [ui-design/brand/app-icons.md](./ui-design/brand/app-icons.md)
- [ui-design/brand/asset-engineering.md](./ui-design/brand/asset-engineering.md)
- [ui-design/brand/brand-tone.md](./ui-design/brand/brand-tone.md)
- [ui-design/brand/logo.md](./ui-design/brand/logo.md)
- [ui-design/brand/ui-icons.md](./ui-design/brand/ui-icons.md)
- [ui-design/inspirations/README.md](./ui-design/inspirations/README.md)
- [ui-design/inspirations/claude.md](./ui-design/inspirations/claude.md)
- [ui-design/inspirations/framer.md](./ui-design/inspirations/framer.md)
- [ui-design/inspirations/linear.md](./ui-design/inspirations/linear.md)
- [ui-design/inspirations/notion.md](./ui-design/inspirations/notion.md)
- [ui-design/inspirations/raycast.md](./ui-design/inspirations/raycast.md)
- [ui-design/inspirations/stripe.md](./ui-design/inspirations/stripe.md)
- [ui-design/inspirations/vercel.md](./ui-design/inspirations/vercel.md)
- [ui-design/inspirations/vercel-geist.md](./ui-design/inspirations/vercel-geist.md)

## Notes

- 日常读取时，优先按任务直接使用拆分文档
- 多份文档同时适用但边界不清晰时，优先按 [rule-precedence.md](./rule-precedence.md) 裁决
- `app / pages / widgets / features / entities / shared` 的细分职责当前见 [layer-model.md](./layer-model.md)
- `stable` 区内部何时需要第二维 Clean 分层，当前见 [stable-clean/architecture.md](./stable-clean/architecture.md)
- API、storage、URL 参数、SDK、mock 的统一收束规则当前见 [infrastructure-rules.md](./infrastructure-rules.md)
- 后端真相入口是 [backend/README.md](./backend/README.md)；优先查同机后端工作区，再按需查 `docs/backend/*` 本地快照
- `stable` 第二维主题当前按“先列清单，再记录具体决策”的方式推进
- `stable` 第二维的最小目录模板当前见 [stable-clean/templates.md](./stable-clean/templates.md)
- [open-decisions.md](./open-decisions.md) 只记录真正的开放项、已知限制与关键背景决策

## Structure

```txt
docs/
  README.md
  ai-workflow.md
  backend/
    README.md
  chunk-strategy.md
  dependency-rules.md
  human/
    frontend-rules-v0.6.md
  infrastructure-rules.md
  labs-rules.md
  layer-model.md
  layout.md
  layout-ideas.md
  navigation.md
  open-decisions.md
  rule-precedence.md
  sandbox-rules.md
  stable-clean/
    README.md
    architecture.md
    checklist.md
    decisions.md
    templates.md
  testing.md
  ui-stack-rules.md
  ui-design/
    README.md
    ai-rules.md
    chart.md
    colors.md
    dark-mode.md
    index-css.md
    interaction-feedback.md
    page-header.md
    spacing.md
    table-rules.md
    tokens.md
    typography.md
    ux-guidelines.md
    brand/
      README.md
      app-icons.md
      asset-engineering.md
      brand-tone.md
      logo.md
      ui-icons.md
    inspirations/
      README.md
      claude.md
      framer.md
      linear.md
      notion.md
      raycast.md
      stripe.md
      vercel.md
      vercel-geist.md
  workbench-entry-rules.md
  project-convention/
    academic-teaching-log.md
    admin-user-list.md
    course-category-visual-semantics.md
    e2e-test-groups.md
    form-input-normalization.md
    graphql-error-model.md
    graphql-ingress-auth-boundary.md
    identity-access-session.md
    identity-family-frontend-boundary.md
    identity-family-contract-boundary.md
    my-profile.md
    public-auth-staff-invite.md
    public-auth-student-registration.md
    public-auth-verification-intents.md
    route-url-semantics.md
    staff-directory-cache.md
    time-display-semantics.md
    upstream-session-frontend-ownership.md
    welcome-profile-completion.md
```
