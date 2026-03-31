import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('首页应展示 API 状态面板，并支持重新检测', async ({ page }) => {
  await openHome(page);

  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
  await expect(page.getByText('管理默认模板')).toBeVisible();
  await expect(page.getByRole('heading', { name: '系统状态概览' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '主动作入口' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '最近上下文' })).toBeVisible();
  await expect(page.getByText('2/2 条关键检查已通过，可以继续使用默认工作台。')).toBeVisible();
  await expect(page.getByText('后端连通性')).toBeVisible();
  await expect(page.getByText('数据库就绪')).toBeVisible();
  await expect(page.getByText('正常')).toHaveCount(2);

  await page.getByRole('button', { name: '重新检测' }).click();
  await expect(page.getByText('2/2 条关键检查已通过，可以继续使用默认工作台。')).toBeVisible();
});
