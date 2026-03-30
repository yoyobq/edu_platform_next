import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('layout 应预留第三工作区挂载位，且不影响现有入口交互', async ({ page }) => {
  await openHome(page);

  const thirdWorkspaceRoot = page.locator('[data-layout-layer="third-workspace-root"]');
  const artifactsMount = page.locator('[data-workspace-mount="artifacts-canvas"]');

  await expect(thirdWorkspaceRoot).toBeAttached();
  await expect(thirdWorkspaceRoot).toHaveAttribute('aria-hidden', 'true');
  await expect(artifactsMount).toBeAttached();

  await page.getByRole('button', { name: '开始' }).click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
});
