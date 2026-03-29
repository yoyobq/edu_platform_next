import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('用户主动关闭入口面板后，跨路由切换也不应自动重新打开', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toHaveCount(0);

  await page.getByRole('link', { name: '沙盒演练场' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toHaveCount(0);
});
