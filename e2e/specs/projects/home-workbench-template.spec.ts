import { openHomeAs } from '../../helpers/app';
import { expect, test } from '../../test';

test('成员角色进入首页时，应回退到成员默认模板', async ({ page }) => {
  await openHomeAs(page, { role: 'CUSTOMER' });

  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
  await expect(page.getByText('成员默认模板')).toBeVisible();

  await page.getByRole('button', { name: '打开开始入口' }).click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
});

test('当 accessGroup 包含 ADMIN 时，应优先回退到管理默认模板', async ({ page }) => {
  await openHomeAs(page, {
    accessGroup: ['ADMIN'],
    role: 'CUSTOMER',
  });

  await expect(page.getByText('管理默认模板')).toBeVisible();
});
