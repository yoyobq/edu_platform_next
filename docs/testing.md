# Testing

本项目当前测试约定分为三层：

- `e2e/`：Playwright 端到端测试
- `tests/integration/`：预留给未来的集成测试
- 源码旁 `*.test.ts`：预留给未来的纯函数单测

## E2E 入口

默认入口：

```bash
npm run test:e2e
```

这个命令本质上是 `playwright test`。

## E2E 配置文件

环境变量文件位于 `env/`：

- `env/.env.example`：通用环境变量示例，预留给未来 shared 配置
- `env/.env.development.example`：development 模式示例
- `env/.env.production.example`：production 模式示例
- `env/.env.e2e.example`：E2E 专用示例
- `env/.env.development.local`：本地实际使用的 development 配置，不提交到 git
- `env/.env.production.local`：本地实际使用的 production 配置，不提交到 git
- `env/.env.e2e.local`：本地实际使用的 E2E 配置，不提交到 git

当前 E2E 相关变量：

- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_APP_ENV`
- `PLAYWRIGHT_HOST`
- `PLAYWRIGHT_NO_PROXY_APPEND`
- `PLAYWRIGHT_PORT`

## 当前实现

- `vite.config.ts` 负责读取 `env/` 下的 development / production 配置
- `playwright.config.ts` 负责读取 `env/` 下的 E2E 配置
- Playwright 使用 `webServer` 启动本地 Vite
- Playwright 启动的 Vite 明确运行在 `test` mode
- `scripts/e2e/start-vite.mjs` 只负责打印启动日志并转发关闭信号

## 环境说明

当前默认的 `PLAYWRIGHT_HOST` 是 `::1`。

这不是通用规则，而是当前环境下更稳定的 loopback 选择。若你的机器对 `127.0.0.1` 工作正常，且代理绕过配置也正确，可以改回 `127.0.0.1`。

如果修改 loopback 地址，应同时检查：

- `PLAYWRIGHT_HOST`
- `PLAYWRIGHT_NO_PROXY_APPEND`

## E2E 命名与文案约定

- E2E 文件名继续使用英文 `kebab-case`，便于目录稳定、路径检索与团队协作
- `test('...')` 的测试标题默认使用中文，优先服务人工排错与失败输出阅读
- 测试标题应直接描述断言意图，推荐使用：
  - `...后，应...`
  - `...时，应...`
  - `...时，不应...`
- 不要把测试标题写成实现细节说明；标题应表达行为契约，而不是 DOM 或内部实现

## 现有用例

当前已接入一个最小 E2E 用例：

- `e2e/specs/projects/project-live-status.spec.ts`

它用于验证“项目是否 live”的最小展示与筛选闭环。
