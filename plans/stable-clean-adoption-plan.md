# Stable Clean Adoption Plan

本计划只针对 `stable` 区引入第二维治理。

前提结论：

- `labs` 不引入第二维
- `sandbox` 不引入第二维
- 第二维只在 `stable` 的高复杂度业务切片中按需引入

## 目标

在不破坏现有 `stable / labs / sandbox` 治理的前提下，为 `stable` 补上更贴近 DDD / Clean / Hexagonal 的内部职责分层。

## 当前判断

### 已经相对稳定的第一维

- `app/router` 已承担组合根与暴露治理
- `app/layout` 已承担应用壳层与全局 Sidecar 挂载
- ESLint 已经约束第一维依赖方向

### 当前第二维还缺失的点

- `pages` 中仍有直接业务筛选和数据读取
- `entities` 中仍混有 demo 数据与领域规则
- `features` 还是空壳，尚未承接 use case
- `widgets` 后续即使变复杂，也不作为第二维承载点

## 修改顺序

### Phase 1. 文档与共识先行

动作：

- 新增 `docs/stable-clean/architecture.md`
- 在 `README.md` 与 `docs/README.md` 写入二维治理入口
- 在 `layer-model` 中声明第二维仅适用于 `stable`

完成标准：

- 后续讨论“是否要 Clean”时，有统一文档可引用

### Phase 2. 以 `project` 切片做最小试点

建议动作：

1. 将 `src/entities/project/model.ts` 拆成“领域定义”和“演示数据来源”
2. 在 `src/features/` 中新增与项目列表相关的第一个正式切片
3. 将首页中的可见项目筛选逻辑从 `src/pages/home/index.tsx` 下沉到 `features`
4. 调整 `src/entities/project/index.ts` 的公开导出，保证拆分后仍有稳定 public API
5. 更新 `src/pages/home/index.tsx` 与其他消费者的 import 路径和调用方式
6. 让 `pages/home` 只保留页面装配职责

当前决策：

- `entities/project` 只保留 domain
- `demoProjects` 这类演示数据来源不放在 `entities/project/infrastructure`
- 当前试点中，演示数据来源放在 `src/features/project-catalog/infrastructure/`
- `pages/home` 不再直接消费 entity 内的演示数据，而是通过 feature 入口消费

建议落点：

- `src/entities/project/domain/`
- `src/features/project-catalog/application/`
- `src/features/project-catalog/infrastructure/`
- `src/features/project-catalog/ui/`

完成标准：

- `pages/home` 不再直接承接业务筛选逻辑
- `entities/project` 不再把 demo 数据与 domain 混放
- `entities/project` 拆分后仍通过模块公开出口消费，不扩散深层 import
- `features/project-catalog` 成为第一个 use case 承载点

### Phase 3. 建立可复用模板，但不强制推广

动作：

- 为 `entities` 与 `features` 总结最小目录模板
- 补一条判断规则：只有出现稳定业务规则和流程编排时才启用第二维
- 后续新切片默认先保持简单，达到阈值再升级

完成标准：

- 新模块不再凭感觉决定是否引入 `application` / `infrastructure`
- `widgets` 复杂化时，团队默认先做职责下沉，而不是在 `widgets` 内补第二维

### Phase 4. 处理协作工作流，而不是继续把它堆进 `app/layout`

适用时机：

- 当 Sidecar 会话、第三工作区、协作触发词、上下文切换开始形成稳定业务流程时
- 若当前还没有可命名、可长期维护的稳定协作用例，可跳过本阶段

建议动作：

- 新建协作相关 `features`
- 将 use case、workflow、port/adapter 从 `app/layout` 和 `app/providers` 中下沉
- `app` 继续只负责挂载与组合

完成标准：

- `app/layout` 主要剩下壳层协调
- 协作流程逻辑进入 feature 内部

### Phase 5. 只对真正复杂的稳定切片继续推广

规则：

- 简单页面不改
- 所有 `widgets` 都不作为第二维治理对象
- `shared/ui` 不改造成领域层
- `labs` 与 `sandbox` 继续保持轻量结构
- `labs` 迁入 `stable` 前，先规划会落到哪些 `features`
- 当前没有达到第二维阈值的稳定切片时，不为了推进计划而硬拆新 feature

完成标准：

- 第二维只出现在少量真正值得长期维护的稳定切片中

## 不建议的做法

- 不要为所有 `pages/widgets/features/entities` 机械补齐四层目录
- 不要要求 `labs` 和 `sandbox` 跟随第二维
- 不要在 `widgets` 内保留第二维例外通道
- 不要把 layout、provider、简单组件都解释成 domain/application
- 不要在还没有稳定业务对象时先发明 repository 和 use case

## 下一步建议

如果要开始代码改造，优先顺序是：

1. `project` 切片试点
2. 首页装配收口
3. 其余稳定复杂切片按需跟进
4. 协作 workflow 仅在出现稳定用例后再抽 feature
