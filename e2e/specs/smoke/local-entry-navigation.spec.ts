import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('增强入口不可用时，应通过本地语义入口卡片完成导航', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('沙盒');
  await input.press('Enter');

  await expect(page.getByText('先帮你找到 1 个和“沙盒”相关的入口，确认后即可进入。')).toBeVisible();
  await expect(page.getByText('Sandbox 演练场')).toBeVisible();

  await page.getByRole('button', { name: '进入Sandbox 演练场' }).click();

  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();
});
