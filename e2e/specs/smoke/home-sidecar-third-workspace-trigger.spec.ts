import { expect, test } from '../../test';

test('主页 sidecar 输入触发词后，应直接打开第三工作区 demo', async ({ page }) => {
  await page.goto('/?role=admin');
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();

  await page.getByRole('button', { name: '开始' }).click();

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('跳层简报');
  await input.press('Enter');

  await expect(
    page.getByText(
      '已按触发词“跳层简报”为你打开第三工作区 demo。你可以先在主区继续浏览，再决定是否关闭它。',
    ),
  ).toBeVisible();

  const thirdWorkspaceRoot = page.locator('[data-layout-layer="third-workspace-root"]');
  await expect(thirdWorkspaceRoot).toHaveAttribute('data-workspace-state', 'open');
  await expect(page.getByTestId('third-workspace-canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: '版本发布简报' })).toBeVisible();
});
