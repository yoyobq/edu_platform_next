<!-- docs/project-convention/e2e-test-groups.md -->

# E2E Test Groups

本文件是当前 E2E 分组与执行语义主题的直接规则文档。

## 目标

当前项目的 E2E 已经不再只是一个“最小 Playwright 用例”。

从目录结构来看，现有 E2E 至少已经分成两类关注点：

- 稳定业务浏览与 routing 回归
- Sidecar、degraded mode、workspace 行为验证

如果不把它们的目标区分开，最容易出现的问题是：

- 运行 E2E 时，不知道该跑全量还是跑局部
- 新增 spec 时，不知道该放到哪一组
- `smoke` 被写成普通业务回归集合
- `core` 混入过多 shell / collaboration 行为，失去回归重点

## 当前分组

本仓库当前可按以下语义理解：

| 分组    | 目标                                              | 当前范围                                      |
| ------- | ------------------------------------------------- | --------------------------------------------- |
| `core`  | 回归稳定用户路径、routing 与主业务浏览链路        | `e2e/specs/projects/*`、`e2e/specs/routing/*` |
| `smoke` | 验证 Sidecar、degraded mode、workspace 级协作行为 | `e2e/specs/smoke/*`                           |

补充说明：

- `core` 是默认回归面
- `smoke` 在语义上更接近“壳层与协作能力验证”，即使当前仍主要在本地环境执行

## 当前运行方式

当前 `package.json` 已提供：

- 全量：`npm run test:e2e`
- 全量 headed：`npm run test:e2e:headed`

按目录分组运行时，当前推荐直接传 Playwright 路径：

- 跑 `core`：`npx playwright test e2e/specs/projects e2e/specs/routing`
- 跑 `smoke`：`npx playwright test e2e/specs/smoke`

单文件运行示例：

- `npx playwright test e2e/specs/projects/project-live-status.spec.ts`
- `npx playwright test e2e/specs/smoke/sidecar-degraded.spec.ts`

## 放置规则

- 稳定 routing、access control、正常业务浏览流程相关 spec，进入 `core`
- Sidecar 生命周期、degraded AI 行为、workspace 壳层、跨 route 协作行为相关 spec，进入 `smoke`
- 不要因为某个业务页面“顺带打开了 Sidecar”，就把普通业务断言直接塞进 `smoke`
- 也不要把明显属于 shell / collaboration 边界的断言伪装成普通业务回归放进 `core`

## 命名与表达

- 文件名继续使用英文 `kebab-case`
- 测试标题继续优先写中文行为描述
- 若一个 spec 主要验证 `labs access`、`sandbox routing` 这类治理边界，命名应把该边界表达清楚

## 日常建议

- 定位单点问题时，优先先跑单文件
- 改动 routing 或正式页面主流程后，至少跑一次 `core`
- 改动 `app shell`、Sidecar、degraded mode、跨 route 会话保持后，至少跑一次 `smoke`
- 风险较高的 UI shell 改动，在合并前应跑全量 E2E
