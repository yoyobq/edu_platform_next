import { openHomeAsAdmin } from '../../helpers/app';
import { expect, test } from '../../test';

test('主页 sidecar 输入触发词后，应直接打开第三工作区 demo', async ({ page }) => {
  await openHomeAsAdmin(page);

  await page.getByRole('button', { name: '开始' }).click();

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('demo 跳层简报');
  await input.press('Enter');

  await expect(
    page.getByText(
      '已按 demo 验证触发词“demo 跳层简报”为你打开第三工作区 demo。这条链路只用于跳层验证，不代表正式默认入口能力。',
    ),
  ).toBeVisible();

  const thirdWorkspaceRoot = page.locator('[data-layout-layer="third-workspace-root"]');
  await expect(thirdWorkspaceRoot).toHaveAttribute('data-workspace-state', 'open');
  await expect(page.getByTestId('third-workspace-canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: '版本发布简报' })).toBeVisible();
});
