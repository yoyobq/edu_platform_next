import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

test('已登录会话访问不存在的页面时，不应停留在 loading', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: {
      displayName: 'guest-user',
      primaryAccessGroup: 'GUEST',
      accessGroup: ['GUEST'],
      identity: null,
      identityHint: 'GUEST',
    },
  });
  await seedAuthSession(page, {
    displayName: 'guest-user',
    primaryAccessGroup: 'GUEST',
    accessGroup: ['GUEST'],
    identity: null,
    identityHint: 'GUEST',
  });

  await page.goto('/this-page-does-not-exist');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('heading', { name: '路由不存在' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '账户登录' })).toHaveCount(0);
});
