<!-- docs/open-decisions.md -->

# Open Decisions

本文件记录当前真正的开放项、已知限制，以及少量需要保留的关键背景决策。

## 1. Why Not Pure FSD

当前决策：

- 本项目不追求“纯粹 FSD”，而采用 `stable / labs / sandbox` 三层结构
- 这样做的目的不是弱化分层，而是把长期维护、可控实验、开发试错明确分开
- `labs` 和 `sandbox` 的存在是为了让 AI 可以快速生成结果、快速验证价值，同时避免实验代码直接污染正式区
- 因此后续不应把项目机械收敛回只剩传统 `app / pages / widgets / features / entities / shared` 的单一正式结构

## 2. stable 区细分职责尚未拆成独立短文档

当前状态：

- `app / pages / widgets / features / entities / shared` 的当前规则已经收敛到 [layer-model.md](./layer-model.md)
- 但它们还没有拆成各自独立的主题文档

后续方向：

- 视规则稳定程度，后续再拆成更小的主题文档

## 3. 已知限制：ESLint 不会自动根据 exception 放行

当前状态：

- `labs` 的 `exception` 仍需要人工确认后写入 `meta.ts`
- ESLint 不会自动读取 `exception` 并放行对应依赖

当前处理方式：

- 默认依赖仍由 ESLint 自动拦截
- 真实例外依赖靠人工确认与文档约束处理

## 4. Identity / Session 后续收敛

当前仍是条件触发项：

- 若出现完整 onboarding，需要新增明确阶段字段，不继续扩张 `needsProfileCompletion`
- 页面访问配置只有出现多租户差异、后台动态配置、不发版调整或审计需求时，才评估 DB 化
- token 存储若要从 localStorage 收敛到 HttpOnly cookie，需要同时重新评估 refresh / me、CSRF、跨域和服务端吊销语义
- `slotGroup` 当前前端消费枚举已记录在 `identity-access-session.md`；后续新增 slot 或需要审计矩阵时，再补页面级正反路径 E2E

## 5. Public Auth 后续项

当前不默认推进：

- 开放 `/register`
- 非 `staff` 的 inviteType
- 账户中心与资料编辑
- magic-link 真实登录续接

magic-link 只有拿到“验证成功后建立 session”的后端契约后，才从壳页升级为真实流程。

## 6. Layout / Navigation 后续项

当前不默认推进：

- `rail -> drawer / flyout` 真实交互
- Omni 从轻命令入口扩成复合中枢
- 第三工作区正式 view state
- 左栏 / Sidecar 自由拖拽调宽

这些项需要真实业务使用模式或明确交互需求出现后再启动。
