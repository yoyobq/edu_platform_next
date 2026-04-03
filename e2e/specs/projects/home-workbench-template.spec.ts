import { openHomeAs } from '../../helpers/app';
import { expect, test } from '../../test';

test('学生身份进入首页时，应进入成员默认模板', async ({ page }) => {
  await openHomeAs(page, { primaryAccessGroup: 'STUDENT' });

  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
  await expect(page.getByText('成员默认模板')).toBeVisible();

  await page.getByRole('button', { name: '打开开始入口' }).click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
});

test('GUEST 进入首页时，应进入最小默认模板', async ({ page }) => {
  await openHomeAs(page, { primaryAccessGroup: 'GUEST' });

  await expect(page.getByText('最小默认模板')).toBeVisible();
});

test('当 accessGroup 包含 ADMIN 时，应优先进入管理默认模板', async ({ page }) => {
  await openHomeAs(page, {
    accessGroup: ['ADMIN', 'STUDENT'],
    primaryAccessGroup: 'STUDENT',
  });

  await expect(page.getByText('管理默认模板')).toBeVisible();
});
