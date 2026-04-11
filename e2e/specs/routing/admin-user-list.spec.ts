import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

test('未登录访问 admin 用户列表时，应跳到携带 redirect 的登录页', async ({ page }) => {
  await page.goto(routes.adminUsers);

  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.adminUsers)}$`),
  );
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('非 admin 访问 admin 用户列表时，应显示 403', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      primaryAccessGroup: 'STAFF',
    },
  });
  await seedAuthSession(page, {
    primaryAccessGroup: 'STAFF',
  });

  await page.goto(routes.adminUsers);

  await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
});

test('admin 用户列表应支持筛选、分页，并显示正式导航入口', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.adminUsers);

  await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible();
  await expect(page.getByText('正式 admin 页面')).toBeVisible();
  await expect(page.getByText('共 12 人')).toBeVisible();
  await page.getByRole('button', { name: '展开导航菜单' }).click();
  await expect(page.getByRole('menuitem', { name: '用户管理' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /账户 ID/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '工号' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '姓名' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '访问组' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '账户状态' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '创建时间' })).toBeVisible();
  await expect(page.getByText('staff-1011')).toBeVisible();
  await expect(page.getByText('Lambda Xu')).toBeVisible();
  const expectedCreatedAt = await page.evaluate(() =>
    new Intl.DateTimeFormat('zh-CN', {
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date('2026-04-11T08:00:00.000Z')),
  );
  await expect(page.getByText(expectedCreatedAt)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '登录名' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '登录邮箱' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '昵称' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '手机号' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '职务' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '用户状态' })).toHaveCount(0);

  await page.getByPlaceholder('搜索登录名、邮箱、昵称或 staff 姓名').fill('Grace');
  await page.getByRole('button', { name: '应用筛选' }).click();

  await expect(page.getByText('共 1 人')).toBeVisible();
  await expect(page.getByText('Grace Lin')).toBeVisible();
  await expect(page.getByText('Lambda Xu')).not.toBeVisible();

  await page.getByRole('button', { name: '重置条件' }).click();
  await expect(page.getByText('共 12 人')).toBeVisible();

  await page.getByTitle('2').click();
  await expect(page.getByText('Alpha Chen')).toBeVisible();
  await expect(page.getByText('Lambda Xu')).not.toBeVisible();
});

test('admin 用户列表应允许在状态单元格中修改单个账户状态', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      primaryAccessGroup: 'ADMIN',
    },
  });
  await seedAuthSession(page, {
    primaryAccessGroup: 'ADMIN',
  });

  await page.goto(routes.adminUsers);

  const lambdaRow = page.locator('tbody tr').filter({
    has: page.getByText('Lambda Xu'),
  });
  const statusTrigger = page.getByTestId('account-status-trigger-1011');

  await expect(lambdaRow).toContainText('正常');

  await statusTrigger.click();
  await page.getByTestId('account-status-option-1011-SUSPENDED').click();

  await expect(lambdaRow).toContainText('已暂停');
  await expect(page.getByText('已将账户 1011 更新为已暂停')).toBeVisible();
});
