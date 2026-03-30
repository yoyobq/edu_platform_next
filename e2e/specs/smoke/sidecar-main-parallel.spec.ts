import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('入口面板打开时，主内容区仍应保持可交互', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();

  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();

  await page.getByRole('button', { name: '重新检测' }).click();
  await expect(page.getByRole('heading', { name: 'API 状态面板' })).toBeVisible();
  await expect(page.getByText('2/2 成功')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
});

test('路由切换后，入口面板仍应保持可继续使用', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('沙盒');
  await input.press('Enter');
  await page.getByRole('button', { name: '进入Sandbox 演练场' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();

  await input.fill('首页');
  await input.press('Enter');

  await expect(page.getByText('先帮你找到 1 个和“首页”相关的入口，确认后即可进入。')).toBeVisible();

  await page.getByRole('button', { name: '进入首页' }).click();
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
});
