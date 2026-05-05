import { openHomeAs } from '../../helpers/app';
import { expect, test } from '../../test';

test('学生身份进入首页时，应进入我的工作台周课表内容', async ({ page }) => {
  await openHomeAs(page, { primaryAccessGroup: 'STUDENT' });

  await expect(page.getByRole('heading', { name: '我的工作台' })).toBeVisible();
  await expect(page.getByText('当前账号暂无可展示周课表')).toBeVisible();
  await expect(page.getByText('成员默认模板')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '打开开始入口' })).toHaveCount(0);
});

test('GUEST 进入首页时，应进入我的工作台周课表内容', async ({ page }) => {
  await openHomeAs(page, { primaryAccessGroup: 'GUEST' });

  await expect(page.getByText('当前账号暂无可展示周课表')).toBeVisible();
  await expect(page.getByText('最小默认模板')).toHaveCount(0);
});

test('当 accessGroup 包含 ADMIN 时，应优先进入管理默认模板', async ({ page }) => {
  await openHomeAs(page, {
    accessGroup: ['ADMIN', 'STUDENT'],
    primaryAccessGroup: 'STUDENT',
  });

  await expect(page.getByText('管理默认模板')).toBeVisible();
});
