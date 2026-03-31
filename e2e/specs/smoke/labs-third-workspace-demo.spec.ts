import { routes } from '../../fixtures/routes';
import { mockApiHealth, openEntrySidecar, seedAuthSession } from '../../helpers/app';
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

test('labs demo 的 sidecar 触发词仍可打开受控第三工作区 demo', async ({ page }) => {
  await mockApiHealth(page);
  await seedAuthSession(page, { role: 'ADMIN' });
  await page.goto(`${routes.labsDemo}?availability=unavailable`);

  await openEntrySidecar(page);

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('demo 跳层简报');
  await input.press('Enter');

  await expect(
    page.getByText(
      '已按 demo 验证触发词“demo 跳层简报”打开 labs 受控第三工作区 demo。这条链路只用于跳层验证，不属于正式首页或正式 Sidecar 合同。',
    ),
  ).toBeVisible();

  const thirdWorkspaceRoot = page.locator('[data-layout-layer="third-workspace-root"]');
  await expect(thirdWorkspaceRoot).toHaveAttribute('data-workspace-state', 'open');
  await expect(page.getByTestId('third-workspace-canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: '版本发布简报' })).toBeVisible();
});

test('从 labs demo 跳回首页时，不应继续携带第三工作区 demo query', async ({ page }) => {
  await mockApiHealth(page);
  await seedAuthSession(page, { role: 'ADMIN' });
  await page.goto(routes.labsDemo);

  await page
    .getByTestId('artifact-card-artifact-release-brief')
    .getByRole('button', { name: '跳到第三工作区' })
    .click();

  await expect(page).toHaveURL(/workspaceDemo=artifact-release-brief/);

  await expect(page.getByRole('link', { name: '首页' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: '沙盒演练场' })).toHaveAttribute(
    'href',
    '/sandbox/playground',
  );
});
