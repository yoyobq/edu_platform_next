import { openEntrySidecar, openHome, openHomeAs } from '../../helpers/app';
import { expect, test } from '../../test';

test('accessGroup 含 ADMIN 但主身份不是 ADMIN 时，也应显示 admin 导航', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await openHomeAs(page, {
    accessGroup: ['ADMIN', 'STUDENT'],
    primaryAccessGroup: 'STUDENT',
  });

  await expect(page.getByText('管理默认模板')).toBeVisible();
  await expect(page.getByRole('button', { name: '展开导航菜单' })).toBeVisible();
});

test('无 ADMIN 权限时，不应显示 admin 导航', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await openHomeAs(page, {
    primaryAccessGroup: 'STUDENT',
  });

  await expect(page.getByText('成员默认模板')).toBeVisible();
  await expect(page.getByRole('button', { name: '展开导航菜单' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '收起导航菜单' })).toHaveCount(0);
});

test('guest 用户组可见 sidebar，并可进入首页与异常预览页', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await openHomeAs(page, {
    accessGroup: ['GUEST'],
    primaryAccessGroup: 'GUEST',
  });

  await expect(page.getByRole('button', { name: '展开导航菜单' })).toBeVisible();

  await page.getByRole('button', { name: '展开导航菜单' }).click();

  await expect(page.getByRole('menuitem', { name: '首页' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '异常预览' })).toBeVisible();

  await page.getByRole('menuitem', { name: '异常预览' }).click();

  await expect(page.getByRole('heading', { name: '异常页预览' })).toBeVisible();
});

test('管理员可在 rail 与 full 间切换，并在刷新后恢复 pinned full', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await openHome(page);

  await expect(page.getByRole('button', { name: '展开导航菜单' })).toBeVisible();
  await page.getByRole('button', { name: '展开导航菜单' }).click();
  await expect(page.getByRole('button', { name: '收起导航菜单' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
  await expect(page.getByRole('button', { name: '收起导航菜单' })).toBeVisible();

  await page.getByRole('button', { name: '收起导航菜单' }).click();
  await expect(page.getByRole('button', { name: '展开导航菜单' })).toBeVisible();
});

test('full 导航在主区宽度不足时，应自动折叠回 rail', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await openHome(page);

  await page.getByRole('button', { name: '展开导航菜单' }).click();
  await expect(page.getByRole('button', { name: '收起导航菜单' })).toBeVisible();

  await openEntrySidecar(page);

  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
  await expect(page.getByRole('button', { name: '展开导航菜单' })).toBeVisible();
  await expect(page.getByRole('button', { name: '收起导航菜单' })).toHaveCount(0);
});
