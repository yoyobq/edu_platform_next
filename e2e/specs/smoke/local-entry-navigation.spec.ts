import { openEntrySidecar, openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('增强入口不可用时，应通过本地语义入口卡片完成导航', async ({ page }) => {
  await openHome(page);

  await openEntrySidecar(page);

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('沙盒');
  await input.press('Enter');

  await expect(page.getByText('先帮你找到 1 个和“沙盒”相关的入口，确认后即可进入。')).toBeVisible();
  await expect(page.getByText('Sandbox 演练场')).toBeVisible();

  await page.getByRole('button', { name: '进入Sandbox 演练场' }).click();

  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();
});

test('本地入口卡片跳回首页时，应清理 labs demo 专属 query', async ({ page }) => {
  await openHome(page);

  await page.goto('/labs/demo?availability=degraded&workspaceDemo=stale-demo-query');
  await openEntrySidecar(page);

  const input = page.getByPlaceholder('输入目标页面名称或操作意图');
  await input.fill('首页');
  await input.press('Enter');

  await expect(page.getByText('先帮你找到 1 个和“首页”相关的入口，确认后即可进入。')).toBeVisible();

  await page.getByRole('button', { name: '进入首页' }).click();

  await expect(page).toHaveURL(/\/\?availability=degraded$/);
  await expect(page).not.toHaveURL(/workspaceDemo=/);
  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
});
