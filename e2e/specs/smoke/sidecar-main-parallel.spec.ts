import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('keeps main area interactive while the entry sidecar is open', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();

  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();

  await page.getByRole('link', { name: '沙盒演练场' }).click();

  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
});

test('keeps the entry shell usable after a route change', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();

  await page.getByRole('link', { name: '沙盒演练场' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('首页');
  await input.press('Enter');

  await expect(page.getByText('先帮你找到 1 个和“首页”相关的入口，确认后即可进入。')).toBeVisible();

  await page.getByRole('button', { name: '进入首页' }).click();
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
});
