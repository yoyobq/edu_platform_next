<!-- docs/testing.md -->

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

若需要按测试目标区分 `core` / `smoke`、按目录运行，或跑单文件，请同时查看 [project-convention/e2e-test-groups.md](./project-convention/e2e-test-groups.md)。

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

## 测试证据维护

- E2E 使用真实组件动画生命周期，不全局注入 `disable-motion`：强制动画时长为零可能使弹窗退出事件丢失，留下遮挡页面的遮罩。使用可操作性检查和状态断言等待关闭，不使用 DOM 直接点击绕过遮挡。
- 有固定 `expiresAt` 的有效会话 fixture 必须配套固定测试时钟；续期与过期另设场景，不依赖测试执行当天的日期。
- 路由退役依据 `11078da`：`/labs/invite-issuer` 对已登录 admin / staff 均返回 404；签发承诺由 `/admin/verification-issuance` 的教师邀请与班级共享链接用例承接。正式前端不再暴露指定学生链接签发，见 [学生注册链接约定](./project-convention/public-auth-student-registration.md)。
- 教职工邀请用例同时验证非法登录名不消费邀请，以及合法登录名完成激活、登录和首页课表加载。登录名约束见 [教职工邀请约定](./project-convention/public-auth-staff-invite.md)；首页 mock 对齐当前 `TeachingDeliveries` 查询，保留登录后课程可见断言。
- 这里的 Playwright 用例通过 GraphQL mock 验证前端入口、交互及请求契约，不替代后端持久化 E2E 或真实上游联调。

## E2E 命名与文案约定

- E2E 文件名继续使用英文 `kebab-case`，便于目录稳定、路径检索与团队协作
- `test('...')` 的测试标题默认使用中文，优先服务人工排错与失败输出阅读
- 测试标题应直接描述断言意图，推荐使用：
  - `...后，应...`
  - `...时，应...`
  - `...时，不应...`
- 不要把测试标题写成实现细节说明；标题应表达行为契约，而不是 DOM 或内部实现

## 现有用例

当前已接入的 E2E 已不止一个最小用例，主要分布在：

- `e2e/specs/projects/`
- `e2e/specs/routing/`
- `e2e/specs/smoke/`

更细的分组语义与运行建议见 [project-convention/e2e-test-groups.md](./project-convention/e2e-test-groups.md)。
