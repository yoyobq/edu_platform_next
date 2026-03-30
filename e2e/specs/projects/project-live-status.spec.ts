import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('首页应展示 API 状态面板，并支持重新检测', async ({ page }) => {
  await openHome(page);

  await expect(page.getByRole('heading', { name: 'API 状态面板' })).toBeVisible();
  await expect(page.getByText('2/2 成功')).toBeVisible();
  await expect(page.getByText('后端连通性')).toBeVisible();
  await expect(page.getByText('数据库就绪')).toBeVisible();
  await expect(page.getByText('ok')).toHaveCount(2);

  await page.getByRole('button', { name: '重新检测' }).click();
  await expect(page.getByText('2/2 成功')).toBeVisible();
});
