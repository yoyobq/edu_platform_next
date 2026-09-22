// e2e/test.ts

// 保留真实动画生命周期：强制 0s 会导致弹窗退出阶段丢失结束事件、遮罩残留。
// 使用 Playwright 的可操作性检查和状态断言等待界面稳定。
export { expect, test } from '@playwright/test';
