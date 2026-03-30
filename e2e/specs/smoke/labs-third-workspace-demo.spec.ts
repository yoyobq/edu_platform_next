import { routes } from '../../fixtures/routes';
import { mockApiHealth, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

test('labs 中的第三工作区 demo 应可把结果物跳到独立工作区', async ({ page }) => {
  await mockApiHealth(page);
  await seedAuthSession(page, { role: 'ADMIN' });
  await page.goto(routes.labsDemo);

  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();

  await page
    .getByTestId('artifact-card-artifact-release-brief')
    .getByRole('button', { name: '跳到第三工作区' })
    .click();

  const thirdWorkspaceRoot = page.locator('[data-layout-layer="third-workspace-root"]');
  await expect(thirdWorkspaceRoot).toHaveAttribute('data-workspace-state', 'open');
  await expect(thirdWorkspaceRoot).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByTestId('third-workspace-canvas')).toBeVisible();
  await expect(page.getByText('第三工作区 / Artifacts Canvas Demo')).toBeVisible();
  await expect(page.getByRole('heading', { name: '版本发布简报' })).toBeVisible();

  await page.getByRole('button', { name: '关闭第三工作区' }).click();
  await expect(thirdWorkspaceRoot).toHaveAttribute('data-workspace-state', 'closed');
  await expect(thirdWorkspaceRoot).toHaveAttribute('aria-hidden', 'true');
});
